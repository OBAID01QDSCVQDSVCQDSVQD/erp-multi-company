import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const quote = await (Document as any).findOne({
      _id: params.id,
      tenantId,
      type: 'DEVIS'
    }).lean();

    if (!quote) {
      return NextResponse.json(
        { error: 'Devis non trouvé' },
        { status: 404 }
      );
    }

    // Enrich lines with product data if needed
    if (quote.lignes && Array.isArray(quote.lignes)) {
      quote.lignes = await Promise.all(
        quote.lignes.map(async (line: any) => {
          if (line.productId) {
            try {
              const product = await (Product as any).findOne({ _id: line.productId, tenantId }).lean();
              if (product) {
                line.estStocke = (product as any).estStocke;
                line.descriptionProduit = (product as any).description;
              }
            } catch (error) {
              console.error('Error fetching product for enrichment:', error);
            }
          }
          return line;
        })
      );
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Erreur GET /sales/quotes/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const quote = await (Document as any).findOne({ _id: params.id, tenantId, type: 'DEVIS' });

    if (!quote) {
      return NextResponse.json(
        { error: 'Devis non trouvé' },
        { status: 404 }
      );
    }

    // Update fields
    Object.assign(quote, body);
    
    // Explicitly update fodec if present in body
    if (body.fodec !== undefined) {
      quote.fodec = body.fodec;
    }

    // Recalculate totals
    calculateDocumentTotals(quote);

    await (quote as any).save();

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Erreur PATCH /sales/quotes/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const quote = await (Document as any).findByIdAndDelete(
      params.id
    );

    if (!quote) {
      return NextResponse.json(
        { error: 'Devis non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Devis supprimé', quote });
  } catch (error) {
    console.error('Erreur DELETE /sales/quotes/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;

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
}
