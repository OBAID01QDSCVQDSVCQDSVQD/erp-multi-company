import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/lib/models/Project';
import MouvementStock from '@/lib/models/MouvementStock';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    const project = await (Project as any).findOne({
      _id: params.id,
      tenantId,
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Projet non trouvé' },
        { status: 404 }
      );
    }

    // Get linked BL IDs
    const blIds = project.blIds?.map((bl: any) => bl._id?.toString() || bl.toString()) || [];
    
    // Get stock movements for this project
    const stockMovements = await (MouvementStock as any)
      .find({
        societeId: tenantId,
        $or: [
          { projectId: params.id },
          { source: 'BL', sourceId: { $in: blIds } }
        ],
        type: 'SORTIE', // Only outgoing movements (consumption)
      })
      .sort('-createdAt')
      .lean();
    
    // If no stock movements but BLs are linked, get products directly from BLs
    const Document = (await import('@/lib/models/Document')).default;
    const Product = (await import('@/lib/models/Product')).default;
    
    let productsFromBLs: any[] = [];
    if (blIds.length > 0) {
      const bls = await (Document as any).find({
        _id: { $in: blIds },
        tenantId,
        type: 'BL',
      }).lean();
      
      for (const bl of bls) {
        if (bl.lignes && bl.lignes.length > 0) {
          for (const line of bl.lignes) {
            if (line.productId && line.quantite > 0) {
              const productId = line.productId.toString();
              const existing = productsFromBLs.find(p => p.productId === productId && p.blId === bl._id.toString());
              
              if (!existing) {
                productsFromBLs.push({
                  productId: productId,
                  blId: bl._id.toString(),
                  blNumero: bl.numero,
                  quantity: line.quantite,
                  dateDoc: bl.dateDoc || bl.date || bl.createdAt,
                  prixUnitaireHT: line.prixUnitaireHT || 0,
                });
              }
            }
          }
        }
      }
    }
    
    // Get all product IDs (from movements and BLs)
    const allProductIds = [
      ...new Set([
        ...stockMovements.map((m: any) => m.productId?.toString()).filter(Boolean),
        ...productsFromBLs.map((p: any) => p.productId).filter(Boolean),
      ])
    ];
    
    const products = allProductIds.length > 0 ? await (Product as any).find({
      _id: { $in: allProductIds },
      tenantId,
    }).lean() : [];
    
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    // Group by product and calculate totals
    const groupedProducts = new Map();
    
    // Process stock movements
    stockMovements.forEach((movement: any) => {
      const productId = movement.productId?.toString();
      if (!productId) return;

      const product = productMap.get(productId) as any;
      if (!product) return;

      if (!groupedProducts.has(productId)) {
        groupedProducts.set(productId, {
          productId: productId,
          product: {
            _id: product._id,
            nom: product.nom,
            sku: product.sku,
            prixAchatRef: product.prixAchatRef,
            prixVenteHT: product.prixVenteHT,
            tvaPct: product.tvaPct,
            devise: product.devise,
          },
          quantity: 0,
          totalCost: 0,
          movements: [],
        });
      }

      const item = groupedProducts.get(productId);
      const costHT = product.prixAchatRef || product.prixVenteHT || 0;
      const tvaPct = product.tvaPct || 0;
      const costTTC = costHT * (1 + tvaPct / 100);
      const quantity = movement.qte || 0;
      
      if (item) {
        item.quantity += quantity;
        item.totalCost += costHT * quantity;
        item.movements.push({
          _id: movement._id,
          date: movement.date || movement.createdAt,
          quantity: quantity,
          unitCostHT: costHT,
          unitCostTTC: costTTC,
          documentNumero: movement.sourceId,
          documentType: movement.source,
        });
      }
    });
    
    // Process products from BLs (if not already in movements)
    productsFromBLs.forEach((blProduct: any) => {
      const productId = blProduct.productId;
      const product = productMap.get(productId) as any;
      if (!product) return;
      
      // Check if already processed from movements
      if (!groupedProducts.has(productId)) {
        groupedProducts.set(productId, {
          productId: productId,
          product: {
            _id: product._id,
            nom: product.nom,
            sku: product.sku,
            prixAchatRef: product.prixAchatRef,
            prixVenteHT: product.prixVenteHT,
            tvaPct: product.tvaPct,
            devise: product.devise,
          },
          quantity: 0,
          totalCost: 0,
          movements: [],
        });
      }
      
      const item = groupedProducts.get(productId);
      const costHT = blProduct.prixUnitaireHT || product.prixAchatRef || product.prixVenteHT || 0;
      const tvaPct = product.tvaPct || 0;
      const costTTC = costHT * (1 + tvaPct / 100);
      const quantity = blProduct.quantity || 0;
      
      // Only add if not already counted from movements
      const alreadyCounted = item?.movements.some((m: any) => 
        m.documentNumero === blProduct.blId && m.documentType === 'BL'
      );
      
      if (!alreadyCounted && item) {
        item.quantity += quantity;
        item.totalCost += costHT * quantity;
        item.movements.push({
          _id: `bl-${blProduct.blId}-${productId}`,
          date: blProduct.dateDoc,
          quantity: quantity,
          unitCostHT: costHT,
          unitCostTTC: costTTC,
          documentNumero: blProduct.blNumero,
          documentType: 'BL',
        });
      }
    });

    const productsList = Array.from(groupedProducts.values());

    return NextResponse.json({
      products: productsList,
      total: productsList.reduce((sum, p) => sum + p.totalCost, 0),
    });
  } catch (error: any) {
    console.error('Error fetching project products:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}

