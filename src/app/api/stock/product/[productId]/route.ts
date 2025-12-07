import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import MouvementStock from '@/lib/models/MouvementStock';

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

    const { productId } = await params;
    const productIdStr = productId.toString();

    // Calculate current stock for the product
    const stockAggregation = await (MouvementStock as any).aggregate([
      {
        $match: {
          societeId: tenantId,
          productId: productIdStr,
        },
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











