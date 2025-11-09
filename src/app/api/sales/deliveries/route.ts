import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
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
    const customerId = searchParams.get('customerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { 
      tenantId, 
      type: 'BL' 
    };
    
    if (customerId) query.customerId = customerId;

    const deliveries = await (Document as any).find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await (Document as any).countDocuments(query);

    return NextResponse.json({ items: deliveries, total });
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

    // Create stock movements for stored products (estStocke === true)
    await createStockMovementsForDelivery(delivery, tenantId, session.user.email);

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
  createdBy: string
): Promise<void> {
  if (!delivery.lignes || delivery.lignes.length === 0) {
    return;
  }

  const dateDoc = delivery.dateDoc || new Date();
  const deliveryId = delivery._id.toString();

  // Process each line
  for (const line of delivery.lignes) {
    // Skip if no productId or quantity is 0
    if (!line.productId || !line.quantite || line.quantite <= 0) {
      continue;
    }

    try {
      // Check if product is stored (estStocke === true)
      const product = await (Product as any).findOne({
        _id: line.productId,
        tenantId,
      }).lean();

      if (!product || !product.estStocke) {
        continue; // Skip non-stored products
      }

      // Check if stock movement already exists for this delivery and product
      const existingMovement = await (MouvementStock as any).findOne({
        societeId: tenantId,
        productId: line.productId,
        source: 'BL',
        sourceId: deliveryId,
      });

      if (existingMovement) {
        // Update existing movement
        existingMovement.qte = line.quantite;
        existingMovement.date = dateDoc;
        await (existingMovement as any).save();
      } else {
        // Create new stock movement
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: line.productId,
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
