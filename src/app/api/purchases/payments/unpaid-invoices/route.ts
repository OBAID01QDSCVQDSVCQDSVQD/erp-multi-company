import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
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
    const fournisseurId = searchParams.get('fournisseurId') || '';

    if (!fournisseurId) {
      return NextResponse.json({ error: 'fournisseurId requis' }, { status: 400 });
    }

    // Get all invoices for this supplier (excluding ANNULEE)
    // Only fetch Purchase Invoices, NO AVOIRS here.
    const query: any = {
      societeId: new mongoose.Types.ObjectId(tenantId),
      fournisseurId: fournisseurId,
      statut: { $nin: ['ANNULEE'] },
      type: { $ne: 'AVOIRFO' } // Exclude legacy avoirs too just in case
    };

    const invoices = await (PurchaseInvoice as any).find(query)
      .sort({ dateFacture: -1 })
      .lean();

    // Calculate paid amounts for each invoice
    const invoicesWithPaymentInfo = await Promise.all(
      invoices.map(async (invoice: any) => {
        // Get all payments for this invoice
        const payments = await (PaiementFournisseur as any).find({
          societeId: tenantId,
          'lignes.factureId': invoice._id,
        }).lean();

        let montantPaye = 0;
        payments.forEach((payment: any) => {
          payment.lignes.forEach((line: any) => {
            if (line.factureId.toString() === invoice._id.toString()) {
              montantPaye += line.montantPaye;
            }
          });
        });

        const montantTotal = invoice.totaux?.totalTTC || 0;
        const soldeRestant = montantTotal - montantPaye;

        // Check if fully paid (tolerant of floating point)
        const estPayee = Math.abs(soldeRestant) < 0.005;
        const estPartiellementPayee = !estPayee && Math.abs(montantPaye) > 0.005;

        return {
          _id: invoice._id,
          numero: invoice.numero,
          dateFacture: invoice.dateFacture,
          referenceFournisseur: invoice.referenceFournisseur,
          montantTotal,
          montantPaye,
          soldeRestant: Math.max(0, soldeRestant), // Ensure not negative
          statut: invoice.statut,
          estPayee,
          estPartiellementPayee,
        };
      })
    );

    // Filter to show only unpaid or partially paid invoices
    const unpaidInvoices = invoicesWithPaymentInfo.filter(
      (inv) => !inv.estPayee
    );

    return NextResponse.json(unpaidInvoices);
  } catch (error) {
    console.error('Erreur GET /api/purchases/payments/unpaid-invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
