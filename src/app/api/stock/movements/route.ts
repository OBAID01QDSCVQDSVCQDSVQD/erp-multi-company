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
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type'); // 'ENTREE' | 'SORTIE' | 'INVENTAIRE'
    const source = searchParams.get('source'); // 'BR' | 'BL' | 'INV' | 'AJUST' | 'TRANSFERT' | 'AUTRE'
    const productId = searchParams.get('productId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const q = searchParams.get('q'); // Search by product name or SKU

    // Build filter
    const filter: any = { societeId: tenantId };

    if (type) {
      filter.type = type;
    }

    if (source) {
      filter.source = source;
    }

    if (productId) {
      filter.productId = productId;
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        filter.date.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const dateToEnd = new Date(dateTo);
        dateToEnd.setHours(23, 59, 59, 999);
        filter.date.$lte = dateToEnd;
      }
    }

    // If search query, first find matching products
    if (q) {
      const productFilter: any = { tenantId };
      productFilter.$or = [
        { nom: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
        { referenceClient: { $regex: q, $options: 'i' } },
      ];
      const matchingProducts = await (Product as any).find(productFilter).select('_id').lean();
      const productIds = matchingProducts.map((p: any) => {
        // Handle both ObjectId and string
        const id = p._id;
        return id instanceof mongoose.Types.ObjectId ? id.toString() : id;
      });
      
      if (productIds.length > 0) {
        filter.productId = { $in: productIds };
      } else {
        // No matching products, return empty result
        return NextResponse.json({
          movements: [],
          total: 0,
          page,
          limit,
        });
      }
    }
    

    // Get total count
    const total = await (MouvementStock as any).countDocuments(filter);

    // Get movements with pagination
    // Note: productId is stored as string in MouvementStock, so we need to manually populate
    const movements = await (MouvementStock as any)
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get unique product IDs
    const productIds = Array.from(new Set(movements.map((m: any) => m.productId).filter(Boolean)));
    
    // Fetch products
    const products = await (Product as any).find({
      _id: { $in: productIds.map((id: string) => {
        // Convert string to ObjectId if valid
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      }) },
    }).select('_id nom sku uomStockCode uomVenteCode referenceClient').lean();
    
    // Create product map
    const productMap = new Map();
    products.forEach((p: any) => {
      const id = p._id instanceof mongoose.Types.ObjectId ? p._id.toString() : p._id;
      productMap.set(id, p);
    });

    // Format movements
    const formattedMovements = movements.map((movement: any) => {
      const product = productMap.get(movement.productId);
      return {
        _id: movement._id.toString(),
        productId: movement.productId,
        productName: product?.nom || 'Produit supprimé',
        productSku: product?.sku || '-',
        productUom: product?.uomStockCode || product?.uomVenteCode || 'PCE',
        type: movement.type,
        qte: movement.qte,
        date: movement.date,
        source: movement.source,
        sourceId: movement.sourceId,
        notes: movement.notes,
        createdBy: movement.createdBy,
        createdAt: movement.createdAt,
        updatedAt: movement.updatedAt,
      };
    });

    return NextResponse.json({
      movements: formattedMovements,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Erreur GET /api/stock/movements:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

