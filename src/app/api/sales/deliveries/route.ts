import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import { NumberingService } from '@/lib/services/NumberingService';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { 
      tenantId, 
      type: 'BL' 
    };
    
    if (customerId) query.customerId = customerId;
    
    let deliveries = await (Document as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Populate customerId manuellement (qu'il soit string ou ObjectId)
    const Customer = (await import('@/lib/models/Customer')).default;
    const customerIds = [
      ...new Set(
        deliveries
          .map((d: any) => d.customerId)
          .filter((id: any) => !!id)
          .map((id: any) => id.toString())
      ),
    ];
    
    if (customerIds.length > 0) {
      const customers = await (Customer as any)
        .find({
          _id: { $in: customerIds },
          tenantId,
        })
        .select('nom prenom raisonSociale')
        .lean();
      
      const customerMap = new Map(customers.map((c: any) => [c._id.toString(), c]));
      
      for (const delivery of deliveries) {
        if (delivery.customerId) {
          const key = delivery.customerId.toString();
          const customer = customerMap.get(key);
          if (customer) {
            delivery.customerId = customer;
          }
        }
      }
    }

    // Filter by search query if provided (after populate to search in customer name)
    let filteredDeliveries = deliveries;
    if (q) {
      const searchLower = q.toLowerCase();
      filteredDeliveries = deliveries.filter((delivery: any) => {
        const matchesNumero = delivery.numero?.toLowerCase().includes(searchLower);
        const customer = delivery.customerId;
        let customerName = '';
        if (customer) {
          if (typeof customer === 'object' && customer !== null) {
            customerName = (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || '').toLowerCase();
          } else if (typeof customer === 'string') {
            // If still a string, try to fetch it
            customerName = '';
          }
        }
        const matchesCustomer = customerName.includes(searchLower);
        return matchesNumero || matchesCustomer;
      });
    }

    const total = q ? filteredDeliveries.length : await (Document as any).countDocuments(query);

    return NextResponse.json({ items: filteredDeliveries, total });
  } catch (error) {
    console.error('Erreur GET /sales/deliveries:', error);
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
    
    // Generate numero
    const numero = await NumberingService.next(tenantId, 'bl');

    const delivery = new Document({
      ...body,
      tenantId,
      type: 'BL',
      numero,
      createdBy: session.user.email
    });

    // Calculate totals
    calculateDocumentTotals(delivery);

    await (delivery as any).save();

    // Find project linked to this BL (if any)
    let projectId = null;
    if (body.projectId) {
      projectId = body.projectId;
    } else {
      // Try to find project by blId
      const Project = (await import('@/lib/models/Project')).default;
      const project = await (Project as any).findOne({
        tenantId,
        blId: delivery._id,
      }).lean();
      if (project) {
        projectId = project._id;
      }
    }

    // Create stock movements for all products
    await createStockMovementsForDelivery(delivery, tenantId, session.user.email, projectId);

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/deliveries:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to calculate document totals
function calculateDocumentTotals(doc: any) {
  let totalBaseHT = 0;
  let totalTVA = 0;
  const taxGroups: { [key: string]: number } = {};

  // Calculate line totals
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalBaseHT += montantHT;

    if (line.tvaPct) {
      const tvaAmount = montantHT * (line.tvaPct / 100);
      totalTVA += tvaAmount;
      
      if (!taxGroups[line.taxCode || 'DEFAULT']) {
        taxGroups[line.taxCode || 'DEFAULT'] = 0;
      }
      taxGroups[line.taxCode || 'DEFAULT'] += tvaAmount;
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  
  // Add timbre fiscal if it exists in the document
  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA + timbreFiscal;
  doc.netAPayer = doc.totalTTC;

  return { totalBaseHT, totalTVA, totalTTC: doc.totalTTC, taxGroups };
}

// Helper function to create stock movements for delivery note
async function createStockMovementsForDelivery(
  delivery: any,
  tenantId: string,
  createdBy: string,
  projectId?: string | null
): Promise<void> {
  if (!delivery.lignes || delivery.lignes.length === 0) {
    return;
  }

  const dateDoc = delivery.dateDoc || new Date();
  const deliveryId = delivery._id.toString();

  for (const line of delivery.lignes) {
    // Skip if no productId or quantity is 0
    if (!line.productId || !line.quantite || line.quantite <= 0) {
      continue;
    }

    try {
      // Convert productId to string for consistency
      const productIdStr = line.productId.toString();
      
      // Find product using ObjectId first, then string
      let product = null;
      try {
        product = await (Product as any).findOne({
          $or: [
            { _id: new mongoose.Types.ObjectId(productIdStr) },
            { _id: productIdStr },
          ],
          tenantId,
        }).lean();
      } catch (err) {
        // If ObjectId conversion fails, try string directly
        product = await (Product as any).findOne({
          _id: productIdStr,
          tenantId,
        }).lean();
      }

      if (!product) {
        console.warn(`[Stock] Product not found for ID: ${productIdStr}`);
        continue;
      }

      if (product.estStocke === false) {
        continue;
      }

      // Check if stock movement already exists for this delivery and product
      const existingMovement = await (MouvementStock as any).findOne({
        societeId: tenantId,
        productId: productIdStr,
        source: 'BL',
        sourceId: deliveryId,
      });

      if (existingMovement) {
        // Update existing movement
        existingMovement.qte = line.quantite;
        existingMovement.date = dateDoc;
        if (projectId) {
          existingMovement.projectId = new mongoose.Types.ObjectId(projectId);
        }
        await (existingMovement as any).save();
      } else {
        // Create new stock movement
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: productIdStr,
          projectId: projectId ? new mongoose.Types.ObjectId(projectId) : undefined,
          type: 'SORTIE',
          qte: line.quantite,
          date: dateDoc,
          source: 'BL',
          sourceId: deliveryId,
          notes: `Bon de livraison ${delivery.numero}`,
          createdBy,
        });

        await (mouvement as any).save();
      }
    } catch (error) {
      console.error(`Error creating stock movement for product ${line.productId}:`, error);
      // Continue processing other lines even if one fails
    }
  }
}
