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
    const supplierId = searchParams.get('supplierId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { tenantId, type: 'FACFO' };
    if (supplierId) query.supplierId = supplierId;

    const invoices = await (Document as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Document as any).countDocuments(query);

    return NextResponse.json({ items: invoices, total });
  } catch (error) {
    console.error('Erreur GET /purchases/invoices:', error);
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
    const numero = await NumberingService.next(tenantId, 'facfo');

    const invoice = new Document({
      ...body,
      tenantId,
      type: 'FACFO',
      numero,
      statut: 'brouillon',
      createdBy: session.user.email
    });

    calculateDocumentTotals(invoice);
    await (invoice as any).save();

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /purchases/invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalBaseHT = 0;
  let totalTVA = 0;
  let totalTVADeductible = 0;

  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalBaseHT += montantHT;
    
    if (line.tvaPct) {
      const tvaAmount = montantHT * (line.tvaPct / 100);
      totalTVA += tvaAmount;
      // For purchases, calculate deductible TVA (assuming 100% deductible)
      totalTVADeductible += tvaAmount;
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA;
  doc.totalTVADeductible = Math.round(totalTVADeductible * 100) / 100;
  doc.netAPayer = doc.totalTTC;
}
