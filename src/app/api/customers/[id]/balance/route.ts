import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PaiementClient from '@/lib/models/PaiementClient';
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

    const { id } = await params;
    const tenantId = session.user.companyId?.toString() || '';

    // Get all payments for this customer
    const payments = await (PaiementClient as any)
      .find({
        societeId: new mongoose.Types.ObjectId(tenantId),
        customerId: new mongoose.Types.ObjectId(id),
      })
      .sort({ datePaiement: 1, createdAt: 1 })
      .lean();

    // ============================================
    // CALCULATE SOLDE AVANCE DISPONIBLE
    // ============================================
    // Formula: netAdvanceBalance = totalPaymentsOnAccount - totalAdvanceUsed
    // 
    // totalPaymentsOnAccount = sum of all payments on account
    //   - Pure payment on account: payment.isPaymentOnAccount = true
    //   - Partial payment on account: line.isPaymentOnAccount = true
    //
    // totalAdvanceUsed = sum of advanceUsed from all payments
    //   - This is the amount of advance balance that was used to pay invoices
    //
    // IMPORTANT: We calculate from lignes to avoid using payment.montantTotal
    // which might be incorrect or double-counted
    // ============================================

    let totalPaymentsOnAccount = 0;
    let totalAdvanceUsed = 0;

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
        // Check lignes for partial payments on account
        if (payment.lignes && Array.isArray(payment.lignes)) {
          payment.lignes.forEach((line: any) => {
            if (line.isPaymentOnAccount === true) {
              // This line is a payment on account
              totalPaymentsOnAccount += line.montantPaye || 0;
            }
          });
        }
      }

      // Track advance used (reduces available advance)
      if (payment.advanceUsed && payment.advanceUsed > 0) {
        totalAdvanceUsed += payment.advanceUsed;
      }
    });

    // Calculate net advance balance
    const netAdvanceBalance = Math.round((totalPaymentsOnAccount - totalAdvanceUsed) * 1000) / 1000;

    // Debug logging
    console.log('=== SOLDE AVANCE DISPONIBLE CALCULATION ===');
    console.log('Customer ID:', id);
    console.log('Total Payments:', payments.length);
    console.log('Total Payments on Account:', totalPaymentsOnAccount);
    console.log('Total Advance Used:', totalAdvanceUsed);
    console.log('Net Advance Balance:', netAdvanceBalance);
    console.log('===========================================');

    return NextResponse.json({
      netAdvanceBalance,
      totalPaymentsOnAccount,
      totalAdvanceUsed,
    });
  } catch (error) {
    console.error('Erreur GET /api/customers/[id]/balance:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}
