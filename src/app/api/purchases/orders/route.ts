import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
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
    const statut = searchParams.get('statut');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { societeId: tenantId };
    if (supplierId) query.fournisseurId = supplierId;
    if (statut) query.statut = statut;

    const orders = await (PurchaseOrder as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (PurchaseOrder as any).countDocuments(query);

    return NextResponse.json({ items: orders, total });
  } catch (error) {
    console.error('Erreur GET /purchases/orders:', error);
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
    const numero = await NumberingService.next(tenantId, 'ca');

    // Clean lines: set default unite if empty
    const cleanedBody = {
      ...body,
      lignes: body.lignes?.map((line: any) => ({
        ...line,
        unite: line.unite || 'PCE'
      }))
    };

    const order = new PurchaseOrder({
      ...cleanedBody,
      societeId: tenantId,
      numero,
      createdBy: session.user.email
    });

    calculatePurchaseOrderTotals(order);
    await (order as any).save();

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /purchases/orders:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculatePurchaseOrderTotals(po: any) {
  let totalBaseHT = 0;
  let totalRemise = 0;
  let totalTVA = 0;

  po.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixAvantRemise = line.prixUnitaireHT * line.quantite;
    const montantRemise = prixAvantRemise * (remise / 100);
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    
    // Calculate line totals
    line.totalLigneHT = Math.round(montantHT * 100) / 100;
    
    const tvaPct = line.tvaPct || 0;
    const tvaAmount = montantHT * (tvaPct / 100);
    line.totalLigneTVA = Math.round(tvaAmount * 100) / 100;
    line.totalLigneTTC = Math.round((montantHT + tvaAmount) * 100) / 100;
    
    totalBaseHT += montantHT;
    totalRemise += montantRemise;
    totalTVA += tvaAmount;
  });

  po.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  po.totalRemise = Math.round(totalRemise * 100) / 100;
  po.totalTVA = Math.round(totalTVA * 100) / 100;
  
  const timbreFiscal = po.timbreFiscal || 0;
  po.totalTTC = po.totalBaseHT + po.totalTVA + timbreFiscal;
}
