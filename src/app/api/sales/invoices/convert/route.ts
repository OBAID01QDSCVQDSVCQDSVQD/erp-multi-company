import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import { NumberingService } from '@/lib/services/NumberingService';

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

    // Generate invoice number
    const numero = await NumberingService.next(tenantId, 'fac');

    // Create invoice from source document
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
      lignes: sourceDoc.lignes ? sourceDoc.lignes.map((line: any) => ({
        productId: line.productId,
        codeAchat: line.codeAchat,
        categorieCode: line.categorieCode,
        designation: line.designation,
        quantite: line.quantite,
        uomCode: line.uomCode,
        prixUnitaireHT: line.prixUnitaireHT,
        remisePct: line.remisePct || 0,
        taxCode: line.taxCode,
        tvaPct: line.tvaPct || 0,
        sourceLineId: line._id?.toString() || line.sourceLineId, // Track source line
      })) : [],
      linkedDocuments: [sourceId], // Link to source document
      createdBy: session.user.email
    });

    // Calculate totals
    calculateDocumentTotals(invoice);

    await (invoice as any).save();

    // Create stock movements for stored products (estStocke === true)
    await createStockMovementsForInvoice(invoice, tenantId, session.user.email);

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
      // Check if product is stored (estStocke === true)
      const product = await (Product as any).findOne({
        _id: line.productId,
        tenantId,
      }).lean();

      if (!product || !product.estStocke) {
        continue; // Skip non-stored products
      }

      // Create new stock movement
      const mouvement = new MouvementStock({
        societeId: tenantId,
        productId: line.productId,
        type: 'SORTIE',
        qte: line.quantite,
        date: dateDoc,
        source: 'FAC',
        sourceId: invoiceId,
        notes: `Facture ${invoice.numero}`,
        createdBy,
      });

      await (mouvement as any).save();
    } catch (error) {
      console.error(`Error creating stock movement for product ${line.productId}:`, error);
      // Continue processing other lines even if one fails
    }
  }
}

