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
    });

    // Calculate totals
    calculateDocumentTotals(returnDoc);

    await (returnDoc as any).save();

    // Update BL quantities and add note
    if (body.blId) {
      await updateBLForReturn(returnDoc, body.blId, tenantId);
    }

    // Return products to stock
    await returnProductsToStock(returnDoc, tenantId, session.user.email);

    return NextResponse.json(returnDoc, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/returns:', error);
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
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA;
  doc.netAPayer = doc.totalTTC;
}

async function updateBLForReturn(returnDoc: any, blId: string, tenantId: string) {
  try {
    const bl = await (Document as any).findOne({
      _id: blId,
      tenantId,
      type: 'BL',
    });

    if (!bl) {
      console.warn(`BL ${blId} not found for return ${returnDoc.numero}`);
      return;
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

        // Reduce delivered quantity by return quantity.
        // NOTE: to make the change visible partout في واجهة BL,
        // نحدّث كل من qtyLivree و quantite بالقيمة الجديدة.
        const currentQtyLivree =
          lineObj.qtyLivree !== undefined && lineObj.qtyLivree !== null
            ? lineObj.qtyLivree
            : (lineObj.quantite || 0);
        const returnQty = returnLine.quantite || 0;
        const newQtyLivree = Math.max(0, currentQtyLivree - returnQty);

        console.log(
          `BL line ${index}: Product ${lineObj.designation} - quantite/qtyLivree: ${currentQtyLivree} -> ${newQtyLivree} (returned: ${returnQty})`
        );

        return {
          ...lineObj,
          // الكمية الفعلية المسلَّمة بعد الريتور
          qtyLivree: newQtyLivree,
          // نحدّث أيضاً quantite حتى تتغيّر الكمية الظاهرة في BL
          quantite: newQtyLivree,
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
    const returnNote =
      `\n[⚠️ Ce BL a fait l'objet d'un BON DE RETOUR ${returnDoc.numero} le ${returnDate} ` +
      `– Quantités retournées vers le stock: ${returnLinesSummary}]`;

    const updatedNotes = (bl.notes || '') + returnNote;

    // Prepare linkedDocuments update
    const linkedDocuments = bl.linkedDocuments || [];
    const returnDocIdStr = returnDoc._id.toString();
    if (!linkedDocuments.some((docId: any) => docId?.toString() === returnDocIdStr)) {
      linkedDocuments.push(returnDocIdStr);
    }

    // Update BL document using findByIdAndUpdate to ensure changes are saved
    await (Document as any).findByIdAndUpdate(
      bl._id,
      {
        $set: {
          lignes: updatedLines,
          notes: updatedNotes,
          linkedDocuments: linkedDocuments,
        }
      },
      { new: true, runValidators: true }
    );
    
    console.log(`BL ${bl.numero} updated for return ${returnDoc.numero} - qtyLivree reduced for ${returnDoc.lignes.length} line(s)`);
  } catch (error) {
    console.error('Error updating BL for return:', error);
    throw error;
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
          console.warn(`Product ${productIdStr} not found for return ${returnDoc.numero}`);
          continue;
        }

        // Skip non-stocked products
        if (product.estStocke === false) {
          continue;
        }

        // Create stock movement (ENTREE - entry into stock)
        const mouvement = new MouvementStock({
          societeId: tenantId,
          productId: productIdStr,
          type: 'ENTREE',
          qte: line.quantite,
          date: returnDoc.dateDoc || new Date(),
          source: 'RETOUR',
          sourceId: returnDoc._id.toString(),
          notes: `Retour ${returnDoc.numero} - ${line.designation}`,
          createdBy,
        });

        await (mouvement as any).save();
      } catch (error) {
        console.error(`Error creating stock movement for product ${line.productId}:`, error);
        // Continue processing other products even if one fails
      }
    }
  } catch (error) {
    console.error('Error returning products to stock:', error);
    throw error;
  }
}

