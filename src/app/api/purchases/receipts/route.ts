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

    const query: any = { tenantId, type: 'BR' };
    if (supplierId) query.supplierId = supplierId;

    const receipts = await (Document as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Document as any).countDocuments(query);

    return NextResponse.json({ items: receipts, total });
  } catch (error) {
    console.error('Erreur GET /purchases/receipts:', error);
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
    const numero = await NumberingService.next(tenantId, 'br');

    // === WAREHOUSE RESOLUTION ===
    let warehouseId = body.warehouseId;
    if (!warehouseId) {
      const Warehouse = (await import('@/lib/models/Warehouse')).default;
      // Find default warehouse
      const defaultWh = await (Warehouse as any).findOne({ tenantId, isDefault: true }).lean();
      if (defaultWh) {
        warehouseId = defaultWh._id;
      } else {
        // Fallback: Find ANY warehouse
        const anyWh = await (Warehouse as any).findOne({ tenantId }).lean();
        if (anyWh) warehouseId = anyWh._id;
      }
    }
    const warehouseIdStr = warehouseId ? warehouseId.toString() : undefined;

    const receipt = new Document({
      ...body,
      tenantId,
      type: 'BR',
      numero,
      statut: 'VALIDEE', // Auto-validate for now to trigger stock
      warehouseId: warehouseIdStr,
      createdBy: session.user.email
    });

    calculateDocumentTotals(receipt);
    await (receipt as any).save();

    // Create stock movements (ENTREE)
    await createStockMovementsForReceipt(receipt, tenantId, session.user.email, warehouseIdStr);

    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /purchases/receipts:', error);
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

async function createStockMovementsForReceipt(
  receipt: any,
  tenantId: string,
  createdBy: string,
  warehouseId?: string
): Promise<void> {
  if (!receipt.lignes || receipt.lignes.length === 0) return;

  const MouvementStock = (await import('@/lib/models/MouvementStock')).default;
  const Product = (await import('@/lib/models/Product')).default;
  const mongoose = (await import('mongoose')).default;

  const dateDoc = receipt.dateDoc || new Date();
  const receiptId = receipt._id.toString();
  const warehouseObjectId = warehouseId ? new mongoose.Types.ObjectId(warehouseId) : undefined;

  for (const line of receipt.lignes) {
    if (!line.productId || !line.quantite || line.quantite <= 0) continue;

    // Check if product is stockable
    try {
      const product = await (Product as any).findOne({ _id: line.productId, tenantId }).lean();
      if (!product || product.estStocke === false) continue;

      // Create ENTREE movement
      await (MouvementStock as any).create({
        societeId: tenantId,
        productId: line.productId,
        warehouseId: warehouseObjectId,
        type: 'ENTREE',
        qte: line.quantite,
        date: dateDoc,
        source: 'BR',
        sourceId: receiptId,
        notes: `Bon de réception ${receipt.numero}`,
        createdBy
      });

    } catch (e) {
      console.error(`Error creating stock movement for receipt line ${line.productId}`, e);
    }
  }
}
