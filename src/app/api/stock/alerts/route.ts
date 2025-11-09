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
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const alertType = searchParams.get('alertType'); // 'low' | 'out' | 'all'
    const q = searchParams.get('q'); // Search by product name or SKU

    // Build product filter - only stocked products
    const productFilter: any = { 
      tenantId, 
      estStocke: true, 
      actif: true 
    };

    if (q) {
      productFilter.$or = [
        { nom: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { referenceClient: { $regex: q, $options: 'i' } },
      ];
    }

    // Get all stocked products that have a minimum threshold defined
    const products = await (Product as any).find(productFilter).lean();
    const productIds = products.map((p: any) => {
      const id = p._id;
      return id instanceof mongoose.Types.ObjectId ? id.toString() : id;
    });

    if (productIds.length === 0) {
      return NextResponse.json({
        alerts: [],
        total: 0,
        page,
        limit,
        stats: {
          total: 0,
          low: 0,
          out: 0,
        },
      });
    }

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
      stockMap.set(item._id.toString(), stockActuel);
    });

    // Combine products with stock data and filter for alerts
    let alerts = products
      .map((product: any) => {
        const productId = product._id.toString();
        const stockActuel = stockMap.get(productId) || 0;
        const min = product.min;

        // Only include products with min defined
        if (min === undefined || min === null) {
          return null;
        }

        // Determine alert status
        let status: 'normal' | 'low' | 'out' = 'normal';
        if (stockActuel <= 0) {
          status = 'out';
        } else if (stockActuel <= min) {
          status = 'low';
        } else {
          return null; // No alert needed
        }

        // Apply alert type filter
        if (alertType === 'low' && status !== 'low') {
          return null;
        }
        if (alertType === 'out' && status !== 'out') {
          return null;
        }

        return {
          _id: productId,
          productId: productId,
          sku: product.sku,
          nom: product.nom,
          referenceClient: product.referenceClient,
          categorieCode: product.categorieCode,
          uomStock: product.uomStockCode || product.uomVenteCode || 'PCE',
          stockActuel,
          min,
          max: product.max,
          status,
          diff: stockActuel - min, // Negative means below threshold
          leadTimeJours: product.leadTimeJours,
          prixAchatRef: product.prixAchatRef,
          devise: product.devise || 'TND',
        };
      })
      .filter((item: any) => item !== null);

    // Sort by status (out first, then low) and then by stock (lowest first)
    alerts.sort((a: any, b: any) => {
      if (a.status !== b.status) {
        if (a.status === 'out') return -1;
        if (b.status === 'out') return 1;
        if (a.status === 'low') return -1;
        if (b.status === 'low') return 1;
      }
      return a.stockActuel - b.stockActuel;
    });

    // Calculate statistics
    const stats = {
      total: alerts.length,
      low: alerts.filter((a: any) => a.status === 'low').length,
      out: alerts.filter((a: any) => a.status === 'out').length,
    };

    // Pagination
    const total = alerts.length;
    const startIndex = (page - 1) * limit;
    const paginatedAlerts = alerts.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      alerts: paginatedAlerts,
      total,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error('Erreur GET /api/stock/alerts:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

