import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const { id } = await params;
    const delivery = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'BL'
    }).lean();

    if (!delivery) {
      return NextResponse.json(
        { error: 'Bon de livraison non trouvé' },
        { status: 404 }
      );
    }

    // Enrich lines with product data if needed
    if (delivery.lignes && Array.isArray(delivery.lignes)) {
      delivery.lignes = await Promise.all(
        delivery.lignes.map(async (line: any) => {
          if (line.productId) {
            try {
              const product = await (Product as any).findOne({ _id: line.productId, tenantId }).lean();
              if (product) {
                line.estStocke = (product as any).estStocke;
                line.descriptionProduit = (product as any).description;
              }
            } catch (error) {
              console.error('Error fetching product for enrichment:', error);
            }
          }
          return line;
        })
      );
    }

    return NextResponse.json(delivery);
  } catch (error) {
    console.error('Erreur GET /sales/deliveries/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const { id } = await params;
    const delivery = await (Document as any).findOne({ _id: id, tenantId, type: 'BL' });

    if (!delivery) {
      return NextResponse.json(
        { error: 'Bon de livraison non trouvé' },
        { status: 404 }
      );
    }

    // Store old lines for stock movement updates
    const oldLignes = delivery.lignes ? JSON.parse(JSON.stringify(delivery.lignes)) : [];

    // Update fields
    Object.assign(delivery, body);

    // Recalculate totals
    calculateDocumentTotals(delivery);

    await (delivery as any).save();

    // Update stock movements for stored products
    await updateStockMovementsForDelivery(
      delivery,
      oldLignes,
      tenantId,
      session.user.email
    );

    return NextResponse.json(delivery);
  } catch (error) {
    console.error('Erreur PATCH /sales/deliveries/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const headerTenant = request.headers.get('X-Tenant-Id') || '';
    const tenantId = headerTenant || session.user.companyId?.toString() || '';

    const { id } = await params;
    const delivery = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'BL'
    });

    if (!delivery) {
      return NextResponse.json(
        { error: 'Bon de livraison non trouvé' },
        { status: 404 }
      );
    }

    // Delete stock movements associated with this delivery
    await (MouvementStock as any).deleteMany({
      societeId: tenantId,
      source: 'BL',
      sourceId: id,
    });

    // Delete the delivery
    await (delivery as any).deleteOne();

    return NextResponse.json({ message: 'Bon de livraison supprimé', delivery });
  } catch (error) {
    console.error('Erreur DELETE /sales/deliveries/:id:', error);
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
  
  // Add timbre fiscal if it exists in the document
  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA + timbreFiscal;
  doc.netAPayer = doc.totalTTC;
}

// Helper function to update stock movements for delivery note
async function updateStockMovementsForDelivery(
  delivery: any,
  oldLignes: any[],
  tenantId: string,
  createdBy: string
): Promise<void> {
  const dateDoc = delivery.dateDoc || new Date();
  const deliveryId = delivery._id.toString();

  // Get current lines
  const currentLignes = delivery.lignes || [];

  // Create a map of old lines by productId
  const oldLinesMap = new Map();
  oldLignes.forEach((line: any) => {
    if (line.productId) {
      oldLinesMap.set(line.productId.toString(), line);
    }
  });

  // Create a map of current lines by productId
  const currentLinesMap = new Map();
  currentLignes.forEach((line: any) => {
    if (line.productId) {
      currentLinesMap.set(line.productId.toString(), line);
    }
  });

  // Get all product IDs from both old and new lines
  const allProductIds = Array.from(new Set([
    ...Array.from(oldLinesMap.keys()),
    ...Array.from(currentLinesMap.keys()),
  ]));

  // Process each product
  for (const productId of allProductIds) {
    try {
      const oldLine = oldLinesMap.get(productId);
      const currentLine = currentLinesMap.get(productId);

      // Check if product is stored
      const product = await (Product as any).findOne({
        _id: productId,
        tenantId,
      }).lean();

      if (!product || !product.estStocke) {
        // If product is not stored, delete any existing movements
        if (oldLine) {
          await (MouvementStock as any).deleteMany({
            societeId: tenantId,
            productId,
            source: 'BL',
            sourceId: deliveryId,
          });
        }
        continue;
      }

      // Find existing movement
      const existingMovement = await (MouvementStock as any).findOne({
        societeId: tenantId,
        productId,
        source: 'BL',
        sourceId: deliveryId,
      });

      if (!currentLine || !currentLine.quantite || currentLine.quantite <= 0) {
        // Product was removed or quantity is 0, delete movement
        if (existingMovement) {
          await (existingMovement as any).deleteOne();
        }
      } else {
        // Product exists, update or create movement
        if (existingMovement) {
          // Update existing movement
          existingMovement.qte = currentLine.quantite;
          existingMovement.date = dateDoc;
          await (existingMovement as any).save();
        } else {
          // Create new movement
          const mouvement = new MouvementStock({
            societeId: tenantId,
            productId,
            type: 'SORTIE',
            qte: currentLine.quantite,
            date: dateDoc,
            source: 'BL',
            sourceId: deliveryId,
            notes: `Bon de livraison ${delivery.numero}`,
            createdBy,
          });

          await (mouvement as any).save();
        }
      }
    } catch (error) {
      console.error(`Error updating stock movement for product ${productId}:`, error);
      // Continue processing other products even if one fails
    }
  }
}

