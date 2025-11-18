import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import MouvementStock from '@/lib/models/MouvementStock';
import Product from '@/lib/models/Product';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const categorie = searchParams.get('categorie');
    const lowStock = searchParams.get('lowStock') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build product filter
    const productFilter: any = { tenantId, estStocke: true, actif: true };
    if (q) {
      productFilter.$or = [
        { nom: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { referenceClient: { $regex: q, $options: 'i' } },
      ];
    }
    if (categorie) {
      productFilter.categorieCode = categorie.toUpperCase();
    }

    // Get all stocked products
    const products = await (Product as any).find(productFilter).lean();
    const productIds = products.map((p: any) => p._id.toString());

    // Calculate current stock for each product
    const stockAggregation = await (MouvementStock as any).aggregate([
      {
        $match: {
          societeId: tenantId,
          productId: { $in: productIds },
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

    // Create a map of stock by productId
    const stockMap = new Map();
    stockAggregation.forEach((item: any) => {
      const stockActuel = item.totalEntree - item.totalSortie + (item.totalInventaire || 0);
      stockMap.set(item._id.toString(), {
        stockActuel,
        totalEntree: item.totalEntree,
        totalSortie: item.totalSortie,
        totalInventaire: item.totalInventaire,
      });
    });

    // Combine products with stock data
    let stockItems = products.map((product: any) => {
      const productId = product._id.toString();
      const stockData = stockMap.get(productId) || {
        stockActuel: 0,
        totalEntree: 0,
        totalSortie: 0,
        totalInventaire: 0,
      };

      return {
        ...product,
        stockActuel: stockData.stockActuel,
        totalEntree: stockData.totalEntree,
        totalSortie: stockData.totalSortie,
        totalInventaire: stockData.totalInventaire,
        uomStock: product.uomStockCode || product.uomVenteCode || 'PCE',
      };
    });

    // Filter low stock if requested
    if (lowStock) {
      stockItems = stockItems.filter((item: any) => {
        const min = item.min || 0;
        return item.stockActuel <= min;
      });
    }

    // Sort by stock (lowest first if lowStock filter, otherwise by name)
    stockItems.sort((a: any, b: any) => {
      if (lowStock) {
        return a.stockActuel - b.stockActuel;
      }
      return a.nom.localeCompare(b.nom);
    });

    // Pagination
    const total = stockItems.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = stockItems.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      items: paginatedItems,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Erreur GET /api/stock:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}






