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
    const dueDate = new Date(dateDoc);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }

  const terms = conditionsPaiement.toLowerCase().trim();
  
  const joursMatch = terms.match(/(\d+)\s*jours?/);
  if (joursMatch) {
    const jours = parseInt(joursMatch[1], 10);
    const dueDate = new Date(dateDoc);
    dueDate.setDate(dueDate.getDate() + jours);
    return dueDate;
  }

  const finMoisMatch = terms.match(/fin\s+de\s+mois\s*\+?\s*(\d+)/);
  if (finMoisMatch) {
    const jours = parseInt(finMoisMatch[1], 10);
    const dueDate = new Date(dateDoc);
    dueDate.setMonth(dueDate.getMonth() + 1, 0);
    dueDate.setDate(dueDate.getDate() + jours);
    return dueDate;
  }

  if (terms.includes('comptant') || terms.includes('réception') || terms.includes('reception')) {
    return new Date(dateDoc);
  }

  const dueDate = new Date(dateDoc);
  dueDate.setDate(dueDate.getDate() + 30);
  return dueDate;
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
    
    // Filters
    const dateDebut = searchParams.get('dateDebut');
    const dateFin = searchParams.get('dateFin');
    const type = searchParams.get('type'); // 'facture', 'paiement', 'avoir', 'all'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get customer info
    const customer = await (Customer as any).findOne({
      _id: id,
      tenantId,
    }).lean();

    if (!customer) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });
    }

    const customerName = customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim();

    // Build date filter
    const dateFilter: any = {};
    if (dateDebut) {
      dateFilter.$gte = new Date(dateDebut);
    }
    if (dateFin) {
      const endDate = new Date(dateFin);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    // First, get ALL transactions for summary calculation (without type filter)
    const allTransactions: any[] = [];
    const filteredTransactions: any[] = [];

    // Get ALL customer invoices (for summary calculation)
    const allInvoiceQuery: any = {
      tenantId: tenantId,
      customerId: id,
      type: 'FAC',
      statut: { $nin: ['ANNULEE', 'annulee'] }, // Exclude cancelled invoices
    };

    // Apply date filter to all invoices query if provided
    if (dateDebut || dateFin) {
      allInvoiceQuery.dateDoc = dateFilter;
    }

    const allInvoices = await (Document as any)
      .find(allInvoiceQuery)
      .sort({ dateDoc: -1, createdAt: -1 })
      .lean();

    // Get ALL payments (for summary calculation)
    const allPayments = await (PaiementClient as any)
      .find({
        societeId: new mongoose.Types.ObjectId(tenantId),
        customerId: new mongoose.Types.ObjectId(id),
      })
      .lean();

    // Calculate paid amounts for all invoices
    const allInvoicePayments: { [key: string]: number } = {};
    allPayments.forEach((payment: any) => {
      if (!payment.lignes || !Array.isArray(payment.lignes)) {
        return;
      }
      payment.lignes.forEach((line: any) => {
        if (!line || !line.factureId || line.isPaymentOnAccount) {
          return;
        }
        try {
          const invoiceId = line.factureId.toString();
          allInvoicePayments[invoiceId] = (allInvoicePayments[invoiceId] || 0) + (line.montantPaye || 0);
        } catch (error) {
          console.warn('Invalid payment line:', line);
        }
      });
    });

    // Process all invoices for summary
    allInvoices.forEach((invoice: any) => {
      if (invoice.statut === 'ANNULEE' || invoice.statut === 'annulee') return;

      const invoiceId = invoice._id.toString();
      const montantTotal = invoice.totalTTC || 0;
      const montantPaye = allInvoicePayments[invoiceId] || 0;
      const soldeRestant = montantTotal - montantPaye;
      const isCreditNote = invoice.type === 'AVOIR' || montantTotal < 0;

      const dateEcheance = calculateDateEcheance(
        new Date(invoice.dateDoc),
        invoice.conditionsPaiement
      );

      const transaction = {
        id: invoice._id.toString(),
        type: isCreditNote ? 'avoir' : 'facture',
        numero: invoice.numero,
        reference: invoice.referenceExterne || invoice.numero || '',
        date: invoice.dateDoc,
        dateEcheance: dateEcheance,
        montant: Math.abs(montantTotal),
        montantPaye: Math.abs(montantPaye),
        soldeRestant: isCreditNote ? -Math.abs(soldeRestant) : Math.abs(soldeRestant),
        statut: invoice.statut,
        devise: invoice.devise || 'TND',
        notes: invoice.notes || '',
        conditionsPaiement: invoice.conditionsPaiement || '',
        documentType: 'Document',
      };

      // Always add to allTransactions for summary calculation
      allTransactions.push(transaction);

      // Add to filtered transactions if matches type filter
      const matchesType =
        !type ||
        type === 'all' ||
        (type === 'facture' && !isCreditNote) ||
        (type === 'avoir' && isCreditNote);

      if (
        matchesType &&
        (!search ||
          invoice.numero?.toLowerCase().includes(search.toLowerCase()) ||
          (invoice.referenceExterne &&
            invoice.referenceExterne.toLowerCase().includes(search.toLowerCase())))
      ) {
        filteredTransactions.push(transaction);
      }
    });

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

    allPayments.forEach((payment: any) => {
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
    console.log('=== SOLDE AVANCE DISPONIBLE CALCULATION (TRANSACTIONS) ===');
    console.log('Customer ID:', id);
    console.log('Total Payments:', allPayments.length);
    console.log('Total Payments on Account:', totalPaymentsOnAccount);
    console.log('Total Advance Used:', totalAdvanceUsed);
    console.log('Net Advance Balance:', netAdvanceBalance);
    console.log('===========================================================');

    // Process all payments for summary
    allPayments.forEach((payment: any) => {
      const isOnAccount = payment.isPaymentOnAccount || false;
      
      // Apply date filter
      if (dateDebut || dateFin) {
        const paymentDate = new Date(payment.datePaiement);
        if (dateDebut && paymentDate < new Date(dateDebut)) return;
        if (dateFin) {
          const endDate = new Date(dateFin);
          endDate.setHours(23, 59, 59, 999);
          if (paymentDate > endDate) return;
        }
      }

      const transaction = {
        id: payment._id.toString(),
        type: 'paiement',
        numero: payment.numero,
        reference: payment.reference || '',
        date: payment.datePaiement,
        dateEcheance: null,
        montant: payment.montantTotal,
        montantPaye: payment.montantTotal,
        soldeRestant: -payment.montantTotal,
        statut: isOnAccount ? 'PAYE_SUR_COMPTE' : 'PAYE',
        devise: 'TND',
        modePaiement: payment.modePaiement,
        notes: payment.notes || (isOnAccount ? 'Paiement sur compte' : ''),
        documentType: 'PaiementClient',
        isPaymentOnAccount: isOnAccount,
        lignes: payment.lignes
          ?.filter((ligne: any) => !ligne.isPaymentOnAccount || ligne.numeroFacture)
          .map((ligne: any) => ({
            factureNumero: ligne.numeroFacture || 'Paiement sur compte',
            montantPaye: ligne.montantPaye,
          })) || [],
      };

      allTransactions.push(transaction);

      // Add to filtered transactions if matches type filter
      if (!type || type === 'all' || type === 'paiement') {
        // Apply search filter for filtered transactions
        if (!search || 
            payment.numero?.toLowerCase().includes(search.toLowerCase()) ||
            (payment.reference && payment.reference.toLowerCase().includes(search.toLowerCase()))) {
          filteredTransactions.push(transaction);
        }
      }
    });

    // Use filteredTransactions for display, allTransactions for summary
    const transactions = filteredTransactions;

    // Sort filtered transactions by date (descending)
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Pagination
    const total = transactions.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);

    // Calculate summary using ALL transactions (not filtered by type)
    const summary = {
      totalFactures: allTransactions
        .filter(t => t.type === 'facture')
        .reduce((sum, t) => sum + t.montant, 0),
      totalPaiements: allTransactions
        .filter(t => t.type === 'paiement' && !t.isPaymentOnAccount)
        .reduce((sum, t) => sum + t.montant, 0),
      totalAvoirs: allTransactions
        .filter(t => t.type === 'avoir')
        .reduce((sum, t) => sum + t.montant, 0),
      soldeActuel: allTransactions.reduce((sum, t) => {
        if (t.type === 'facture') {
          return sum + (t.montant || 0);
        } else if (t.type === 'avoir') {
          return sum - (t.montant || 0);
        } else if (t.type === 'paiement') {
          return sum - (t.montant || 0);
        }
        return sum;
      }, 0),
      facturesOuvertes: allTransactions
        .filter(t => t.type === 'facture' && t.soldeRestant > 0)
        .reduce((sum, t) => sum + t.soldeRestant, 0),
      soldeAvanceDisponible: netAdvanceBalance,
    };

    return NextResponse.json({
      customer: {
        id: customer._id.toString(),
        nom: customerName,
        email: customer.email,
        telephone: customer.telephone,
      },
      transactions: paginatedTransactions,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erreur GET /api/customers/[id]/transactions:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

