import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import mongoose from 'mongoose';

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
    const invoice = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'FAC'
    }).lean();

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      );
    }

    // Enrich lines with product data if needed
    if (invoice.lignes && Array.isArray(invoice.lignes)) {
      invoice.lignes = await Promise.all(
        invoice.lignes.map(async (line: any) => {
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

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Erreur GET /sales/invoices/:id:', error);
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
    const invoice = await (Document as any).findOne({ _id: id, tenantId, type: 'FAC' });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      );
    }

    // Store old lines for stock movement updates
    const oldLignes = invoice.lignes ? JSON.parse(JSON.stringify(invoice.lignes)) : [];

    // Handle custom invoice number change
    if (body.numero !== undefined) {
      const requestedNumero = typeof body.numero === 'string' ? body.numero.trim() : '';
      if (!requestedNumero) {
        return NextResponse.json(
          { error: 'Le numéro de facture ne peut pas être vide.' },
          { status: 400 }
        );
      }

      if (requestedNumero !== invoice.numero) {
        const duplicate = await (Document as any).findOne({
          tenantId,
          type: 'FAC',
          numero: requestedNumero,
          _id: { $ne: id },
        });

        if (duplicate) {
          return NextResponse.json(
            { error: 'Ce numéro de facture est déjà utilisé.' },
            { status: 409 }
          );
        }

        invoice.numero = requestedNumero;
      }

      delete body.numero;
    }

    // Update fields
    Object.assign(invoice, body);

    // Recalculate totals
    calculateDocumentTotals(invoice);

    await (invoice as any).save();

    // Update stock movements for stored products
    // Check if invoice is created from BL - if so, do NOT create/update stock movements
    // But if it's from DEVIS, we should update stock movements with new quantities
    const isFromBL = invoice.linkedDocuments && invoice.linkedDocuments.length > 0;
    
    // Check if the linked document is a BL
    let linkedDocIsBL = false;
    if (isFromBL) {
      try {
        const linkedDoc = await (Document as any).findOne({
          _id: invoice.linkedDocuments[0],
          tenantId,
        }).lean();
        if (linkedDoc && linkedDoc.type === 'BL') {
          linkedDocIsBL = true;
        }
      } catch (error) {
        console.error('Error checking linked document type:', error);
      }
    }
    
    if (!linkedDocIsBL) {
      // Update stock movements for invoices from DEVIS or direct creation
      // This ensures quantities in stock movements match the updated invoice quantities
      await updateStockMovementsForInvoice(
        invoice,
        oldLignes,
        tenantId,
        session.user.email
      );
    } else {
      console.log(`[Update Invoice] Skipping stock movements for invoice ${invoice._id} - created from BL`);
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Erreur PATCH /sales/invoices/:id:', error);
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
    const invoice = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'FAC'
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture non trouvée' },
        { status: 404 }
      );
    }

    // Delete stock movements associated with this invoice
    await (MouvementStock as any).deleteMany({
      societeId: tenantId,
      source: 'FAC',
      sourceId: id,
    });

    // Delete the invoice
    await (invoice as any).deleteOne();

    return NextResponse.json({ message: 'Facture supprimée', invoice });
  } catch (error) {
    console.error('Erreur DELETE /sales/invoices/:id:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;

  // Calculate HT after line discounts
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalHTAfterLineDiscount += montantHT;
  });

  // Apply global remise
  const remiseGlobalePct = doc.remiseGlobalePct || 0;
  const totalBaseHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));

  // Calculate TVA after applying global remise
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    // Apply global remise to line HT for TVA calculation
    const montantHTAfterGlobalRemise = montantHT * (1 - (remiseGlobalePct / 100));
    
    if (line.tvaPct) {
      totalTVA += montantHTAfterGlobalRemise * (line.tvaPct / 100);
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  
  // Add timbre fiscal if it exists in the document
  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA + timbreFiscal;
  doc.netAPayer = doc.totalTTC;
}

// Helper function to update stock movements for invoice
async function updateStockMovementsForInvoice(
  invoice: any,
  oldLignes: any[],
  tenantId: string,
  createdBy: string
): Promise<void> {
  const dateDoc = invoice.dateDoc || new Date();
  const invoiceId = invoice._id.toString();

  // Get current lines
  const currentLignes = invoice.lignes || [];

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

      // Convert productId to string for consistency
      const productIdStr = productId.toString();
      
      // Check if product is stored
      // Try to find product using ObjectId first, then string
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
        // Delete any existing movements
        if (oldLine) {
          await (MouvementStock as any).deleteMany({
            societeId: tenantId,
            productId: productIdStr,
            source: 'FAC',
            sourceId: invoiceId,
          });
        }
        continue;
      }

      // Skip services (non-stocked products)
      if (product.estStocke === false) {
        // Ensure any existing movements are removed
        if (oldLine) {
          await (MouvementStock as any).deleteMany({
            societeId: tenantId,
            productId: productIdStr,
            source: 'FAC',
            sourceId: invoiceId,
          });
        }
        continue;
      }

      // Create stock movements for stocked products only

      // Find existing movement
      const existingMovement = await (MouvementStock as any).findOne({
        societeId: tenantId,
        productId: productIdStr,
        source: 'FAC',
        sourceId: invoiceId,
      });

      if (!currentLine || !currentLine.quantite || currentLine.quantite <= 0) {
        // Product was removed or quantity is 0, delete movement
        if (existingMovement) {
          await (existingMovement as any).deleteOne();
        }
      } else {
        // Product exists, update or create movement
        if (existingMovement) {
          // Update existing movement with new quantity from invoice
          const oldQte = existingMovement.qte;
          existingMovement.qte = currentLine.quantite;
          existingMovement.date = dateDoc;
          await (existingMovement as any).save();
          console.log(`[Update Invoice Stock] Updated movement for product ${productIdStr}: ${oldQte} -> ${currentLine.quantite} (invoice ${invoice.numero})`);
        } else {
          // Create new movement with quantity from invoice
          const mouvement = new MouvementStock({
            societeId: tenantId,
            productId: productIdStr, // Ensure it's a string
            type: 'SORTIE',
            qte: currentLine.quantite,
            date: dateDoc,
            source: 'FAC',
            sourceId: invoiceId,
            notes: `Facture ${invoice.numero}`,
            createdBy,
          });

          await (mouvement as any).save();
          console.log(`[Update Invoice Stock] Created movement for product ${productIdStr}: ${currentLine.quantite} (invoice ${invoice.numero})`);
        }
      }
    } catch (error) {
      console.error(`Error updating stock movement for product ${productId}:`, error);
      // Continue processing other products even if one fails
    }
  }
}

