import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import MouvementStock from '@/lib/models/MouvementStock';
import Warehouse from '@/lib/models/Warehouse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const warehouseId = searchParams.get('warehouseId');
    const { productId } = await params;
    const productIdStr = productId.toString();

    const matchQuery: any = {
      societeId: tenantId,
      productId: productIdStr,
    };

    if (warehouseId) {
      // Check if this is the default warehouse
      const warehouse = await (Warehouse as any).findOne({
        _id: warehouseId,
        tenantId,
      });

      if (warehouse && warehouse.isDefault) {
        // If it's the default warehouse, include movements with this ID OR with no ID (legacy data)
        matchQuery.$or = [
          { warehouseId: new mongoose.Types.ObjectId(warehouseId) },
          { warehouseId: { $exists: false } },
          { warehouseId: null }
        ];
      } else {
        // Strict match for non-default warehouses
        matchQuery.warehouseId = new mongoose.Types.ObjectId(warehouseId);
      }
    }

    // Calculate current stock for the product
    const stockAggregation = await (MouvementStock as any).aggregate([
      {
        $match: matchQuery,
      },
      {
        $group: {
          _id: '$productId',
          totalEntree: {
            $sum: {
              $cond: [{ $eq: ['$type', 'ENTREE'] }, '$qte', 0],
            },
          },
          totalSortie: {
            $sum: {
              $cond: [{ $eq: ['$type', 'SORTIE'] }, '$qte', 0],
            },
          },
          totalInventaire: {
            $sum: {
              $cond: [{ $eq: ['$type', 'INVENTAIRE'] }, '$qte', 0],
            },
          },
        },
      },
    ]);

    const stockData = stockAggregation[0] || {
      totalEntree: 0,
      totalSortie: 0,
      totalInventaire: 0,
    };

    const stockActuel = stockData.totalEntree - stockData.totalSortie + (stockData.totalInventaire || 0);

    return NextResponse.json({
      productId: productIdStr,
      stockActuel,
      totalEntree: stockData.totalEntree || 0,
      totalSortie: stockData.totalSortie || 0,
      totalInventaire: stockData.totalInventaire || 0,
    });
  } catch (error) {
    console.error('Erreur GET /api/stock/product/:productId:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}















