import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import Product from '@/lib/models/Product';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;
    const tenantId = session.user.companyId?.toString() || '';

    const order = await (PurchaseOrder as any).findOne({ 
      _id: id, 
      societeId: tenantId
    }).lean();

    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    // Enrich lines with product data
    for (const line of order.lignes) {
      if (line.productId) {
        const product = await (Product as any).findOne({ _id: line.productId, tenantId }).lean();
        if (product) {
          line.reference = line.reference || product.referenceClient || product.sku || '';
        }
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Erreur GET /purchases/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = await params;
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    const order = await (PurchaseOrder as any).findOne({ _id: id, societeId: tenantId });
    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    // Clean lines: set default unite if empty
    const cleanedBody = body.lignes ? {
      ...body,
      lignes: body.lignes.map((line: any) => ({
        ...line,
        unite: line.unite || 'PCE'
      }))
    } : body;

    // Update fields
    Object.assign(order, cleanedBody);

    // Calculate totals
    calculatePurchaseOrderTotals(order);

    await (order as any).save();

    return NextResponse.json(order);
  } catch (error) {
    console.error('Erreur PATCH /purchases/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    const order = await (PurchaseOrder as any).findOne({ _id: id, societeId: tenantId });
    if (!order) {
      return NextResponse.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    await (order as any).deleteOne();

    return NextResponse.json({ message: 'Commande supprimée' });
  } catch (error) {
    console.error('Erreur DELETE /purchases/orders/[id]:', error);
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

