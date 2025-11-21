import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import { NumberingService } from '@/lib/services/NumberingService';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceId, sourceType } = body; // sourceType: 'BL' or 'DEVIS'

    if (!sourceId || !sourceType) {
      return NextResponse.json(
        { error: 'sourceId et sourceType sont requis' },
        { status: 400 }
      );
    }

    if (sourceType !== 'BL' && sourceType !== 'DEVIS') {
      return NextResponse.json(
        { error: 'sourceType doit être BL ou DEVIS' },
        { status: 400 }
      );
    }

    await connectDB();
    const tenantId = session.user.companyId?.toString() || '';

    // Fetch source document
    const sourceDoc = await (Document as any).findOne({
      _id: sourceId,
      tenantId,
      type: sourceType
    }).lean();

    if (!sourceDoc) {
      return NextResponse.json(
        { error: `${sourceType === 'BL' ? 'Bon de livraison' : 'Devis'} non trouvé` },
        { status: 404 }
      );
    }

    // Generate invoice number based on last invoice number + 1
    // Find the last invoice (FAC) for this tenant
    const lastInvoice = await (Document as any).findOne({
      tenantId,
      type: 'FAC'
    })
    .sort({ createdAt: -1 })
    .lean();

    let numero: string;
    
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
        // If no numeric part found, just append "-1" or use NumberingService as fallback
        numero = await NumberingService.next(tenantId, 'fac');
      }
    } else {
      // No invoices exist yet, use NumberingService to generate first number
      numero = await NumberingService.next(tenantId, 'fac');
    }
    
    // Log for debugging
    console.log(`[Convert] Source ${sourceType} ${sourceDoc.numero} -> Invoice ${numero} (last: ${lastInvoice?.numero || 'none'})`);

    // Create invoice from source document
    // Allow overriding quantities from body.lignes if provided (for quantity updates during conversion)
    const sourceLignes = sourceDoc.lignes || [];
    const bodyLignes = body.lignes || [];
    
    // Create a map of body lines by sourceLineId or productId for quick lookup
    const bodyLinesMap = new Map();
    bodyLignes.forEach((line: any) => {
      const key = line.sourceLineId || line.productId?.toString();
      if (key) {
        bodyLinesMap.set(key, line);
      }
    });
    
    const invoiceLignes = sourceLignes.map((line: any) => {
      const sourceLineId = line._id?.toString() || line.sourceLineId;
      const bodyLine = bodyLinesMap.get(sourceLineId) || bodyLinesMap.get(line.productId?.toString());
      
      // Use quantity from body if provided, otherwise use source quantity
      return {
        productId: bodyLine?.productId || line.productId,
        codeAchat: bodyLine?.codeAchat || line.codeAchat,
        categorieCode: bodyLine?.categorieCode || line.categorieCode,
        designation: bodyLine?.designation || line.designation,
        quantite: bodyLine?.quantite !== undefined ? bodyLine.quantite : line.quantite,
        uomCode: bodyLine?.uomCode || line.uomCode,
        prixUnitaireHT: bodyLine?.prixUnitaireHT !== undefined ? bodyLine.prixUnitaireHT : line.prixUnitaireHT,
        remisePct: bodyLine?.remisePct !== undefined ? bodyLine.remisePct : (line.remisePct || 0),
        taxCode: bodyLine?.taxCode || line.taxCode,
        tvaPct: bodyLine?.tvaPct !== undefined ? bodyLine.tvaPct : (line.tvaPct || 0),
        sourceLineId: sourceLineId, // Track source line
      };
    });
    
    const invoice = new Document({
      tenantId,
      type: 'FAC',
      numero,
      dateDoc: body.dateDoc ? new Date(body.dateDoc) : new Date(),
      customerId: sourceDoc.customerId,
      referenceExterne: sourceDoc.referenceExterne,
      bonCommandeClient: sourceDoc.bonCommandeClient,
      dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : sourceDoc.dateEcheance,
      devise: sourceDoc.devise || 'TND',
      modePaiement: body.modePaiement || sourceDoc.modePaiement,
      conditionsPaiement: body.conditionsPaiement || sourceDoc.conditionsPaiement,
      notes: body.notes || sourceDoc.notes,
      lignes: invoiceLignes,
      linkedDocuments: [sourceId], // Link to source document
      createdBy: session.user.email
    });

    // Calculate totals
    calculateDocumentTotals(invoice);

    await (invoice as any).save();

    // Handle stock movements based on source type
    // If converting from BL, update existing stock movements to reference the invoice
    // instead of creating new ones (to avoid double stock reduction)
    // If converting from DEVIS, create new stock movements
    if (sourceType === 'BL') {
      // Update existing BL stock movements to reference the invoice
      // This prevents double stock reduction and links movements to the invoice
      await updateStockMovementsFromBLToInvoice(invoice, sourceId, tenantId, session.user.email);
    } else {
      // For DEVIS or other sources, create new stock movements
      await createStockMovementsForInvoice(invoice, tenantId, session.user.email);
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/invoices/convert:', error);
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

// Helper function to update stock movements from BL to Invoice
// This prevents double stock reduction when converting BL to FAC
async function updateStockMovementsFromBLToInvoice(
  invoice: any,
  blId: string,
  tenantId: string,
  createdBy: string
): Promise<void> {
  if (!invoice.lignes || invoice.lignes.length === 0) {
    return;
  }

  const dateDoc = invoice.dateDoc || new Date();
  const invoiceId = invoice._id.toString();

  // Process each line
  for (const line of invoice.lignes) {
    // Skip if no productId or quantity is 0
    if (!line.productId || !line.quantite || line.quantite <= 0) {
      continue;
    }

    try {
      const productIdStr = line.productId.toString();

      // Find existing stock movement from BL for this product
      // Use $or to search for both ObjectId and string formats
      let existingMovement = null;
      
      try {
        // Try to convert blId to ObjectId
        const blIdObjectId = new mongoose.Types.ObjectId(blId);
        existingMovement = await (MouvementStock as any).findOne({
          societeId: tenantId,
          productId: productIdStr,
          source: 'BL',
          $or: [
            { sourceId: blId },
            { sourceId: blIdObjectId },
            { sourceId: blId.toString() }
          ],
          type: 'SORTIE',
        });
      } catch (err) {
        // If ObjectId conversion fails, try string only
        existingMovement = await (MouvementStock as any).findOne({
          societeId: tenantId,
          productId: productIdStr,
          source: 'BL',
          sourceId: blId,
          type: 'SORTIE',
        });
      }

      // If still not found, try finding all BL movements for this product and match by string
      if (!existingMovement) {
        const allBLMovements = await (MouvementStock as any).find({
          societeId: tenantId,
          productId: productIdStr,
          source: 'BL',
          type: 'SORTIE',
        }).lean();
        
        // Find the one that matches blId (as string)
        existingMovement = allBLMovements.find((mov: any) => 
          mov.sourceId?.toString() === blId.toString()
        );
      }

      if (existingMovement) {
        // Update existing movement to reference the invoice instead of BL
        // This prevents double stock reduction
        const movementDoc = await (MouvementStock as any).findById(existingMovement._id);
        if (movementDoc) {
          movementDoc.source = 'FAC';
          movementDoc.sourceId = invoiceId;
          movementDoc.date = dateDoc;
          movementDoc.qte = line.quantite;
          movementDoc.notes = `Facture ${invoice.numero}`;
          await movementDoc.save();
          console.log(`[Convert] Updated stock movement ${existingMovement._id} for product ${productIdStr} from BL ${blId} to FAC ${invoiceId}`);
        }
      } else {
        // If no existing movement found, this is an error
        // When converting from BL, the stock movement should already exist from the BL creation
        // We should NOT create a new movement as this would cause double stock reduction
        console.error(`[Convert] WARNING: No stock movement found for BL ${blId}, product ${productIdStr}. Stock was not reduced when BL was created.`);
        // Do NOT create a new movement - this would cause double stock reduction
        // The stock should have been reduced when the BL was created
      }
    } catch (error) {
      console.error(`Error updating stock movement for product ${line.productId}:`, error);
      // Continue processing other lines even if one fails
    }
  }
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

  // Process each line
  for (const line of invoice.lignes) {
    // Skip if no productId or quantity is 0
    if (!line.productId || !line.quantite || line.quantite <= 0) {
      continue;
    }

    try {
      const productIdStr = line.productId.toString();

      // Check if product exists
      const product = await (Product as any).findOne({
        _id: productIdStr,
        tenantId,
      }).lean();

      if (!product) {
        continue; // Skip if product not found
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

