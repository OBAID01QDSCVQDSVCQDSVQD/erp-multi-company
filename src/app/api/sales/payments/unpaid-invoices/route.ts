import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import PaiementClient from '@/lib/models/PaiementClient';
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
    const customerId = searchParams.get('customerId') || '';

    if (!customerId) {
      return NextResponse.json({ error: 'customerId requis' }, { status: 400 });
    }

    // Get all invoices for this customer (excluding cancelled)
    const query: any = {
      tenantId: tenantId,
      customerId: customerId,
      type: 'FAC',
      statut: { $nin: ['ANNULEE', 'annulee'] },
    };

    const invoices = await (Document as any).find(query)
      .sort({ dateDoc: -1 })
      .lean();

    // Calculate paid amounts for each invoice
    const invoicesWithPaymentInfo = await Promise.all(
      invoices.map(async (invoice: any) => {
        // Get all payments for this invoice
        const payments = await (PaiementClient as any).find({
          societeId: new mongoose.Types.ObjectId(tenantId),
          'lignes.factureId': invoice._id,
        }).lean();

        let montantPaye = 0;
        payments.forEach((payment: any) => {
          payment.lignes.forEach((line: any) => {
            if (line.factureId && line.factureId.toString() === invoice._id.toString()) {
              montantPaye += line.montantPaye;
            }
          });
        });

        const montantTotal = invoice.totalTTC || 0;
        const soldeRestant = montantTotal - montantPaye;
        const estPayee = montantPaye >= montantTotal - 0.001;
        const estPartiellementPayee = montantPaye > 0 && montantPaye < montantTotal;

        return {
          _id: invoice._id,
          numero: invoice.numero,
          dateDoc: invoice.dateDoc,
          referenceExterne: invoice.referenceExterne || invoice.numero,
          montantTotal,
          montantPaye,
          soldeRestant: Math.max(0, soldeRestant),
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
    console.error('Erreur GET /api/sales/payments/unpaid-invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

