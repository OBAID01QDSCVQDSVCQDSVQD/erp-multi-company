import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import MouvementStock from '@/lib/models/MouvementStock';
import Product from '@/lib/models/Product';
import Document from '@/lib/models/Document';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import Reception from '@/lib/models/Reception';
import Customer from '@/lib/models/Customer';
import Supplier from '@/lib/models/Supplier';
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

    // Restrict to stockable products only (estStocke !== false)
    const stockableProducts = await (Product as any).find({
      tenantId,
      $or: [
        { estStocke: { $exists: false } },
        { estStocke: true }
      ]
    }).select('_id').lean();

    const stockableIds = stockableProducts.map((p: any) => {
      const id = p._id;
      return id instanceof mongoose.Types.ObjectId ? id.toString() : id;
    });

    if (stockableIds.length === 0) {
      return NextResponse.json({
        movements: [],
        total: 0,
        page,
        limit,
      });
    }

    const stockableIdSet = new Set(stockableIds);

    if (!filter.productId) {
      filter.productId = { $in: stockableIds };
    } else if (typeof filter.productId === 'string') {
      if (!stockableIdSet.has(filter.productId)) {
        return NextResponse.json({
          movements: [],
          total: 0,
          page,
          limit,
        });
      }
    } else if (filter.productId.$in) {
      const intersection = filter.productId.$in.filter((id: string) => stockableIdSet.has(id));
      if (intersection.length === 0) {
        return NextResponse.json({
          movements: [],
          total: 0,
          page,
          limit,
        });
      }
      filter.productId.$in = intersection;
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
    }).select('_id nom sku uomStockCode uomVenteCode referenceClient estStocke').lean();
    
    // Create product map
    const productMap = new Map();
    products.forEach((p: any) => {
      const id = p._id instanceof mongoose.Types.ObjectId ? p._id.toString() : p._id;
      productMap.set(id, p);
    });

    // Separate source IDs by type
    const documentSourceIds = Array.from(new Set(
      movements
        .filter((m: any) => m.sourceId && (m.source === 'BL' || (m.source === 'FAC' && m.type === 'SORTIE')))
        .map((m: any) => m.sourceId)
    ));

    const receptionSourceIds = Array.from(new Set(
      movements
        .filter((m: any) => m.sourceId && m.source === 'BR')
        .map((m: any) => m.sourceId)
    ));

    const purchaseInvoiceSourceIds = Array.from(new Set(
      movements
        .filter((m: any) => m.sourceId && m.source === 'FAC' && m.type === 'ENTREE')
        .map((m: any) => m.sourceId)
    ));

    // Fetch documents (BL, BR, FAC sales)
    const documents = documentSourceIds.length > 0 ? await (Document as any).find({
      _id: { $in: documentSourceIds.map((id: string) => {
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      }) },
      tenantId,
    }).select('_id type customerId supplierId').lean() : [];

    const documentMap = new Map();
    documents.forEach((doc: any) => {
      const id = doc._id instanceof mongoose.Types.ObjectId ? doc._id.toString() : doc._id;
      documentMap.set(id, { ...doc, isDocument: true });
    });

    // Fetch receptions (BR)
    const receptions = receptionSourceIds.length > 0 ? await (Reception as any).find({
      _id: { $in: receptionSourceIds.map((id: string) => {
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      }) },
      societeId: tenantId,
    }).select('_id fournisseurId').lean() : [];

    receptions.forEach((reception: any) => {
      const id = reception._id instanceof mongoose.Types.ObjectId ? reception._id.toString() : reception._id;
      documentMap.set(id, { ...reception, isReception: true });
    });

    // Fetch purchase invoices (FAC purchase)
    const purchaseInvoices = purchaseInvoiceSourceIds.length > 0 ? await (PurchaseInvoice as any).find({
      _id: { $in: purchaseInvoiceSourceIds.map((id: string) => {
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      }) },
      societeId: tenantId,
    }).select('_id fournisseurId').lean() : [];

    purchaseInvoices.forEach((invoice: any) => {
      const id = invoice._id instanceof mongoose.Types.ObjectId ? invoice._id.toString() : invoice._id;
      documentMap.set(id, { ...invoice, isPurchaseInvoice: true });
    });

    // Get unique customer IDs and supplier IDs
    const customerIds = Array.from(new Set(
      Array.from(documentMap.values())
        .filter((d: any) => d.customerId)
        .map((d: any) => d.customerId)
    ));
    const supplierIds = Array.from(new Set([
      ...Array.from(documentMap.values())
        .filter((d: any) => d.supplierId)
        .map((d: any) => d.supplierId),
      ...Array.from(documentMap.values())
        .filter((d: any) => d.fournisseurId)
        .map((d: any) => d.fournisseurId),
    ].filter(Boolean)));

    // Fetch customers
    const customers = customerIds.length > 0 ? await (Customer as any).find({
      _id: { $in: customerIds.map((id: string) => {
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      }) },
      tenantId,
    }).select('_id raisonSociale nom prenom').lean() : [];

    const customerMap = new Map();
    customers.forEach((c: any) => {
      const id = c._id instanceof mongoose.Types.ObjectId ? c._id.toString() : c._id;
      const name = c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim() || 'Client inconnu';
      customerMap.set(id, name);
    });

    // Fetch suppliers
    const suppliers = supplierIds.length > 0 ? await (Supplier as any).find({
      _id: { $in: supplierIds.map((id: string) => {
        return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
      }) },
      tenantId,
    }).select('_id raisonSociale nom prenom').lean() : [];

    const supplierMap = new Map();
    suppliers.forEach((s: any) => {
      const id = s._id instanceof mongoose.Types.ObjectId ? s._id.toString() : s._id;
      const name = s.raisonSociale || `${s.nom || ''} ${s.prenom || ''}`.trim() || 'Fournisseur inconnu';
      supplierMap.set(id, name);
    });

    // Format movements
    const formattedMovements = movements
      .map((movement: any) => {
      const product = productMap.get(movement.productId);
        if (product && product.estStocke === false) {
          return null; // Skip services
        }
      const document = movement.sourceId ? documentMap.get(movement.sourceId) : null;
      
      // Determine reference name based on type and source
      let referenceName = movement.sourceId || '-';
      if (document) {
        // For Sortie (BL or FAC sales invoice), show customer name
        if (movement.type === 'SORTIE' && (movement.source === 'BL' || (movement.source === 'FAC' && document.isDocument && document.type === 'FAC'))) {
          if (document.customerId) {
            referenceName = customerMap.get(document.customerId) || movement.sourceId || '-';
          }
        } 
        // For Entree (BR or FAC purchase invoice), show supplier name
        else if (movement.type === 'ENTREE') {
          if (movement.source === 'BR' && document.isReception && document.fournisseurId) {
            referenceName = supplierMap.get(document.fournisseurId) || movement.sourceId || '-';
          } else if (movement.source === 'FAC' && document.isPurchaseInvoice && document.fournisseurId) {
            referenceName = supplierMap.get(document.fournisseurId) || movement.sourceId || '-';
          }
        }
      }

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
        referenceName,
        notes: movement.notes,
        createdBy: movement.createdBy,
        createdAt: movement.createdAt,
        updatedAt: movement.updatedAt,
        };
      })
      .filter((movement): movement is Record<string, any> => movement !== null);

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

