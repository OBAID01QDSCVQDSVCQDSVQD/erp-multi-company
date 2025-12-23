import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
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
    const q = searchParams.get('q');

    const query: any = {
      tenantId,
      type: 'RETOUR'
    };

    let returns = await (Document as any).find(query)
      .sort('-createdAt')
      .lean();

    // Populate customerId and blId
    const Customer = (await import('@/lib/models/Customer')).default;
    const customerIds = [...new Set(returns.map((r: any) => r.customerId).filter(Boolean))];
    const blIds = [...new Set(returns.map((r: any) => r.blId).filter(Boolean))];

    // Fetch customers
    if (customerIds.length > 0) {
      const customers = await (Customer as any).find({
        _id: { $in: customerIds.map((id: any) => typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id) },
        tenantId,
      }).select('nom prenom raisonSociale').lean();

      const customerMap = new Map(customers.map((c: any) => [c._id.toString(), c]));

      for (const returnDoc of returns) {
        if (returnDoc.customerId) {
          const customer = customerMap.get(
            typeof returnDoc.customerId === 'string'
              ? returnDoc.customerId
              : returnDoc.customerId.toString()
          );
          if (customer) {
            returnDoc.customerId = customer;
          }
        }
      }
    }

    // Fetch BLs to get numbers
    if (blIds.length > 0) {
      const bls = await (Document as any).find({
        _id: { $in: blIds.map((id: any) => typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id) },
        tenantId,
        type: 'BL',
      }).select('numero').lean();

      const blMap = new Map(bls.map((bl: any) => [bl._id.toString(), bl.numero]));

      for (const returnDoc of returns) {
        if (returnDoc.blId) {
          const blNumero = blMap.get(
            typeof returnDoc.blId === 'string'
              ? returnDoc.blId
              : returnDoc.blId.toString()
          );
          if (blNumero) {
            returnDoc.blNumero = blNumero;
          }
        }
      }
    }

    // Filter by search query
    let filteredReturns = returns;
    if (q) {
      const searchLower = q.toLowerCase();
      filteredReturns = returns.filter((returnDoc: any) => {
        const matchesNumero = returnDoc.numero?.toLowerCase().includes(searchLower);
        const customer = returnDoc.customerId;
        let customerName = '';
        if (customer) {
          if (typeof customer === 'object' && customer !== null) {
            customerName = (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || '').toLowerCase();
          }
        }
        const matchesCustomer = customerName.includes(searchLower);
        const matchesBL = returnDoc.blNumero?.toLowerCase().includes(searchLower);
        return matchesNumero || matchesCustomer || matchesBL;
      });
    }

    return NextResponse.json({ items: filteredReturns, total: filteredReturns.length });
  } catch (error) {
    console.error('Erreur GET /sales/returns:', error);
    const errorMessage = (error as Error).message || 'Erreur lors de la récupération des retours';
    return NextResponse.json(
      { error: errorMessage },
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
    const numero = await NumberingService.next(tenantId, 'retour');

    // Create return document
    const returnDoc = new Document({
      ...body,
      tenantId,
      type: 'RETOUR',
      numero,
      createdBy: session.user.email,
      statut: 'VALIDEE', // Returns are automatically validated
      blId: body.blId ? new mongoose.Types.ObjectId(body.blId) : undefined,
      customerId: body.customerId ? new mongoose.Types.ObjectId(body.customerId) : undefined,
      warehouseId: body.warehouseId ? new mongoose.Types.ObjectId(body.warehouseId) : undefined,
    });

    // Calculate totals
    calculateDocumentTotals(returnDoc);

    await (returnDoc as any).save();

    // Update BL quantities and add note
    if (body.blId) {
      await updateBLForReturn(returnDoc, body.blId, tenantId, session.user.email);
    }

    // Return products to stock
    await returnProductsToStock(returnDoc, tenantId, session.user.email);

    return NextResponse.json(returnDoc, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/returns:', error);
    const errorMessage = (error as Error).message || 'Erreur lors de la création du retour';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalBaseHT = 0;
  let totalTVA = 0;

  if (!doc.lignes || !Array.isArray(doc.lignes)) {
    doc.totalBaseHT = 0;
    doc.totalTVA = 0;
    doc.totalTTC = 0;
    doc.netAPayer = 0;
    return;
  }

  doc.lignes.forEach((line: any) => {
    const quantite = line.quantite || 0;
    const remise = line.remisePct || 0;
    const prixHT = (line.prixUnitaireHT || 0) * (1 - remise / 100);
    const montantHT = prixHT * quantite;
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

async function updateBLForReturn(returnDoc: any, blId: string, tenantId: string, createdBy: string) {
  try {
    // Fetch BL as Mongoose document (not lean) so we can modify and save it
    const bl = await (Document as any).findOne({
      _id: blId,
      tenantId,
      type: 'BL',
    });

    if (!bl) {
      throw new Error(`Bon de livraison ${blId} non trouvé`);
    }

    // Update quantities in BL lines
    const updatedLines = bl.lignes.map((blLine: any, index: number) => {
      const returnLine = returnDoc.lignes.find((retLine: any) =>
        retLine.productId &&
        blLine.productId &&
        retLine.productId.toString() === blLine.productId.toString()
      );

      if (returnLine) {
        // Get current line as plain object
        const lineObj = blLine.toObject ? blLine.toObject() : (typeof blLine === 'object' ? { ...blLine } : {});

        // Subtract return quantity from the original quantity (quantite)
        // الكمية الأصلية تنقص مباشرة عند عمل retour
        const currentQuantite = lineObj.quantite || 0;
        const returnQty = returnLine.quantite || 0;
        const newQuantite = Math.max(0, currentQuantite - returnQty);

        // Also update qtyLivree if it exists
        const currentQtyLivree =
          lineObj.qtyLivree !== undefined && lineObj.qtyLivree !== null
            ? lineObj.qtyLivree
            : currentQuantite;
        const newQtyLivree = Math.max(0, currentQtyLivree - returnQty);

        return {
          ...lineObj,
          // تحديث الكمية الأصلية مباشرة
          quantite: newQuantite,
          // تحديث الكمية المسلمة
          qtyLivree: newQtyLivree,
        };
      }

      // Return line as plain object if not modified
      return blLine.toObject ? blLine.toObject() : (typeof blLine === 'object' ? { ...blLine } : blLine);
    });

    // Add note about the return
    const returnDate = new Date(returnDoc.dateDoc).toLocaleDateString('fr-FR');
    const returnLinesSummary = returnDoc.lignes.map((l: any) =>
      `${l.quantite} ${l.uomCode || ''} ${l.designation}`
    ).join(', ');

    // تنبيه واضح داخل BL يشرح أن كميات من هذا BL رجعت إلى الستوك من Bon de retour معين
    // Get warehouse name if available
    let warehouseName = '';
    if (returnDoc.warehouseId) {
      try {
        const Warehouse = (await import('@/lib/models/Warehouse')).default;
        const warehouse = await (Warehouse as any).findOne({ _id: returnDoc.warehouseId }).select('name').lean();
        if (warehouse) warehouseName = warehouse.name;
      } catch (e) {
        console.error('Error fetching warehouse name for return note:', e);
      }
    }

    // تنبيه واضح داخل BL يشرح أن كميات من هذا BL رجعت إلى الستوك من Bon de retour معين
    const returnNote =
      `\n[⚠️ Ce BL a fait l'objet d'un BON DE RETOUR ${returnDoc.numero} le ${returnDate} ` +
      `– Quantités retournées vers le stock${warehouseName ? ` (${warehouseName})` : ''}: ${returnLinesSummary}]`;

    const updatedNotes = (bl.notes || '') + returnNote;

    // Prepare linkedDocuments update
    const linkedDocuments = bl.linkedDocuments || [];
    const returnDocIdStr = returnDoc._id.toString();
    if (!linkedDocuments.some((docId: any) => docId?.toString() === returnDocIdStr)) {
      linkedDocuments.push(returnDocIdStr);
    }

    // Create temporary object for calculation
    const blForCalc = {
      ...(bl.toObject ? bl.toObject() : bl),
      lignes: updatedLines,
    };

    // Recalculate totals based on updated quantities
    calculateDocumentTotals(blForCalc);

    // Update BL document using findOneAndUpdate to ensure all fields are updated
    const updatedBL = await (Document as any).findOneAndUpdate(
      { _id: bl._id, tenantId },
      {
        $set: {
          lignes: updatedLines,
          totalBaseHT: blForCalc.totalBaseHT || 0,
          totalTVA: blForCalc.totalTVA || 0,
          totalTTC: blForCalc.totalTTC || 0,
          netAPayer: blForCalc.netAPayer || blForCalc.totalTTC || 0,
          notes: updatedNotes,
          linkedDocuments: linkedDocuments,
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedBL) {
      throw new Error(`Failed to update BL ${bl.numero}`);
    }

    // Note: We don't update BL stock movements (SORTIE) - they remain with original quantity
    // The RETOUR will create an ENTREE movement to add the returned quantity back to stock
    // This way: Stock = Original Stock - BL (SORTIE) + RETOUR (ENTREE) = Correct final stock
  } catch (error) {
    console.error('Error updating BL for return:', error);
    const errorMessage = (error as Error).message || 'Erreur lors de la mise à jour du bon de livraison';
    throw new Error(errorMessage);
  }
}

// Update stock movements for BL after return (reduce quantity to reflect returned items)
async function updateBLStockMovementsAfterReturn(
  bl: any,
  updatedLines: any[],
  tenantId: string,
  createdBy: string
): Promise<void> {
  try {
    const MouvementStock = (await import('@/lib/models/MouvementStock')).default;
    const Product = (await import('@/lib/models/Product')).default;

    const blId = bl._id.toString();
    const dateDoc = bl.dateDoc || new Date();

    for (const line of updatedLines || []) {
      if (!line.productId || !line.quantite || line.quantite <= 0) continue;

      try {
        const productIdStr = line.productId.toString();

        // Check if product exists and is stocked
        const product = await (Product as any).findOne({
          _id: productIdStr,
          tenantId,
        }).lean();

        if (!product || product.estStocke === false) {
          continue;
        }

        // Find existing BL stock movement
        const existingMovement = await (MouvementStock as any).findOne({
          societeId: tenantId,
          productId: productIdStr,
          source: 'BL',
          sourceId: blId,
        });

        if (existingMovement) {
          // Update the movement with the new quantity (after return deduction)
          existingMovement.qte = line.quantite;
          existingMovement.date = dateDoc;
          await (existingMovement as any).save();
        }
      } catch (error) {
        console.error(`Error updating BL stock movement for product ${line.productId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error updating BL stock movements after return:', error);
    // Don't throw - this is not critical for return creation
  }
}

async function returnProductsToStock(returnDoc: any, tenantId: string, createdBy: string) {
  try {
    const MouvementStock = (await import('@/lib/models/MouvementStock')).default;
    const Product = (await import('@/lib/models/Product')).default;

    for (const line of returnDoc.lignes || []) {
      if (!line.productId || !line.quantite || line.quantite <= 0) continue;

      try {
        const productIdStr = line.productId.toString();

        // Check if product exists and is stocked
        const product = await (Product as any).findOne({
          _id: productIdStr,
          tenantId,
        }).lean();

        if (!product) {
          continue;
        }

        // Skip non-stocked products
        if (product.estStocke === false) {
          continue;
        }

        // Check if stock movement already exists for this return and product
        const existingMovement = await (MouvementStock as any).findOne({
          societeId: tenantId,
          productId: productIdStr,
          source: 'RETOUR',
          sourceId: returnDoc._id.toString(),
        });

        if (existingMovement) {
          // Update existing movement
          existingMovement.qte = line.quantite;
          existingMovement.date = returnDoc.dateDoc || new Date();
          if (returnDoc.warehouseId) existingMovement.warehouseId = returnDoc.warehouseId;
          existingMovement.notes = `Retour ${returnDoc.numero} - ${line.designation}`;
          await (existingMovement as any).save();
        } else {
          // Create stock movement (ENTREE - entry into stock)
          // cette mouvement ajoute la qté au stock specifique
          const mouvement = new MouvementStock({
            societeId: tenantId,
            productId: productIdStr,
            type: 'ENTREE', // دخول - يزيد المخزون
            qte: line.quantite, // الكمية المرجوعة
            date: returnDoc.dateDoc || new Date(),
            source: 'RETOUR',
            sourceId: returnDoc._id.toString(),
            warehouseId: returnDoc.warehouseId,
            notes: `Retour ${returnDoc.numero} - ${line.designation}`,
            createdBy,
          });

          await (mouvement as any).save();
        }
      } catch (error) {
        console.error(`Error creating stock movement for product ${line.productId}:`, error);
        const errorMessage = (error as Error).message || `Erreur lors de la création du mouvement de stock pour le produit ${line.productId}`;
        throw new Error(errorMessage);
      }
    }
  } catch (error) {
    console.error('Error returning products to stock:', error);
    const errorMessage = (error as Error).message || 'Erreur lors du retour des produits au stock';
    throw new Error(errorMessage);
  }
}

