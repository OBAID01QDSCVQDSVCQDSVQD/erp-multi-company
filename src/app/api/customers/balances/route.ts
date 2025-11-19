import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import PaiementClient from '@/lib/models/PaiementClient';
import Customer from '@/lib/models/Customer';
import mongoose from 'mongoose';

// Helper function to calculate due date from payment terms
function calculateDateEcheance(dateDoc: Date, conditionsPaiement?: string): Date | null {
  if (!conditionsPaiement) {
    // Default to 30 days if no payment terms
    const dueDate = new Date(dateDoc);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }

  const terms = conditionsPaiement.toLowerCase().trim();
  
  // Parse patterns like "30 jours", "60 jours", etc.
  const joursMatch = terms.match(/(\d+)\s*jours?/);
  if (joursMatch) {
    const jours = parseInt(joursMatch[1], 10);
    const dueDate = new Date(dateDoc);
    dueDate.setDate(dueDate.getDate() + jours);
    return dueDate;
  }

  // Parse "fin de mois + X" patterns
  const finMoisMatch = terms.match(/fin\s+de\s+mois\s*\+?\s*(\d+)/);
  if (finMoisMatch) {
    const jours = parseInt(finMoisMatch[1], 10);
    const dueDate = new Date(dateDoc);
    // Set to last day of month
    dueDate.setMonth(dueDate.getMonth() + 1, 0);
    dueDate.setDate(dueDate.getDate() + jours);
    return dueDate;
  }

  // Parse "comptant" or "à réception"
  if (terms.includes('comptant') || terms.includes('réception') || terms.includes('reception')) {
    return new Date(dateDoc);
  }

  // Default to 30 days
  const dueDate = new Date(dateDoc);
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const dateStr = searchParams.get('date');
    const referenceDate = dateStr ? new Date(dateStr) : new Date();

    // Build query for invoices (customer invoices - type FAC)
    const invoiceQuery: any = {
      tenantId: tenantId,
      type: 'FAC',
      statut: { $nin: ['ANNULEE', 'annulee'] }, // Exclude cancelled invoices
    };

    if (customerId) {
      invoiceQuery.customerId = customerId;
    }

    // Get all unpaid/partial invoices (we need to check payment status)
    const invoices = await (Document as any)
      .find(invoiceQuery)
      .sort({ dateDoc: -1 })
      .lean();

    // Get all payments
    const paymentQuery: any = { 
      societeId: new mongoose.Types.ObjectId(tenantId)
    };
    if (customerId) {
      paymentQuery.customerId = new mongoose.Types.ObjectId(customerId);
    }
    const payments = await (PaiementClient as any)
      .find(paymentQuery)
      .lean();

    // Calculate paid amounts per invoice (exclude payments on account)
    const invoicePayments: { [key: string]: number } = {};
    const paymentsOnAccount: { [key: string]: number } = {}; // Track payments on account per customer
    const advanceUsed: { [key: string]: number } = {}; // Track advance used per customer
    
    payments.forEach((payment: any) => {
      const customerIdStr = payment.customerId.toString();
      
      // Calculate payment total from lignes (source of truth)
      const paymentTotalFromLignes = payment.lignes && Array.isArray(payment.lignes)
        ? payment.lignes.reduce((sum: number, line: any) => sum + (line.montantPaye || 0), 0)
        : 0;

      // Check if this is a pure payment on account
      if (payment.isPaymentOnAccount === true) {
        // Pure payment on account: use total from lignes
        paymentsOnAccount[customerIdStr] = (paymentsOnAccount[customerIdStr] || 0) + paymentTotalFromLignes;
      } else {
        // Check lignes for partial payments on account and regular invoice payments
        if (payment.lignes && Array.isArray(payment.lignes)) {
          payment.lignes.forEach((line: any) => {
            if (line.isPaymentOnAccount === true) {
              // This line is a payment on account
              paymentsOnAccount[customerIdStr] = (paymentsOnAccount[customerIdStr] || 0) + (line.montantPaye || 0);
            } else if (line.factureId && line.isPaymentOnAccount !== true) {
              // Regular payment linked to an invoice
              const invoiceId = line.factureId.toString();
              invoicePayments[invoiceId] = (invoicePayments[invoiceId] || 0) + (line.montantPaye || 0);
            }
          });
        }
      }
      
      // Track advance used (reduces available advance balance)
      if (payment.advanceUsed && payment.advanceUsed > 0) {
        advanceUsed[customerIdStr] = (advanceUsed[customerIdStr] || 0) + payment.advanceUsed;
      }
    });

    // Get ALL customers first (not just those with unpaid invoices)
    const allCustomers = await (Customer as any)
      .find({
        tenantId,
        archive: false,
      })
      .select('_id raisonSociale nom prenom')
      .lean();

    // Initialize balances for ALL customers
    const customerBalances: {
      [key: string]: {
        customerId: string;
        customerNom: string;
        soldeDu: number;
        aging: {
          '0-30': number;
          '31-60': number;
          '61-90': number;
          '>90': number;
        };
        factures: any[];
        netAdvanceBalance?: number;
      };
    } = {};

    // Initialize all customers with zero balance
    allCustomers.forEach((customer: any) => {
      const customerIdStr = customer._id.toString();
      customerBalances[customerIdStr] = {
        customerId: customerIdStr,
        customerNom:
          customer.raisonSociale ||
          `${customer.nom || ''} ${customer.prenom || ''}`.trim() ||
          'Client inconnu',
        soldeDu: 0,
        aging: {
          '0-30': 0,
          '31-60': 0,
          '61-90': 0,
          '>90': 0,
        },
        factures: [],
        netAdvanceBalance: 0, // Will be calculated later
      };
    });

    // Track credit notes (avoir) - invoices with negative total or type AVOIR
    const creditNotes: { [key: string]: number } = {};

    // Process invoices
    invoices.forEach((invoice: any) => {
      const invoiceId = invoice._id.toString();
      const customerIdStr = invoice.customerId?.toString();
      if (!customerIdStr) return;

      const montantTotal = invoice.totalTTC || 0;
      const montantPaye = invoicePayments[invoiceId] || 0;
      const soldeRestant = montantTotal - montantPaye; // Allow negative values

      // Check if this is a credit note (avoir)
      const isCreditNote = invoice.type === 'AVOIR' || montantTotal < 0;
      if (isCreditNote) {
        creditNotes[customerIdStr] = (creditNotes[customerIdStr] || 0) + Math.abs(montantTotal);
        // For credit notes, we still track them but they reduce the balance
        return;
      }

      // Initialize customer balance if not exists (shouldn't happen, but safety check)
      if (!customerBalances[customerIdStr]) {
        customerBalances[customerIdStr] = {
          customerId: customerIdStr,
          customerNom: 'Client inconnu',
          soldeDu: 0,
          aging: {
            '0-30': 0,
            '31-60': 0,
            '61-90': 0,
            '>90': 0,
          },
          factures: [],
          netAdvanceBalance: 0,
        };
      }

      // Only process unpaid/partially paid invoices (soldeRestant > 0)
      if (soldeRestant > 0) {
        // Calculate due date
        const dateEcheance = calculateDateEcheance(
          new Date(invoice.dateDoc),
          invoice.conditionsPaiement
        );

        // Calculate aging
        const aging = getAgingBucket(dateEcheance, referenceDate);

        // Add to balance
        customerBalances[customerIdStr].soldeDu += soldeRestant;
        customerBalances[customerIdStr].aging[aging.bucket] += soldeRestant;
        customerBalances[customerIdStr].factures.push({
          _id: invoice._id,
          numero: invoice.numero,
          dateDoc: invoice.dateDoc,
          dateEcheance: dateEcheance,
          montantTotal,
          montantPaye,
          soldeRestant,
          statut: invoice.statut,
          conditionsPaiement: invoice.conditionsPaiement,
          aging: aging.bucket,
          joursEchus: aging.days,
        });
      }
    });

    // Subtract credit notes from balances (allow negative balances)
    Object.keys(creditNotes).forEach((customerIdStr) => {
      if (customerBalances[customerIdStr]) {
        customerBalances[customerIdStr].soldeDu -= creditNotes[customerIdStr];
      }
    });

    // Calculate net advance balance for each customer
    // netAdvanceBalance = payments on account - advance used
    // This represents the remaining available advance balance
    // NOTE: We DON'T subtract netAdvanceBalance from soldeDu because:
    // - soldeDu is already correct: it's calculated from soldeRestant (montantTotal - montantPaye)
    // - montantPaye already includes payments made using advance balance (advanceUsed)
    // - If we subtract netAdvanceBalance, we'd be double-counting:
    //   - First: montantPaye (which includes advanceUsed) reduces soldeRestant
    //   - Second: netAdvanceBalance (which includes -advanceUsed) reduces soldeDu
    // - netAdvanceBalance should only be displayed for informational purposes (available balance)
    // - soldeDu should show the actual amount owed (invoices - payments, where payments include advance usage)
    Object.keys(customerBalances).forEach((customerIdStr) => {
      const totalPaymentsOnAccount = paymentsOnAccount[customerIdStr] || 0;
      const totalAdvanceUsed = advanceUsed[customerIdStr] || 0;
      // Round to 3 decimal places to avoid floating point issues
      const netAdvanceBalance = Math.round((totalPaymentsOnAccount - totalAdvanceUsed) * 1000) / 1000;
      
      // Update netAdvanceBalance in customerBalances (for display only)
      customerBalances[customerIdStr].netAdvanceBalance = netAdvanceBalance;
      
      // soldeDu is already correct and doesn't need adjustment
      // It's calculated from soldeRestant which already accounts for all payments (including advance usage)
    });

    // Convert to array - include ALL customers (even with zero or negative balance)
    const balances = Object.values(customerBalances);

    // Sort by balance: positive first (descending), then zero, then negative (ascending by absolute value)
    balances.sort((a, b) => {
      // Both positive: sort descending
      if (a.soldeDu > 0 && b.soldeDu > 0) {
        return b.soldeDu - a.soldeDu;
      }
      // Both negative: sort ascending (less negative first, e.g., -100 before -200)
      if (a.soldeDu < 0 && b.soldeDu < 0) {
        return b.soldeDu - a.soldeDu; // b - a means -100 > -200, so -100 comes first
      }
      // Both zero: keep order
      if (a.soldeDu === 0 && b.soldeDu === 0) {
        return 0;
      }
      // Mixed: positive > zero > negative
      if (a.soldeDu > 0) return -1; // a is positive, should come first
      if (b.soldeDu > 0) return 1;  // b is positive, should come first
      if (a.soldeDu === 0) return -1; // a is zero, should come before negative
      if (b.soldeDu === 0) return 1;  // b is zero, should come before negative
      return 0;
    });

    // Calculate total (only positive balances - what customers owe us)
    const totalOwed = balances
      .filter((b) => b.soldeDu > 0)
      .reduce((sum, b) => sum + b.soldeDu, 0);

    return NextResponse.json({
      balances,
      referenceDate: referenceDate.toISOString(),
      total: totalOwed, // Total of what customers owe us (positive balances only)
    });
  } catch (error) {
    console.error('Erreur GET /api/customers/balances:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

