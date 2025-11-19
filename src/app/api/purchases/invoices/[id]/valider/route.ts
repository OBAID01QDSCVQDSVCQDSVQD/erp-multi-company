import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const invoice = await (PurchaseInvoice as any).findOne({
      _id: id,
      societeId: tenantId,
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    if (invoice.statut !== 'BROUILLON') {
      return NextResponse.json(
        { error: 'Impossible de valider une facture qui n\'est pas en brouillon' },
        { status: 400 }
      );
    }

    // Check if invoice has lines
    if (!invoice.lignes || invoice.lignes.length === 0) {
      return NextResponse.json(
        { error: 'La facture doit contenir au moins une ligne' },
        { status: 400 }
      );
    }

    // Validate totals
    const totalQte = invoice.lignes.reduce((sum: number, line: any) => sum + (line.quantite || 0), 0);
    if (totalQte <= 0) {
      return NextResponse.json(
        { error: 'La quantité totale doit être supérieure à zéro' },
        { status: 400 }
      );
    }

    // Update status
    invoice.statut = 'VALIDEE';
    invoice.updatedAt = new Date();
    await invoice.save();

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Erreur POST /api/purchases/invoices/[id]/valider:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}








