import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import { NumberingService } from '@/lib/services/NumberingService';

export async function POST(
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

    const tenantId = session.user.companyId?.toString() || '';

    const order = await (Document as any).findOne({ 
      _id: params.id, 
      tenantId, 
      type: 'PO' 
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Commande d\'achat non trouvée' },
        { status: 404 }
      );
    }

    const numero = await NumberingService.next(tenantId, 'br');

    const lignes = body.lignes.map((item: any) => {
      const originalLine = (order.lignes as any).id(item.lineId);
      return {
        ...originalLine.toObject(),
        quantite: item.qty,
        sourceLineId: item.lineId
      };
    });

    const receipt = new (Document as any)({
      tenantId,
      type: 'BR',
      numero,
      dateDoc: new Date(),
      statut: 'brouillon',
      supplierId: order.supplierId,
      referenceExterne: order.referenceExterne,
      dateLivraisonReelle: new Date(),
      lignes,
      devise: order.devise,
      moyenTransport: order.moyenTransport,
      notes: order.notes,
      createdBy: session.user.email,
      linkedDocuments: [order._id.toString()]
    });

    calculateDocumentTotals(receipt);
    await (receipt as any).save();

    order.lignes.forEach((line: any) => {
      const qtyItem = body.lignes.find((item: any) => item.lineId === line._id.toString());
      if (qtyItem) {
        line.qtyRecue = (line.qtyRecue || 0) + qtyItem.qty;
      }
    });
    await (order as any).save();

    return NextResponse.json({ order, receipt }, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /purchases/orders/:id/to-receipt:', error);
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
