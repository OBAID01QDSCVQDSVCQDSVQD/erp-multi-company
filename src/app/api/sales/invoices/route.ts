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

    return NextResponse.json({ items: invoicesArray, total: total || 0 });
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
        return NextResponse.json(
          { error: 'Ce numéro de facture existe déjà. Merci de choisir un autre numéro.' },
          { status: 409 }
        );
      }
    } else {
      // Generate invoice number based on last invoice number + 1
      // Find the last invoice (FAC) for this tenant
      const lastInvoice = await (Document as any).findOne({
        tenantId,
        type: 'FAC'
      })
      .sort({ createdAt: -1 })
      .lean();

      if (lastInvoice && lastInvoice.numero) {
        // Extract numeric part from last invoice number
        const lastNumero = lastInvoice.numero;
        // Try to extract the numeric part (handle formats like "FAC-001", "001", "1", etc.)
        const numericMatch = lastNumero.match(/(\d+)$/);
        
        if (numericMatch) {
          const lastNumber = parseInt(numericMatch[1], 10);
          const nextNumber = lastNumber + 1;
          
          // Preserve the prefix if it exists (e.g., "FAC-" from "FAC-001")
          const prefix = lastNumero.substring(0, lastNumero.length - numericMatch[1].length);
          // Preserve padding if it exists (e.g., "001" -> "002")
          const padding = numericMatch[1].length;
          numero = prefix + nextNumber.toString().padStart(padding, '0');
        } else {
          // If no numeric part found, use NumberingService as fallback
          numero = await NumberingService.next(tenantId, 'fac');
        }
      } else {
        // No invoices exist yet, use NumberingService to generate first number
        numero = await NumberingService.next(tenantId, 'fac');
      }
    }

    const invoice = new Document({
      ...body,
      tenantId,
      type: 'FAC',
      numero,
      statut: 'BROUILLON',
      createdBy: session.user.email
    });

    calculateDocumentTotals(invoice);
    await (invoice as any).save();

    // Create stock movements for all products
    // Check if invoice is created from BL - if so, do NOT create stock movements
    const isFromBL = invoice.linkedDocuments && invoice.linkedDocuments.length > 0;
    if (!isFromBL) {
      await createStockMovementsForInvoice(invoice, tenantId, session.user.email);
    } else {
      console.log(`[Create Invoice] Skipping stock movements for invoice ${invoice._id} - created from BL`);
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
  createdBy: string
): Promise<void> {
  if (!invoice.lignes || invoice.lignes.length === 0) {
    return;
  }

  const dateDoc = invoice.dateDoc || new Date();
  const invoiceId = invoice._id.toString();

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
        await (existingMovement as any).save();
      } else {
        // Create new stock movement
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: productIdStr,
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
