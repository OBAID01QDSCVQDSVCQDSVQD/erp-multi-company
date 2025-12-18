import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Reception from '@/lib/models/Reception';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import MouvementStock from '@/lib/models/MouvementStock';

export async function POST(
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

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    // Find reception
    const reception = await (Reception as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!reception) {
      return NextResponse.json(
        { error: 'Bon de réception non trouvé' },
        { status: 404 }
      );
    }

    if (reception.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être validés' },
        { status: 400 }
      );
    }

    // Validate qteRecue >= 0 and at least one line with qteRecue > 0
    if (!reception.lignes || reception.lignes.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une ligne est requise' },
        { status: 400 }
      );
    }

    const hasQteRecue = reception.lignes.some((ligne: any) => ligne.qteRecue > 0);
    if (!hasQteRecue) {
      return NextResponse.json(
        { error: 'Au moins une quantité reçue doit être supérieure à 0' },
        { status: 400 }
      );
    }

    for (const ligne of reception.lignes) {
      if (ligne.qteRecue < 0) {
        return NextResponse.json(
          { error: 'La quantité reçue ne peut pas être négative' },
          { status: 400 }
        );
      }
    }

    // Create stock movements for each line with qteRecue > 0
    const stockMovements = [];
    for (const ligne of reception.lignes) {
      if (ligne.qteRecue > 0 && ligne.productId) {
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: ligne.productId,
          type: 'ENTREE',
          qte: ligne.qteRecue,
          date: reception.dateDoc || new Date(),
          source: 'BR',
          sourceId: id,
          notes: `Réception ${reception.numero} - ${ligne.designation || ''}`,
          createdBy: session.user.email,
        });
        stockMovements.push(mouvement);
      }
    }

    // Save all stock movements
    if (stockMovements.length > 0) {
      await (MouvementStock as any).insertMany(stockMovements);
    }

    // Update purchase order status if purchaseOrderId is provided
    if (reception.purchaseOrderId) {
      await updatePurchaseOrderReceptionProgress(reception.purchaseOrderId, tenantId);
    }

    // Update reception status to VALIDE
    const updatedReception = await (Reception as any).findOneAndUpdate(
      { _id: id, societeId: tenantId },
      { $set: { statut: 'VALIDE' } },
      { new: true }
    );

    return NextResponse.json({
      message: 'Bon de réception validé avec succès',
      reception: updatedReception,
    });
  } catch (error) {
    console.error('Erreur POST /purchases/receptions/[id]/valider:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

async function updatePurchaseOrderReceptionProgress(purchaseOrderId: string, tenantId: string) {
  try {
    const purchaseOrder = await (PurchaseOrder as any).findOne({
      _id: purchaseOrderId,
      societeId: tenantId,
    });

    if (!purchaseOrder) {
      return;
    }

    // Get all receptions for this purchase order
    const receptions = await (Reception as any).find({
      purchaseOrderId,
      societeId: tenantId,
      statut: 'VALIDE',
    }).lean();

    // Calculate total received quantities per product
    const qteRecueByProduct: { [key: string]: number } = {};

    receptions.forEach((reception: any) => {
      reception.lignes.forEach((ligne: any) => {
        if (ligne.productId && ligne.qteRecue > 0) {
          const key = ligne.productId.toString();
          qteRecueByProduct[key] = (qteRecueByProduct[key] || 0) + ligne.qteRecue;
        }
      });
    });

    // Check if all lines are fully received
    let allFullyReceived = true;
    let hasPartialReception = false;

    purchaseOrder.lignes.forEach((line: any) => {
      const productId = line.productId?.toString();
      if (productId) {
        const qteRecue = qteRecueByProduct[productId] || 0;
        if (qteRecue > 0 && qteRecue < line.quantite) {
          allFullyReceived = false;
          hasPartialReception = true;
        } else if (qteRecue > 0 && qteRecue >= line.quantite) {
          hasPartialReception = true;
        } else if (qteRecue === 0) {
          allFullyReceived = false;
        }
      }
    });

    // Update purchase order status
    let newStatus = purchaseOrder.statut;
    if (allFullyReceived && hasPartialReception) {
      newStatus = 'CLOTUREE';
    } else if (hasPartialReception) {
      newStatus = 'RECEPTION_PARTIELLE';
    }

    if (newStatus !== purchaseOrder.statut) {
      await (PurchaseOrder as any).findOneAndUpdate(
        { _id: purchaseOrderId, societeId: tenantId },
        { $set: { statut: newStatus } }
      );
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut du bon de commande:', error);
    // Don't throw error, just log it
  }
}








