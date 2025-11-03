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

    const query: any = { tenantId, type: 'BC' };
    if (customerId) query.customerId = customerId;

    const orders = await (Document as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Document as any).countDocuments(query);

    return NextResponse.json({ items: orders, total });
  } catch (error) {
    console.error('Erreur GET /sales/orders:', error);
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
    const numero = await NumberingService.next(tenantId, 'bc');

    const order = new Document({
      ...body,
      tenantId,
      type: 'BC',
      numero,
      statut: 'confirme',
      createdBy: session.user.email
    });

    calculateDocumentTotals(order);
    await (order as any).save();

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/orders:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalBaseHT = 0;
  let totalTVA = 0;

  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalBaseHT += montantHT;
    if (line.tvaPct) {
      totalTVA += montantHT * (line.tvaPct / 100);
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA;
  doc.netAPayer = doc.totalTTC;
}
