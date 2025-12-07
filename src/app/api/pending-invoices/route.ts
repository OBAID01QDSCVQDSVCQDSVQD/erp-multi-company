import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import PaiementClient from '@/lib/models/PaiementClient';
import mongoose from 'mongoose';
import NotificationService from '@/lib/services/NotificationService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantIdHeader = request.headers.get('X-Tenant-Id');
    const tenantId = tenantIdHeader || session.user.companyId?.toString() || '';
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    // Ensure models are registered
    if (!mongoose.models.Document) {
      void Document;
    }
    if (!mongoose.models.Customer) {
      const { default: Customer } = await import('@/lib/models/Customer');
      void Customer;
    }
    if (!mongoose.models.Project) {
      const { default: Project } = await import('@/lib/models/Project');
      void Project;
    }

    // Fetch all internal and official invoices
    let internalInvoices;
    try {
      internalInvoices = await (Document as any)
        .find({ tenantId, type: 'INT_FAC' })
        .populate({
          path: 'customerId',
          select: 'raisonSociale nom prenom',
          model: 'Customer'
        })
        .populate({
          path: 'projetId',
          select: 'name projectNumber',
          model: 'Project'
        })
        .lean();
    } catch (populateError: any) {
      console.error('Error populating internal invoices:', populateError);
      // Fallback: fetch without populate
      internalInvoices = await (Document as any)
        .find({ tenantId, type: 'INT_FAC' })
        .lean();
    }

    // Fetch official invoices
    let officialInvoices;
    try {
      officialInvoices = await (Document as any)
        .find({ tenantId, type: 'FAC' })
        .populate({
          path: 'customerId',
          select: 'raisonSociale nom prenom',
          model: 'Customer'
        })
        .lean();
    } catch (populateError: any) {
      console.error('Error populating official invoices:', populateError);
      // Fallback: fetch without populate
      officialInvoices = await (Document as any)
        .find({ tenantId, type: 'FAC' })
        .lean();
    }

    // Calculate remaining balance for each invoice
    // We'll calculate payments per invoice to ensure accuracy
    const calculateRemainingBalance = async (invoice: any) => {
      // Skip internal invoices that have been converted to official invoices
      if (invoice.type === 'INT_FAC') {
        const hasConversionNote = invoice.notesInterne?.includes('Convertie en facture officielle');
        if (hasConversionNote || invoice.archived) {
          // This invoice has been converted, it should be considered fully paid
          return 0;
        }
      }

      // Get all payments for this specific invoice
      const payments = await (PaiementClient as any).find({
        societeId: new mongoose.Types.ObjectId(tenantId),
        'lignes.factureId': invoice._id,
      }).lean();

      let montantPaye = 0;
      payments.forEach((payment: any) => {
        if (payment.lignes && Array.isArray(payment.lignes)) {
          payment.lignes.forEach((line: any) => {
            if (line.factureId && line.factureId.toString() === invoice._id.toString()) {
              montantPaye += line.montantPaye || 0;
            }
          });
        }
      });

      const montantTotal = invoice.totalTTC || 0;
      const soldeRestant = montantTotal - montantPaye;
      return Math.max(0, soldeRestant);
    };

    // Process internal invoices
    const pendingInternalInvoicesPromises = internalInvoices.map(async (invoice: any) => {
      const remainingBalance = await calculateRemainingBalance(invoice);
      return {
        ...invoice,
        type: 'internal',
        typeLabel: 'Facture interne',
        remainingBalance,
        totalPaid: (invoice.totalTTC || 0) - remainingBalance,
        isFullyPaid: remainingBalance <= 0.001,
        isPartiallyPaid: remainingBalance > 0.001 && remainingBalance < (invoice.totalTTC || 0),
      };
    });
    const pendingInternalInvoicesResults = await Promise.all(pendingInternalInvoicesPromises);
    const pendingInternalInvoices = pendingInternalInvoicesResults.filter(
      (invoice: any) => invoice.remainingBalance > 0.001
    ); // Only unpaid or partially paid

    // Process official invoices
    const pendingOfficialInvoicesPromises = officialInvoices.map(async (invoice: any) => {
      const remainingBalance = await calculateRemainingBalance(invoice);
      return {
        ...invoice,
        type: 'official',
        typeLabel: 'Facture officielle',
        remainingBalance,
        totalPaid: (invoice.totalTTC || 0) - remainingBalance,
        isFullyPaid: remainingBalance <= 0.001,
        isPartiallyPaid: remainingBalance > 0.001 && remainingBalance < (invoice.totalTTC || 0),
      };
    });
    const pendingOfficialInvoicesResults = await Promise.all(pendingOfficialInvoicesPromises);
    const pendingOfficialInvoices = pendingOfficialInvoicesResults.filter(
      (invoice: any) => invoice.remainingBalance > 0.001
    ); // Only unpaid or partially paid

    // Combine and sort by date (newest first)
    const allPendingInvoices = [...pendingInternalInvoices, ...pendingOfficialInvoices]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.dateDoc || a.createdAt || 0).getTime();
        const dateB = new Date(b.dateDoc || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

    // Calculate totals
    const totalPendingAmount = allPendingInvoices.reduce(
      (sum: number, inv: any) => sum + (inv.remainingBalance || 0),
      0
    );
    const totalInternalPending = pendingInternalInvoices.reduce(
      (sum: number, inv: any) => sum + (inv.remainingBalance || 0),
      0
    );
    const totalOfficialPending = pendingOfficialInvoices.reduce(
      (sum: number, inv: any) => sum + (inv.remainingBalance || 0),
      0
    );

    const summary = {
      totalCount: allPendingInvoices.length,
      totalInternalCount: pendingInternalInvoices.length,
      totalOfficialCount: pendingOfficialInvoices.length,
      totalPendingAmount,
      totalInternalPending,
      totalOfficialPending,
    };

    // Create notifications for the current user if there are unpaid invoices
    if (summary.totalCount > 0) {
      try {
        const userEmail = session.user.email as string | undefined;

        if (userEmail) {
          const { default: User } = await import('@/lib/models/User');
          const user = await (User as any).findOne({
            email: userEmail,
            companyId: new mongoose.Types.ObjectId(tenantId),
            isActive: true,
          }).lean();

          if (user) {
            const userId = user._id.toString();
            const email = user.email as string;

            // Create one notification per pending invoice (with per-invoice dedup)
            const notifPromises = allPendingInvoices.map((inv: any) => {
              const numero = inv.numero || inv.referenceExterne || 'Facture';

              // Build customer name if available
              let customerName = '';
              if (inv.customerId && typeof inv.customerId === 'object') {
                const c = inv.customerId as any;
                customerName =
                  c.raisonSociale ||
                  `${c.nom || ''} ${c.prenom || ''}`.trim();
              }

              const remaining = (inv.remainingBalance || 0) as number;
              const link =
                inv.type === 'internal'
                  ? `/internal-invoices/${inv._id}`
                  : `/sales/invoices/${inv._id}`;

              return NotificationService.notifyUser({
                tenantId,
                userId,
                userEmail: email,
                type: 'invoice_overdue',
                title: `Facture en attente - ${numero}`,
                message: `Facture ${numero}${
                  customerName ? ` pour ${customerName}` : ''
                } : solde restant ${remaining.toFixed(3)} TND.`,
                link,
                channel: 'in_app',
                // Dedupe per invoice for 24h
                dedupeKey: `invoice_overdue_${inv._id.toString()}`,
              });
            });

            await Promise.all(notifPromises);
          }
        }
      } catch (notifError) {
        console.error('Error creating overdue invoice notification for current user:', notifError);
      }
    }

    return NextResponse.json({
      invoices: allPendingInvoices,
      summary,
    });
  } catch (error: any) {
    console.error('Erreur GET /pending-invoices:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}