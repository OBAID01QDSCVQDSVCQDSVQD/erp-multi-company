import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import { NumberingService } from '@/lib/services/NumberingService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = {
      tenantId,
      type: 'DEVIS'
    };

    if (customerId) query.customerId = customerId;

    // First, get all quotes without select to ensure projetId is included
    let quotes = await (Document as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Manually select only the fields we need, ensuring projetId is included
    quotes = quotes.map((q: any) => ({
      _id: q._id,
      numero: q.numero,
      dateDoc: q.dateDoc,
      date: q.date,
      createdAt: q.createdAt,
      customerId: q.customerId,
      projetId: q.projetId, // Ensure projetId is included
      totalBaseHT: q.totalBaseHT,
      totalHT: q.totalHT,
      totalTTC: q.totalTTC
    }));

    // Populate customerId manuellement (qu'il soit string ou ObjectId)
    const Customer = (await import('@/lib/models/Customer')).default;
    const customerIds = [
      ...new Set(
        quotes
          .map((q: any) => q.customerId)
          .filter((id: any) => !!id)
          .map((id: any) => id.toString())
      ),
    ];

    if (customerIds.length > 0) {
      const customers = await (Customer as any)
        .find({
          _id: { $in: customerIds },
          tenantId,
        })
        .select('nom prenom raisonSociale')
        .lean();

      const customerMap = new Map(customers.map((c: any) => [c._id.toString(), c]));

      for (const quote of quotes) {
        if (quote.customerId) {
          const key = quote.customerId.toString();
          const customer = customerMap.get(key);
          if (customer) {
            quote.customerId = customer;
          }
        }
      }
    }

    // Filter by search query if provided (after populate to search in customer name)
    let filteredQuotes = quotes;
    if (q) {
      const searchLower = q.toLowerCase();
      filteredQuotes = quotes.filter((quote: any) => {
        const matchesNumero = quote.numero?.toLowerCase().includes(searchLower);
        const customer = quote.customerId;
        let customerName = '';
        if (customer) {
          if (typeof customer === 'object' && customer !== null) {
            customerName = (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || '').toLowerCase();
          } else if (typeof customer === 'string') {
            // If still a string, try to fetch it
            customerName = '';
          }
        }
        const matchesCustomer = customerName.includes(searchLower);
        return matchesNumero || matchesCustomer;
      });
    }

    const total = q ? filteredQuotes.length : await (Document as any).countDocuments(query);

    return NextResponse.json({ items: filteredQuotes, total });
  } catch (error) {
    console.error('Erreur GET /sales/quotes:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    // Check Subscription Limit
    const { checkSubscriptionLimit } = await import('@/lib/subscription-check');
    const limitCheck = await checkSubscriptionLimit(tenantId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.error }, { status: 403 });
    }

    // Generate numero
    const numero = await NumberingService.next(tenantId, 'devis');

    const quote = new Document({
      ...body,
      tenantId,
      type: 'DEVIS',
      numero,
      createdBy: session.user.email
    });

    // Calculate totals
    calculateDocumentTotals(quote);

    await (quote as any).save();

    // Log Action
    const { logAction } = await import('@/lib/logger');
    await logAction(
      session,
      'CREATE_QUOTE',
      'Sales',
      `Created Quote ${quote.numero}`,
      { quoteId: quote._id, totalTTC: quote.totalTTC }
    );

    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/quotes:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to calculate document totals
function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;
  const taxGroups: { [key: string]: number } = {};

  // Calculate HT after line discounts
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalHTAfterLineDiscount += montantHT;
  });

  // Calculate FODEC (after discount, on HT)
  const fodecEnabled = doc.fodec?.enabled || false;
  const fodecTauxPct = doc.fodec?.tauxPct || 1;
  const fodec = fodecEnabled ? totalHTAfterLineDiscount * (fodecTauxPct / 100) : 0;

  // Calculate TVA after applying FODEC
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    // Add FODEC to base for TVA calculation (proportional to line)
    const lineFodec = fodecEnabled ? montantHT * (fodecTauxPct / 100) : 0;
    const lineBaseTVA = montantHT + lineFodec;

    if (line.tvaPct) {
      const tvaAmount = lineBaseTVA * (line.tvaPct / 100);
      totalTVA += tvaAmount;

      if (!taxGroups[line.taxCode || 'DEFAULT']) {
        taxGroups[line.taxCode || 'DEFAULT'] = 0;
      }
      taxGroups[line.taxCode || 'DEFAULT'] += tvaAmount;
    }
  });

  doc.totalBaseHT = Math.round(totalHTAfterLineDiscount * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  doc.fodec = { // Ensure fodec object is saved
    enabled: fodecEnabled,
    tauxPct: fodecTauxPct,
    montant: Math.round(fodec * 100) / 100,
  };

  // Add timbre fiscal if it exists in the document
  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA + doc.fodec.montant + timbreFiscal;
  doc.netAPayer = doc.totalTTC;

  return { totalBaseHT: doc.totalBaseHT, totalTVA, totalTTC: doc.totalTTC, taxGroups };
}
