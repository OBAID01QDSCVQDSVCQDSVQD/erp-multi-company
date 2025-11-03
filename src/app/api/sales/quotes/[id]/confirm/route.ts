import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import { NumberingService } from '@/lib/services/NumberingService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';

    // Get the quote
    const quote = await (Document as any).findOne({ 
      _id: params.id, 
      tenantId, 
      type: 'DEVIS' 
    });

    if (!quote) {
      return NextResponse.json(
        { error: 'Devis non trouvé' },
        { status: 404 }
      );
    }

    // Generate order number
    const numero = await NumberingService.next(tenantId, 'bc');

    // Create order from quote
    const order = new (Document as any)({
      tenantId,
      type: 'BC',
      numero,
      dateDoc: new Date(),
      customerId: quote.customerId,
      referenceExterne: quote.referenceExterne,
      bonCommandeClient: quote.bonCommandeClient,
      dateEcheance: quote.dateEcheance,
      dateLivraisonPrevue: quote.dateLivraisonPrevue,
      lignes: quote.lignes.map((line: any) => ({
        ...line,
        sourceLineId: line._id?.toString() // Track original line
      })),
      devise: quote.devise,
      tauxChange: quote.tauxChange,
      lieuLivraison: quote.lieuLivraison,
      moyenTransport: quote.moyenTransport,
      modePaiement: quote.modePaiement,
      conditionsPaiement: quote.conditionsPaiement,
      notes: quote.notes,
      notesInterne: quote.notesInterne,
      createdBy: session.user.email,
      linkedDocuments: [quote._id.toString()]
    });

    // Calculate totals
    calculateDocumentTotals(order);
    await (order as any).save();

    // Update quote
    quote.linkedDocuments = [order._id.toString()];
    await (quote as any).save();

    return NextResponse.json({ quote, order }, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /sales/quotes/:id/confirm:', error);
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
