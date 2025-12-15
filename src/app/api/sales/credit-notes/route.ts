import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Product from '@/lib/models/Product';
import MouvementStock from '@/lib/models/MouvementStock';
import { NumberingService } from '@/lib/services/NumberingService';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    const filter: any = {
      tenantId,
      type: 'AVOIR',
    };

    if (q) {
      filter.$or = [
        { numero: { $regex: q, $options: 'i' } },
        { referenceExterne: { $regex: q, $options: 'i' } },
      ];
    }

    const creditNotes = await (Document as any)
      .find(filter)
      .sort({ dateDoc: -1 })
      .limit(limit)
      .lean();

    const total = await (Document as any).countDocuments(filter);

    return NextResponse.json({ items: creditNotes, total });
  } catch (error) {
    console.error('Erreur GET /sales/credit-notes:', error);
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
    const { invoiceNumber, reason } = body;

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: 'Le numéro de facture est requis' },
        { status: 400 }
      );
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    const sourceInvoice = await (Document as any)
      .findOne({ tenantId, type: 'FAC', numero: invoiceNumber });

    if (!sourceInvoice) {
      return NextResponse.json(
        { error: 'Facture source introuvable' },
        { status: 404 }
      );
    }

    const numero = await NumberingService.next(tenantId, 'avoir');

    const lignes = (sourceInvoice.lignes || []).map((line: any) => {
      const plain = line.toObject ? line.toObject() : { ...line };
      const { _id, qtyFacturee, qtyLivree, qtyRecue, ...rest } = plain;
      return {
        ...rest,
        sourceLineId: _id?.toString() || rest.sourceLineId,
        quantite: -Math.abs(rest.quantite || 0),
        qtyFacturee: 0,
        qtyLivree: 0,
        qtyRecue: 0,
      };
    });

    const creditNote = new (Document as any)({
      tenantId,
      type: 'AVOIR',
      numero,
      dateDoc: new Date(),
      // Create credit note directly as VALIDEE (or PAYEE if source invoice is already paid)
      statut: sourceInvoice.statut === 'PAYEE' ? 'PAYEE' : 'VALIDEE',
      customerId: sourceInvoice.customerId,
      referenceExterne: sourceInvoice.numero,
      lignes,
      devise: sourceInvoice.devise,
      tauxChange: sourceInvoice.tauxChange,
      modePaiement: sourceInvoice.modePaiement,
      conditionsPaiement: sourceInvoice.conditionsPaiement,
      notes: reason || '',
      linkedDocuments: [sourceInvoice._id.toString()],
      remiseGlobalePct: sourceInvoice.remiseGlobalePct || 0,
      timbreFiscal: -(sourceInvoice.timbreFiscal || 0),
      createdBy: session.user.email,
    });

    calculateDocumentTotals(creditNote);

    await creditNote.save();

    await (Document as any).updateOne(
      { _id: sourceInvoice._id },
      { $addToSet: { linkedDocuments: creditNote._id.toString() } }
    );

    await createStockMovementsForCreditNote(
      creditNote,
      tenantId,
      session.user.email
    );

    return NextResponse.json(creditNote, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/credit-notes:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

function calculateDocumentTotals(doc: any) {
  let totalHTAfterLineDiscount = 0;
  let totalTVA = 0;

  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    totalHTAfterLineDiscount += montantHT;
  });

  const remiseGlobalePct = doc.remiseGlobalePct || 0;
  const totalBaseHT = totalHTAfterLineDiscount * (1 - remiseGlobalePct / 100);

  doc.lignes.forEach((line: any) => {
    const remise = line.remisePct || 0;
    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
    const montantHT = prixHT * line.quantite;
    const montantHTAfterGlobalRemise = montantHT * (1 - remiseGlobalePct / 100);

    if (line.tvaPct) {
      totalTVA += montantHTAfterGlobalRemise * (line.tvaPct / 100);
    }
  });

  doc.totalBaseHT = Math.round(totalBaseHT * 100) / 100;
  doc.totalTVA = Math.round(totalTVA * 100) / 100;

  const timbreFiscal = doc.timbreFiscal || 0;
  doc.totalTTC = doc.totalBaseHT + doc.totalTVA + timbreFiscal;
  doc.netAPayer = doc.totalTTC;
}

async function createStockMovementsForCreditNote(
  creditNote: any,
  tenantId: string,
  createdBy: string
) {
  if (!creditNote.lignes || creditNote.lignes.length === 0) {
    return;
  }

  const dateDoc = creditNote.dateDoc || new Date();
  const noteId = creditNote._id.toString();

  for (const line of creditNote.lignes) {
    if (!line.productId) continue;
    const quantity = Math.abs(line.quantite || 0);
    if (quantity <= 0) continue;

    try {
      const product = await (Product as any)
        .findOne({ _id: line.productId, tenantId })
        .lean();

      if (!product || product.estStocke === false) {
        continue;
      }

      const mouvement = new (MouvementStock as any)({
        societeId: tenantId,
        productId: line.productId,
        type: 'ENTREE',
        qte: quantity,
        date: dateDoc,
        source: 'FAC',
        sourceId: noteId,
        notes: `Retour avoir ${creditNote.numero}`,
        createdBy,
      });

      await mouvement.save();
    } catch (error) {
      console.error(
        `Erreur lors de la création du mouvement de stock pour le produit ${line.productId}:`,
        error
      );
    }
  }
}














