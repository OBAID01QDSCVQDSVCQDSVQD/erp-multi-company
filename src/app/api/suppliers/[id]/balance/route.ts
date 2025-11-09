import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import mongoose from 'mongoose';

// Helper function to calculate due date from payment terms
function calculateDateEcheance(dateFacture: Date, conditionsPaiement?: string): Date | null {
  if (!conditionsPaiement) {
    const dueDate = new Date(dateFacture);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }

  const terms = conditionsPaiement.toLowerCase().trim();
  
  const joursMatch = terms.match(/(\d+)\s*jours?/);
  if (joursMatch) {
    const jours = parseInt(joursMatch[1], 10);
    const dueDate = new Date(dateFacture);
    dueDate.setDate(dueDate.getDate() + jours);
    return dueDate;
  }

  const finMoisMatch = terms.match(/fin\s+de\s+mois\s*\+?\s*(\d+)/);
  if (finMoisMatch) {
    const jours = parseInt(finMoisMatch[1], 10);
    const dueDate = new Date(dateFacture);
    dueDate.setMonth(dueDate.getMonth() + 1, 0);
    dueDate.setDate(dueDate.getDate() + jours);
    return dueDate;
  }

  if (terms.includes('comptant') || terms.includes('réception') || terms.includes('reception')) {
    return new Date(dateFacture);
  }

  const dueDate = new Date(dateFacture);
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate;
}

// Helper function to calculate aging bucket
function getAgingBucket(dateEcheance: Date | null, referenceDate: Date): {
  bucket: '0-30' | '31-60' | '61-90' | '>90';
  days: number;
} {
  if (!dateEcheance) {
    return { bucket: '>90', days: 999 };
  }

  const diffTime = referenceDate.getTime() - dateEcheance.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return { bucket: '0-30', days: diffDays };
  } else if (diffDays <= 60) {
    return { bucket: '31-60', days: diffDays };
  } else if (diffDays <= 90) {
    return { bucket: '61-90', days: diffDays };
  } else {
    return { bucket: '>90', days: diffDays };
  }
}

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

    const { id } = await params;
    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const referenceDate = dateStr ? new Date(dateStr) : new Date();

    // Get all unpaid/partial invoices for this supplier
    const invoices = await (PurchaseInvoice as any)
      .find({
        societeId: tenantId,
        fournisseurId: id,
        statut: { $in: ['VALIDEE', 'PARTIELLEMENT_PAYEE'] },
      })
      .sort({ dateFacture: -1 })
      .lean();

    // Get all payments for this supplier
    // Note: PaiementFournisseur uses ObjectId for societeId and fournisseurId
    const payments = await (PaiementFournisseur as any)
      .find({
        societeId: new mongoose.Types.ObjectId(tenantId),
        fournisseurId: new mongoose.Types.ObjectId(id),
      })
      .lean();

    // Calculate paid amounts per invoice (exclude payments on account)
    const invoicePayments: { [key: string]: number } = {};
    let totalPaymentsOnAccount = 0;
    let totalAdvanceUsed = 0; // Track total advance used across all payments
    
    payments.forEach((payment: any) => {
      // Calculate payment total from lignes (source of truth)
      const paymentTotalFromLignes = payment.lignes && Array.isArray(payment.lignes)
        ? payment.lignes.reduce((sum: number, line: any) => sum + (line.montantPaye || 0), 0)
        : 0;

      // Check if this is a pure payment on account
      if (payment.isPaymentOnAccount === true) {
        // Pure payment on account: use total from lignes
        totalPaymentsOnAccount += paymentTotalFromLignes;
      } else {
        // Check lignes for partial payments on account and regular invoice payments
        if (payment.lignes && Array.isArray(payment.lignes)) {
          payment.lignes.forEach((line: any) => {
            if (line.isPaymentOnAccount === true) {
              // This line is a payment on account
              totalPaymentsOnAccount += line.montantPaye || 0;
            } else if (line.factureId && line.isPaymentOnAccount !== true) {
              // Regular payment linked to an invoice
              const invoiceId = line.factureId.toString();
              invoicePayments[invoiceId] = (invoicePayments[invoiceId] || 0) + (line.montantPaye || 0);
            }
          });
        }
      }
      
      // Track advance used (reduces available advance)
      if (payment.advanceUsed && payment.advanceUsed > 0) {
        totalAdvanceUsed += payment.advanceUsed;
      }
    });
    
    // Calculate net advance balance: payments on account - advance used
    // Round to 3 decimal places to avoid floating point issues
    const netAdvanceBalance = Math.round((totalPaymentsOnAccount - totalAdvanceUsed) * 1000) / 1000;

    // Process invoices
    const openInvoices: any[] = [];
    let totalSolde = 0;
    const aging: {
      '0-30': number;
      '31-60': number;
      '61-90': number;
      '>90': number;
    } = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '>90': 0,
    };

    invoices.forEach((invoice: any) => {
      const invoiceId = invoice._id.toString();
      const montantTotal = invoice.totaux?.totalTTC || 0;
      const montantPaye = invoicePayments[invoiceId] || 0;
      const soldeRestant = Math.max(0, montantTotal - montantPaye);

      // Skip if fully paid
      if (soldeRestant <= 0) {
        return;
      }

      // Calculate due date
      const dateEcheance = calculateDateEcheance(
        new Date(invoice.dateFacture),
        invoice.conditionsPaiement
      );

      // Calculate aging
      const agingInfo = getAgingBucket(dateEcheance, referenceDate);

      totalSolde += soldeRestant;
      aging[agingInfo.bucket] += soldeRestant;

      openInvoices.push({
        _id: invoice._id,
        numero: invoice.numero,
        dateFacture: invoice.dateFacture,
        dateEcheance: dateEcheance,
        montantTotal,
        montantPaye,
        soldeRestant,
        statut: invoice.statut,
        conditionsPaiement: invoice.conditionsPaiement,
        aging: agingInfo.bucket,
        joursEchus: agingInfo.days,
      });
    });

    // soldeDu is already correct and doesn't need adjustment
    // NOTE: We DON'T subtract netAdvanceBalance from soldeDu because:
    // - soldeDu is calculated from soldeRestant (montantTotal - montantPaye)
    // - montantPaye already includes payments made using advance balance (advanceUsed)
    // - If we subtract netAdvanceBalance, we'd be double-counting:
    //   - First: montantPaye (which includes advanceUsed) reduces soldeRestant
    //   - Second: netAdvanceBalance (which includes -advanceUsed) reduces soldeDu
    // - netAdvanceBalance should only be displayed for informational purposes (available balance)
    // - soldeDu should show the actual amount owed (invoices - payments, where payments include advance usage)
    const finalSolde = totalSolde;

    return NextResponse.json({
      soldeDu: finalSolde,
      aging,
      factures: openInvoices,
      paymentsOnAccount: totalPaymentsOnAccount,
      advanceUsed: totalAdvanceUsed,
      netAdvanceBalance: netAdvanceBalance,
      referenceDate: referenceDate.toISOString(),
    });
  } catch (error) {
    console.error('Erreur GET /api/suppliers/[id]/balance:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

