import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import PaiementClient from '@/lib/models/PaiementClient';
import mongoose from 'mongoose';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const tenantId = session.user.companyId?.toString() || '';

    await connectDB();

    // Fetch the internal invoice
    const internalInvoice = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'INT_FAC'
    }).lean();

    if (!internalInvoice) {
      return NextResponse.json(
        { error: 'Facture interne non trouvée' },
        { status: 404 }
      );
    }

    // Check if this internal invoice has already been converted
    // Look for an official invoice that references this internal invoice
    const existingConversion = await (Document as any).findOne({
      tenantId,
      type: 'FAC',
      linkedDocuments: id.toString()
    }).lean();

    if (existingConversion) {
      return NextResponse.json(
        { 
          error: 'Cette facture interne a déjà été convertie en facture officielle',
          convertedInvoiceId: existingConversion._id,
          convertedInvoiceNumber: existingConversion.numero
        },
        { status: 409 }
      );
    }

    // Generate new invoice number
    const lastInvoice = await (Document as any).findOne({
      tenantId,
      type: 'FAC'
    })
    .sort({ createdAt: -1 })
    .lean();

    let numero = '';
    if (lastInvoice && lastInvoice.numero) {
      const numericMatch = lastInvoice.numero.match(/(\d+)$/);
      if (numericMatch) {
        const lastNumber = parseInt(numericMatch[1], 10);
        const nextNumber = lastNumber + 1;
        const prefix = lastInvoice.numero.substring(0, lastInvoice.numero.length - numericMatch[1].length);
        const padding = numericMatch[1].length;
        numero = prefix + nextNumber.toString().padStart(padding, '0');
      } else {
        numero = `FAC-${new Date().getFullYear()}-00001`;
      }
    } else {
      numero = `FAC-${new Date().getFullYear()}-00001`;
    }

    // Prepare invoice data (convert INT_FAC to FAC)
    // Use current date (conversion date) instead of internal invoice date
    const invoiceData: any = {
      tenantId,
      type: 'FAC',
      numero,
      dateDoc: new Date(), // Use conversion date, not the internal invoice date
      statut: 'VALIDEE', // Automatically validate the official invoice when converted
      customerId: internalInvoice.customerId ? new mongoose.Types.ObjectId(internalInvoice.customerId) : undefined,
      projetId: internalInvoice.projetId ? new mongoose.Types.ObjectId(internalInvoice.projetId) : undefined,
      referenceExterne: internalInvoice.referenceExterne,
      dateEcheance: internalInvoice.dateEcheance,
      dateLivraisonPrevue: internalInvoice.dateLivraisonPrevue,
      dateLivraisonReelle: internalInvoice.dateLivraisonReelle,
      lignes: internalInvoice.lignes || [],
      totalBaseHT: internalInvoice.totalBaseHT || 0,
      totalTVA: internalInvoice.totalTVA || 0,
      totalTTC: internalInvoice.totalTTC || 0,
      timbreFiscal: internalInvoice.timbreFiscal || 0,
      retenueSource: internalInvoice.retenueSource || 0,
      netAPayer: internalInvoice.netAPayer || internalInvoice.totalTTC || 0,
      totalTVADeductible: internalInvoice.totalTVADeductible || 0,
      remiseGlobalePct: internalInvoice.remiseGlobalePct || 0,
      fodec: internalInvoice.fodec || { enabled: false, tauxPct: 1, montant: 0 },
      devise: internalInvoice.devise || 'TND',
      tauxChange: internalInvoice.tauxChange || 1,
      lieuLivraison: internalInvoice.lieuLivraison,
      moyenTransport: internalInvoice.moyenTransport,
      modePaiement: internalInvoice.modePaiement,
      conditionsPaiement: internalInvoice.conditionsPaiement,
      notes: internalInvoice.notes,
      notesInterne: internalInvoice.notesInterne,
      createdBy: session.user.email,
      archived: false,
      linkedDocuments: [internalInvoice._id.toString()] // Link to original internal invoice
    };

    // Create the official invoice
    const officialInvoice = new Document(invoiceData);
    
    // Calculate totals
    calculateDocumentTotals(officialInvoice);
    await (officialInvoice as any).save();

    // Check if the internal invoice has any payments and transfer them to the official invoice
    const internalInvoicePayments = await (PaiementClient as any).find({
      societeId: new mongoose.Types.ObjectId(tenantId),
      'lignes.factureId': internalInvoice._id,
    }).lean();

    // Calculate total paid amount first
    let totalPaidAmount = 0;
    internalInvoicePayments.forEach((payment: any) => {
      payment.lignes.forEach((line: any) => {
        if (line.factureId && line.factureId.toString() === internalInvoice._id.toString() && !line.isPaymentOnAccount) {
          totalPaidAmount += line.montantPaye || 0;
        }
      });
    });

    // Transfer payments from internal invoice to official invoice
    // Sort payments by date to ensure correct cumulative calculation
    internalInvoicePayments.sort((a: any, b: any) => {
      const dateA = new Date(a.datePaiement).getTime();
      const dateB = new Date(b.datePaiement).getTime();
      return dateA - dateB; // Sort ascending (oldest first)
    });

    // Calculate cumulative paid amount for each payment line
    let cumulativePaidBefore = 0;
    const montantFacture = internalInvoice.totalTTC || internalInvoice.totalBaseHT || 0;

    for (const payment of internalInvoicePayments) {
      let paymentHasChanges = false;
      const updatedLignes = payment.lignes.map((line: any) => {
        // If this line is for the internal invoice, update it to point to the official invoice
        if (line.factureId && line.factureId.toString() === internalInvoice._id.toString() && !line.isPaymentOnAccount) {
          const montantPaye = line.montantPaye || 0;
          const montantPayeAvant = cumulativePaidBefore;
          cumulativePaidBefore += montantPaye;
          const soldeRestant = Math.max(0, montantFacture - cumulativePaidBefore);
          
          paymentHasChanges = true;
          return {
            ...line,
            factureId: officialInvoice._id,
            numeroFacture: numero,
            referenceExterne: internalInvoice.referenceExterne || numero,
            montantFacture: montantFacture,
            montantPayeAvant: montantPayeAvant,
            montantPaye: montantPaye,
            soldeRestant: soldeRestant,
          };
        }
        return line;
      });

      // Update the payment document with the new lines if any were changed
      if (paymentHasChanges) {
        await (PaiementClient as any).findByIdAndUpdate(
          payment._id,
          {
            $set: {
              lignes: updatedLignes,
            }
          }
        );
      }
    }

    // Update internal invoice to mark it as converted
    const conversionDate = new Date().toLocaleDateString('fr-FR');
    let conversionNote = `\n[✓ Convertie en facture officielle ${numero} le ${conversionDate}]`;
    if (totalPaidAmount > 0) {
      conversionNote += ` - Paiements transférés (${totalPaidAmount.toFixed(3)} ${internalInvoice.devise || 'TND'})`;
    }
    await (Document as any).findByIdAndUpdate(
      internalInvoice._id,
      { 
        $set: { 
          notesInterne: (internalInvoice.notesInterne || '') + conversionNote,
          // Add a flag to indicate conversion
          archived: true, // Archive the internal invoice after conversion
        } 
      }
    );

    // Create stock movements for all products (only for official invoices, and only if status is VALIDEE)
    if (officialInvoice.statut === 'VALIDEE') {
      await createStockMovementsForInvoice(officialInvoice, tenantId, session.user.email);
    }

    // Populate before returning
    const populatedInvoice = await (Document as any)
      .findById(officialInvoice._id)
      .populate('customerId', 'raisonSociale nom prenom')
      .populate('projetId', 'name projectNumber')
      .lean();

    return NextResponse.json({
      invoice: populatedInvoice,
      message: 'Facture officielle créée avec succès'
    }, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la conversion:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;

  if (!doc.lignes || doc.lignes.length === 0) {
    doc.totalBaseHT = 0;
    doc.totalTVA = 0;
    doc.totalTTC = 0;
    if (doc.fodec) {
      doc.fodec.montant = 0;
    }
    return;
  }

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

  // Calculate FODEC
  const fodecEnabled = doc.fodec?.enabled || false;
  const fodecTauxPct = doc.fodec?.tauxPct || 1;
  const fodec = fodecEnabled ? totalBaseHT * (fodecTauxPct / 100) : 0;

  // Calculate TVA
  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    const montantHTAfterGlobalRemise = montantHT * (1 - (remiseGlobalePct / 100));
    const ligneFodec = fodecEnabled ? montantHTAfterGlobalRemise * (fodecTauxPct / 100) : 0;
    const ligneBaseTVA = montantHTAfterGlobalRemise + ligneFodec;
    
    if (line.tvaPct) {
      totalTVA += ligneBaseTVA * (line.tvaPct / 100);
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;
  
  if (doc.fodec) {
    doc.fodec.montant = Math.round(fodec * 100) / 100;
  }
  
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

