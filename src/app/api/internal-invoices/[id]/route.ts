import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import mongoose from 'mongoose';

// GET /api/internal-invoices/[id]
export async function GET(
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

    const invoice = await (Document as any)
      .findOne({ _id: id, tenantId, type: 'INT_FAC' })
      .populate({
        path: 'customerId',
        select: 'raisonSociale nom prenom matriculeFiscale',
        model: 'Customer'
      })
      .populate({
        path: 'projetId',
        select: 'name projectNumber',
        model: 'Project'
      })
      .lean();

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture interne non trouvée' },
        { status: 404 }
      );
    }

    console.log('[API] Invoice customerId:', {
      customerId: invoice.customerId,
      type: typeof invoice.customerId,
      isObject: typeof invoice.customerId === 'object' && invoice.customerId !== null
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Erreur GET /internal-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH /api/internal-invoices/[id]
export async function PATCH(
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
    const body = await request.json();

    await connectDB();

    // Check if invoice exists and belongs to tenant
    const existingInvoice = await (Document as any).findOne({
      _id: id,
      tenantId,
      type: 'INT_FAC'
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Facture interne non trouvée' },
        { status: 404 }
      );
    }

    // Check numero uniqueness if changed
    if (body.numero && body.numero !== existingInvoice.numero) {
      const numeroExists = await (Document as any).findOne({
        tenantId,
        type: 'INT_FAC',
        numero: body.numero,
        _id: { $ne: id }
      });

      if (numeroExists) {
        return NextResponse.json(
          { error: 'Ce numéro de facture interne existe déjà' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = { ...body };
    
    // Convert IDs to ObjectId - validate first
    if (updateData.customerId !== undefined && updateData.customerId !== null) {
      // If it's already an ObjectId instance, convert to string first
      if (updateData.customerId instanceof mongoose.Types.ObjectId) {
        updateData.customerId = updateData.customerId.toString();
      }
      // If it's an object with _id (populated), extract the _id
      if (typeof updateData.customerId === 'object' && updateData.customerId._id) {
        updateData.customerId = updateData.customerId._id;
      }
      
      // Now convert string to ObjectId
      if (typeof updateData.customerId === 'string') {
        if (updateData.customerId.trim()) {
          // Validate ObjectId format before creating
          if (mongoose.Types.ObjectId.isValid(updateData.customerId)) {
            updateData.customerId = new mongoose.Types.ObjectId(updateData.customerId);
          } else {
            return NextResponse.json(
              { error: 'ID client invalide' },
              { status: 400 }
            );
          }
        } else {
          updateData.customerId = undefined;
        }
      }
    } else if (updateData.customerId === '' || updateData.customerId === null) {
      updateData.customerId = undefined;
    }

    if (updateData.projetId !== undefined && updateData.projetId !== null) {
      // If it's already an ObjectId instance, convert to string first
      if (updateData.projetId instanceof mongoose.Types.ObjectId) {
        updateData.projetId = updateData.projetId.toString();
      }
      // If it's an object with _id (populated), extract the _id
      if (typeof updateData.projetId === 'object' && updateData.projetId._id) {
        updateData.projetId = updateData.projetId._id;
      }
      
      // Now convert string to ObjectId
      if (typeof updateData.projetId === 'string') {
        if (updateData.projetId.trim()) {
          // Validate ObjectId format before creating
          if (mongoose.Types.ObjectId.isValid(updateData.projetId)) {
            updateData.projetId = new mongoose.Types.ObjectId(updateData.projetId);
          } else {
            return NextResponse.json(
              { error: 'ID projet invalide' },
              { status: 400 }
            );
          }
        } else {
          updateData.projetId = undefined;
        }
      }
    } else if (updateData.projetId === '' || updateData.projetId === null) {
      updateData.projetId = undefined;
    }

    // Calculate totals - merge existing invoice with update data first
    const mergedData = { ...existingInvoice.toObject(), ...updateData };
    calculateDocumentTotals(mergedData);
    
    // Update updateData with calculated totals
    updateData.totalBaseHT = mergedData.totalBaseHT;
    updateData.totalTVA = mergedData.totalTVA;
    updateData.totalTTC = mergedData.totalTTC;
    if (mergedData.fodec) {
      updateData.fodec = mergedData.fodec;
    }

    // Prevent manual status change to PARTIELLEMENT_PAYEE or PAYEE (these are automatic based on payments)
    if (updateData.statut === 'PARTIELLEMENT_PAYEE' || updateData.statut === 'PAYEE') {
      return NextResponse.json(
        { error: 'لا يمكن تغيير الحالة إلى "Partiellement payée" أو "Payée" يدوياً. هذه الحالات تحدث تلقائياً عند الدفع.' },
        { status: 400 }
      );
    }

    // Check if status changed to VALIDEE or projetId changed
    const oldStatus = existingInvoice.statut || 'BROUILLON';
    const newStatus = updateData.statut !== undefined ? updateData.statut : oldStatus;
    const oldProjetId = existingInvoice.projetId?.toString();
    const newProjetId = updateData.projetId !== undefined ? (updateData.projetId?.toString() || null) : oldProjetId;
    
    // Check if user wants to update stock (from confirmation modal)
    const updateStock = updateData.updateStock !== undefined ? updateData.updateStock : true; // Default to true for backward compatibility
    
    console.log('[Stock Movement] Status check:', {
      oldStatus,
      newStatus,
      statusChanged: oldStatus !== newStatus,
      oldProjetId,
      newProjetId,
      hasProjetId: !!newProjetId
    });

    // Update invoice
    const updatedInvoice = await (Document as any).findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    )
      .populate('customerId', 'raisonSociale nom prenom')
      .populate('projetId', 'name projectNumber')
      .lean();

    // Handle stock movements based on status and project
    const invoiceId = id.toString();
    
    // Debug logging
    console.log('[Stock Movement] Invoice update:', {
      invoiceId,
      oldStatus,
      newStatus,
      oldProjetId,
      newProjetId,
      hasProjetId: !!updatedInvoice.projetId
    });
    
    // Only handle stock movements if invoice is NOT linked to a project
    const hasProject = !!(newProjetId || updatedInvoice.projetId);
    console.log('[Stock Movement] Project check:', { hasProject, newProjetId, updatedInvoiceProjetId: updatedInvoice.projetId });
    
    if (!hasProject) {
      // Case 1: Status changed from BROUILLON or ANNULEE to VALIDEE - Create SORTIE movements (decrease stock)
      if ((oldStatus === 'BROUILLON' || oldStatus === 'ANNULEE') && newStatus === 'VALIDEE') {
        if (updateStock) {
          console.log('[Stock Movement] ✅ Status changed from', oldStatus, 'to VALIDEE - Creating SORTIE movements');
          // Delete any existing movements if any
          const deleted = await (MouvementStock as any).deleteMany({
            $or: [
              { societeId: tenantId, source: 'INT_FAC_BROUILLON', sourceId: invoiceId },
              { societeId: tenantId, source: 'INT_FAC', sourceId: invoiceId }
            ]
          });
          console.log('[Stock Movement] Deleted', deleted.deletedCount, 'existing movements');
          // Create SORTIE movements (decrease stock)
          await createStockMovementsForInternalInvoice(updatedInvoice, tenantId, session.user.email || '', 'VALIDEE');
        } else {
          console.log('[Stock Movement] ⏭️ User chose NOT to update stock - Status changed without stock movement');
        }
      }
      // Case 2: Status changed from VALIDEE to BROUILLON - Delete SORTIE movements only (no ENTREE needed)
      // When changing from VALIDEE to BROUILLON, we just remove the SORTIE movements
      // This restores the stock to its previous state (before the invoice was validated)
      else if (oldStatus === 'VALIDEE' && newStatus === 'BROUILLON') {
        if (updateStock) {
          console.log('[Stock Movement] ✅ Status changed from VALIDEE to BROUILLON - Deleting SORTIE movements only');
          // Delete existing SORTIE movements (from VALIDEE status)
          // This will restore stock to its previous level (before validation)
          const deletedValidee = await (MouvementStock as any).deleteMany({
            societeId: tenantId,
            source: 'INT_FAC',
            sourceId: invoiceId,
          });
          console.log('[Stock Movement] Deleted', deletedValidee.deletedCount, 'VALIDEE movements - Stock restored');
          // Do NOT create ENTREE movements - just deleting SORTIE is enough to restore stock
        } else {
          console.log('[Stock Movement] ⏭️ User chose NOT to update stock - Status changed without stock movement');
        }
      }
      // Case 3: Status changed from VALIDEE to ANNULEE - Delete SORTIE movements only (same as BROUILLON)
      else if (oldStatus === 'VALIDEE' && newStatus === 'ANNULEE') {
        if (updateStock) {
          console.log('[Stock Movement] ✅ Status changed from VALIDEE to ANNULEE - Deleting SORTIE movements only');
          // Delete existing SORTIE movements (from VALIDEE status)
          // This will restore stock to its previous level (before validation)
          const deletedValidee = await (MouvementStock as any).deleteMany({
            societeId: tenantId,
            source: 'INT_FAC',
            sourceId: invoiceId,
          });
          console.log('[Stock Movement] Deleted', deletedValidee.deletedCount, 'VALIDEE movements - Stock restored');
          // Do NOT create any movements - just deleting SORTIE is enough to restore stock
        } else {
          console.log('[Stock Movement] ⏭️ User chose NOT to update stock - Status changed without stock movement');
        }
      }
      // Case 4: Status changed from VALIDEE to another status (not BROUILLON or ANNULEE) - Delete movements
      else if (oldStatus === 'VALIDEE' && newStatus !== 'VALIDEE' && newStatus !== 'BROUILLON' && newStatus !== 'ANNULEE') {
        console.log('[Stock Movement] Status changed from VALIDEE to', newStatus, '- Deleting movements');
        await (MouvementStock as any).deleteMany({
          societeId: tenantId,
          source: 'INT_FAC',
          sourceId: invoiceId,
        });
      }
      // Case 5: Status changed from BROUILLON or ANNULEE to another status (not VALIDEE) - Delete movements
      else if ((oldStatus === 'BROUILLON' || oldStatus === 'ANNULEE') && newStatus !== 'BROUILLON' && newStatus !== 'ANNULEE' && newStatus !== 'VALIDEE') {
        console.log('[Stock Movement] Status changed from', oldStatus, 'to', newStatus, '- Deleting movements');
        await (MouvementStock as any).deleteMany({
          $or: [
            { societeId: tenantId, source: 'INT_FAC_BROUILLON', sourceId: invoiceId },
            { societeId: tenantId, source: 'INT_FAC', sourceId: invoiceId }
          ]
        });
      }
      // Case 5: Status is still VALIDEE but invoice was updated - Update movements
      else if (newStatus === 'VALIDEE' && oldStatus === 'VALIDEE') {
        console.log('[Stock Movement] Invoice still VALIDEE - Updating movements');
        await createStockMovementsForInternalInvoice(updatedInvoice, tenantId, session.user.email || '', 'VALIDEE');
      }
    } else {
      console.log('[Stock Movement] Skipping - Invoice linked to project');
      // If invoice is linked to a project, delete all stock movements
      await (MouvementStock as any).deleteMany({
        $or: [
          { societeId: tenantId, source: 'INT_FAC', sourceId: invoiceId },
          { societeId: tenantId, source: 'INT_FAC_BROUILLON', sourceId: invoiceId }
        ]
      });
    }

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    console.error('Erreur PATCH /internal-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/internal-invoices/[id]
export async function DELETE(
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

    const invoice = await (Document as any).findOneAndDelete({
      _id: id,
      tenantId,
      type: 'INT_FAC'
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Facture interne non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Facture interne supprimée avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /internal-invoices/[id]:', error);
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

// Helper function to create stock movements for internal invoice
// Only creates movements if invoice is NOT linked to a project
async function createStockMovementsForInternalInvoice(
  invoice: any,
  tenantId: string,
  createdBy: string,
  status: 'VALIDEE' | 'BROUILLON' = 'VALIDEE'
): Promise<void> {
  // Don't create stock movements if invoice is linked to a project
  const projetId = invoice.projetId?.toString() || invoice.projetId;
  if (projetId) {
    console.log('[Stock Movement] Skipping - Invoice linked to project:', projetId);
    return;
  }

  if (!invoice.lignes || invoice.lignes.length === 0) {
    console.log('[Stock Movement] Skipping - No lines in invoice');
    return;
  }

  const movementType = status === 'VALIDEE' ? 'SORTIE' : 'ENTREE';
  const source = status === 'VALIDEE' ? 'INT_FAC' : 'INT_FAC_BROUILLON';
  const notes = status === 'VALIDEE' 
    ? `Facture interne ${invoice.numero}` 
    : `Facture interne brouillon ${invoice.numero}`;

  console.log('[Stock Movement] Creating', movementType, 'movements for invoice:', invoice.numero, 'Lines:', invoice.lignes.length);
  console.log('[Stock Movement] Invoice details:', {
    invoiceId: invoice._id?.toString(),
    numero: invoice.numero,
    lignesCount: invoice.lignes?.length || 0,
    status,
    source,
    movementType
  });

  const dateDoc = invoice.dateDoc || new Date();
  const invoiceId = invoice._id?.toString() || invoice._id;

  if (!invoiceId) {
    console.error('[Stock Movement] ❌ No invoice ID found!');
    return;
  }

  let movementsCreated = 0;
  let movementsUpdated = 0;
  let movementsSkipped = 0;

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
        source: source,
        sourceId: invoiceId,
      });

      if (existingMovement) {
        // Update existing movement
        existingMovement.type = movementType;
        existingMovement.qte = line.quantite;
        existingMovement.date = dateDoc;
        existingMovement.notes = notes;
        await (existingMovement as any).save();
        movementsUpdated++;
        console.log('[Stock Movement] ✅ Updated', movementType, 'movement for product:', productIdStr, 'Qty:', line.quantite);
      } else {
        // Create new stock movement
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: productIdStr,
          type: movementType,
          qte: line.quantite,
          date: dateDoc,
          source: source,
          sourceId: invoiceId,
          notes: notes,
          createdBy,
        });

        await (mouvement as any).save();
        movementsCreated++;
        console.log('[Stock Movement] ✅ Created', movementType, 'movement for product:', productIdStr, 'Qty:', line.quantite, 'Source:', source);
      }
    } catch (error) {
      movementsSkipped++;
      console.error(`[Stock Movement] ❌ Error creating stock movement for product ${line.productId}:`, error);
      // Continue processing other lines even if one fails
    }
  }
  
  console.log('[Stock Movement] Summary:', {
    invoiceId,
    status,
    movementType,
    movementsCreated,
    movementsUpdated,
    movementsSkipped,
    total: movementsCreated + movementsUpdated + movementsSkipped
  });
}

