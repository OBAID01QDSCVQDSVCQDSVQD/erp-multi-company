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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { 
      tenantId, 
      type: 'DEVIS' 
    };
    
    if (customerId) query.customerId = customerId;

    const quotes = await (Document as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Document as any).countDocuments(query);

    return NextResponse.json({ items: quotes, total });
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
