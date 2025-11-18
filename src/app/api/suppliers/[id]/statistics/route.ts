import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import mongoose from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    const { id } = await params;

    // Get all invoices for this supplier (excluding ANNULEE)
    const invoices = await (PurchaseInvoice as any).find({
      societeId: new mongoose.Types.ObjectId(tenantId),
      fournisseurId: id,
      statut: { $nin: ['ANNULEE'] },
    }).lean();

    // Get all payments for this supplier
    const payments = await (PaiementFournisseur as any).find({
      societeId: new mongoose.Types.ObjectId(tenantId),
      fournisseurId: id,
    }).lean();

    // Calculate totals
    let totalFactures = 0;
    let totalPaye = 0;

    invoices.forEach((invoice: any) => {
      totalFactures += invoice.totaux?.totalTTC || 0;
    });

    payments.forEach((payment: any) => {
      // Only count payments for invoices of this supplier
      payment.lignes.forEach((line: any) => {
        const invoice = invoices.find((inv: any) => inv._id.toString() === line.factureId.toString());
        if (invoice) {
          totalPaye += line.montantPaye;
        }
      });
    });

    const soldeRestant = totalFactures - totalPaye;

    return NextResponse.json({
      totalFactures: Math.max(0, totalFactures),
      totalPaye: Math.max(0, totalPaye),
      soldeRestant: Math.max(0, soldeRestant),
      nombreFactures: invoices.length,
      nombrePaiements: payments.length,
    });
  } catch (error) {
    console.error('Erreur GET /api/suppliers/[id]/statistics:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}






