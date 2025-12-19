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

    const tenantIdHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdHeader || session.user.companyId?.toString() || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const query: any = { tenantId, type: 'FAC' };
    if (customerId) query.customerId = customerId;

    // Ensure models are registered
    if (!mongoose.models.Document) {
      void Document;
    }
    if (!mongoose.models.Customer) {
      const { default: Customer } = await import('@/lib/models/Customer');
      void Customer;
    }

    let invoices;
    try {
      invoices = await (Document as any)
        .find(query)
        .populate({
          path: 'customerId',
          select: 'raisonSociale nom prenom',
          model: 'Customer'
        })
        .sort({ createdAt: -1, numero: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    } catch (populateError: any) {
      console.error('Error populating invoices:', populateError);
      // Fallback: fetch without populate
      invoices = await (Document as any)
        .find(query)
        .sort({ createdAt: -1, numero: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    }

    const total = await (Document as any).countDocuments(query);

    // Ensure invoices is always an array
    const invoicesArray = Array.isArray(invoices) ? invoices : [];

    // Process invoices to ensure customerId is properly formatted
    const processedInvoices = invoicesArray.map((invoice: any) => {
      // If customerId is populated as object, keep it as is for the client to extract name
      if (invoice.customerId && typeof invoice.customerId === 'object' && invoice.customerId._id) {
        // Keep the populated object structure so client can access name fields
        return invoice;
      }
      return invoice;
    });

    return NextResponse.json({ items: processedInvoices, total: total || 0 });
  } catch (error: any) {
    console.error('Erreur GET /sales/invoices:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
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

    // Check Subscription Limit
    const { checkSubscriptionLimit } = await import('@/lib/subscription-check');
    const limitCheck = await checkSubscriptionLimit(tenantId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.error }, { status: 403 });
    }

    let numero =
      typeof body.numero === 'string' && body.numero.trim().length > 0
        ? body.numero.trim()
        : '';

    if (numero) {
      const exists = await (Document as any).findOne({
        tenantId,
        type: 'FAC',
        numero,
      });

      if (exists) {
        // If the number exists, instead of failing, we intelligently generate the NEXT valid number.
        // This handles race conditions where two users create an invoice at the same time,
        // or if the frontend sent an outdated 'next number'.
        console.log(`[Invoice] Number ${numero} already exists. Auto-generating next number...`);
        numero = await NumberingService.next(tenantId, 'fac');
      }
    } else {
      // No number provided, generate one
      numero = await NumberingService.next(tenantId, 'fac');
    }

    // === WAREHOUSE RESOLUTION ===
    let warehouseId = body.warehouseId;
    if (!warehouseId) {
      const Warehouse = (await import('@/lib/models/Warehouse')).default;
      const defaultWh = await (Warehouse as any).findOne({ tenantId, isDefault: true }).lean();
      if (defaultWh) {
        warehouseId = defaultWh._id;
      } else {
        const anyWh = await (Warehouse as any).findOne({ tenantId }).lean();
        if (anyWh) warehouseId = anyWh._id;
      }
    }
    const warehouseIdStr = warehouseId ? warehouseId.toString() : undefined;

    const invoice = new Document({
      ...body,
      tenantId,
      type: 'FAC',
      numero,
      statut: 'BROUILLON',
      warehouseId: warehouseIdStr,
      createdBy: session.user.email
    });

    calculateDocumentTotals(invoice);
    await (invoice as any).save();

    // Create stock movements for all products
    // Check if invoice is created from BL - if so, do NOT create stock movements
    // We need to check the actual type of the linked document, not just if linkedDocuments exists
    let isFromBL = false;
    if (invoice.linkedDocuments && invoice.linkedDocuments.length > 0) {
      // Check if any linked document is a BL (Bon de Livraison)
      const linkedDocId = invoice.linkedDocuments[0];
      try {
        const linkedDoc = await (Document as any).findOne({
          _id: linkedDocId,
          tenantId,
        }).lean();

        if (linkedDoc && linkedDoc.type === 'BL') {
          isFromBL = true;
        }
      } catch (err) {
        console.error('Error checking linked document type:', err);
        // If we can't check, assume it's not from BL to be safe
      }
    }

    // === STOCK VALIDATION LOGIC ===
    let shouldCreateStockMovements = !isFromBL;
    const skipStockValidation = body.skipStockValidation === true;

    if (shouldCreateStockMovements && !skipStockValidation) {
      // 1. Fetch company settings
      const CompanySettings = (await import('@/lib/models/CompanySettings')).default;
      const settings = await (CompanySettings as any).findOne({ tenantId }).lean();
      const isNegativeStockAllowed = settings?.stock?.stockNegatif !== 'interdit';

      if (!isNegativeStockAllowed) {
        // 2. Check stock levels
        for (const line of body.lignes || []) {
          if (!line.productId || !line.quantite || line.quantite <= 0) continue;

          const Product = (await import('@/lib/models/Product')).default;
          const product = await (Product as any).findOne({ _id: line.productId, tenantId }).lean();

          if (product && product.estStocke !== false) {
            const MouvementStock = (await import('@/lib/models/MouvementStock')).default;

            // Query specific warehouse
            const query: any = {
              societeId: tenantId,
              productId: line.productId.toString()
            };
            if (warehouseIdStr) {
              query.warehouseId = new mongoose.Types.ObjectId(warehouseIdStr);
            }

            const movements = await (MouvementStock as any).find(query).lean();

            let currentStock = 0;
            for (const mov of movements) {
              if (mov.type === 'ENTREE') currentStock += mov.qte;
              else if (mov.type === 'SORTIE') currentStock -= mov.qte;
            }

            if (currentStock < line.quantite) {
              return NextResponse.json({
                code: 'INSUFFICIENT_STOCK',
                message: `Stock insuffisant pour le produit "${product.nom}". Disponible: ${currentStock}, Demandé: ${line.quantite}.`,
                productName: product.nom,
                available: currentStock,
                requested: line.quantite
              }, { status: 409 });
            }
          }
        }
      }
    } else if (skipStockValidation) {
      // If user explicitly chose to skip validation (Deferred Delivery), 
      // we must NOT move stock.
      shouldCreateStockMovements = false;
      console.log(`[Create Invoice] Stock movements skipped due to deferred delivery (skipStockValidation=true)`);
    }
    // === END STOCK VALIDATION ===

    if (shouldCreateStockMovements) {
      await createStockMovementsForInvoice(invoice, tenantId, session.user.email, warehouseIdStr);
    } else {
      console.log(`[Create Invoice] Skipping stock movements for invoice ${invoice._id} - created from BL or Deferred Delivery`);
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/invoices:', error);
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

  // Calculate FODEC on Total HT AFTER discount (totalBaseHT is already after all discounts)
  // FODEC = totalBaseHT * (tauxPct / 100)
  const fodecEnabled = doc.fodec?.enabled || false;
  const fodecTauxPct = doc.fodec?.tauxPct || 1;
  const fodec = fodecEnabled ? totalBaseHT * (fodecTauxPct / 100) : 0;

  // Calculate TVA after applying global remise and FODEC
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    // Apply global remise to line HT for TVA calculation
    const montantHTAfterGlobalRemise = montantHT * (1 - (remiseGlobalePct / 100));
    // Add FODEC to base for TVA calculation (proportional to line)
    const ligneFodec = fodecEnabled ? montantHTAfterGlobalRemise * (fodecTauxPct / 100) : 0;
    const ligneBaseTVA = montantHTAfterGlobalRemise + ligneFodec;

    if (line.tvaPct) {
      totalTVA += ligneBaseTVA * (line.tvaPct / 100);
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;

  // Update FODEC in document
  if (doc.fodec) {
    doc.fodec.montant = Math.round(fodec * 100) / 100;
  }

  // Add timbre fiscal if it exists in the document
  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + fodec + doc.totalTVA + timbreFiscal;
  doc.netAPayer = doc.totalTTC;
}

// Helper function to create stock movements for invoice
async function createStockMovementsForInvoice(
  invoice: any,
  tenantId: string,
  createdBy: string,
  warehouseId?: string
): Promise<void> {
  if (!invoice.lignes || invoice.lignes.length === 0) {
    return;
  }

  const dateDoc = invoice.dateDoc || new Date();
  const invoiceId = invoice._id.toString();
  const warehouseObjectId = warehouseId ? new mongoose.Types.ObjectId(warehouseId) : undefined;

  for (const line of invoice.lignes) {
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

      // Skip services (non-stocked products)
      if (product.estStocke === false) {
        continue;
      }

      // Check if stock movement already exists for this invoice and product
      const existingMovement = await (MouvementStock as any).findOne({
        societeId: tenantId,
        productId: productIdStr,
        source: 'FAC',
        sourceId: invoiceId,
      });

      if (existingMovement) {
        // Update existing movement
        existingMovement.qte = line.quantite;
        existingMovement.date = dateDoc;
        if (warehouseObjectId) existingMovement.warehouseId = warehouseObjectId;
        await (existingMovement as any).save();
      } else {
        // Create new stock movement
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: productIdStr,
          warehouseId: warehouseObjectId,
          type: 'SORTIE',
          qte: line.quantite,
          date: dateDoc,
          source: 'FAC',
          sourceId: invoiceId,
          notes: `Facture ${invoice.numero}`,
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
