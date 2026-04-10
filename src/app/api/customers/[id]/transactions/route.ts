import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import PaiementClient from '@/lib/models/PaiementClient';
import Customer from '@/lib/models/Customer';
import mongoose from 'mongoose';

// Helper: Calculate due date
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
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);

    // Filters
    const dateDebut = searchParams.get('dateDebut');
    const dateFin = searchParams.get('dateFin');
    const type = searchParams.get('type'); // 'facture', 'paiement', 'avoir', 'devis', 'commande', 'livraison', 'all'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch Customer
    const customer = await (Customer as any).findOne({ _id: id, tenantId }).lean();
    if (!customer) return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 });

    const customerObjectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

    // Build Date Filter
    let dateFilter: any = undefined;
    if (dateDebut || dateFin) {
      dateFilter = {};
      if (dateDebut) dateFilter.$gte = new Date(dateDebut);
      if (dateFin) {
        const endDate = new Date(dateFin);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
    }

    // Determine which document types to fetch
    const docTypesToFetch: string[] = [];
    if (type === 'facture' || type === 'all' || !type) docTypesToFetch.push('FAC', 'INT_FAC');
    if (type === 'avoir' || type === 'all' || !type) docTypesToFetch.push('AVOIR');
    if (type === 'devis' || type === 'all' || !type) docTypesToFetch.push('DEVIS');
    if (type === 'commande' || type === 'all' || !type) docTypesToFetch.push('BC');
    if (type === 'livraison' || type === 'all' || !type) docTypesToFetch.push('BL');

    let allDocs: any[] = [];
    if (docTypesToFetch.length > 0) {
      const docQuery: any = {
        tenantId,
        customerId: { $in: [customerObjectId, id.toString()] },
        type: { $in: docTypesToFetch },
        statut: { $nin: ['annulee', 'ANNULEE'] } // Consider if we want to show cancelled ones? Typically yes but status badge handles it. Original code filtered them out. Let's keep filtering OUT for now unless requested.
        // Actually, user wants to see their documents. Cancelled documents are still documents. 
        // The original code filtered filtered them out: statut: { $nin: ['ANNULEE', 'annulee'] }
        // I'll stick to original logic but maybe I should include them.
      };
      // Override status filter for now to match original behavior, or remove it?
      // Let's remove the exclusion of ANNULEE so users can see cancelled quotes/orders too.
      delete docQuery.statut; // Show all statuses

      if (dateFilter) docQuery.dateDoc = dateFilter;
      if (search) {
        docQuery.$or = [
          { numero: { $regex: search, $options: 'i' } },
          { referenceExterne: { $regex: search, $options: 'i' } }
        ];
      }

      allDocs = await (Document as any).find(docQuery).lean();
    }

    // Fetch ALL payments for this customer (ignoring filters) to calculate:
    // 1. Global invoice payment status
    // 2. FIFO Advance usage (Solde Restant for On-Account payments)
    // 3. Global Summary stats
    const allTimePayments = await (PaiementClient as any).find({
      societeId: new mongoose.Types.ObjectId(tenantId),
      customerId: customerObjectId
    }).lean().sort({ datePaiement: 1, numero: 1 }); // Sort ASC for FIFO

    // Calculate FIFO Usage of Advances
    let totalAdvanceUsed = allTimePayments.reduce((sum: number, p: any) => sum + (p.advanceUsed || 0), 0);
    const advanceInfoMap: { [key: string]: number } = {}; // Map paymentId -> remainingAmount

    allTimePayments.forEach((p: any) => {
      // If this is a source of credit (Payment On Account OR Mixed payment with on-account lines)
      // Note: mixed payments are rare but 'isPaymentOnAccount' or lines check handles it.
      // We look at lines specifically for precise credit amount.
      const creditAmount = (p.lignes || []).reduce((sum: number, l: any) =>
        l.isPaymentOnAccount ? sum + (l.montantPaye || 0) : sum, 0
      );

      if (creditAmount > 0) {
        // FIFO: Consume this credit with the global usage
        const usedFromThis = Math.min(creditAmount, totalAdvanceUsed);
        const remaining = creditAmount - usedFromThis;
        advanceInfoMap[p._id.toString()] = remaining;

        // Decrease global usage counter
        totalAdvanceUsed -= usedFromThis;
      }
    });

    // Build map for invoice status checks
    let globalInvoicePaymentsMap: { [key: string]: number } = {};
    allTimePayments.forEach((p: any) => {
      if (p.lignes && Array.isArray(p.lignes)) {
        p.lignes.forEach((l: any) => {
          if (l.factureId && !l.isPaymentOnAccount) {
            const invId = l.factureId.toString();
            globalInvoicePaymentsMap[invId] = (globalInvoicePaymentsMap[invId] || 0) + (l.montantPaye || 0);
          }
        });
      }
    });


    // Fetch Payments for the List View (Filtered)
    let listPayments: any[] = [];
    if (type === 'paiement' || type === 'all' || !type) {
      // We can filter in memory from allTimePayments if the dataset isn't huge, 
      // OR re-query if we want to rely on DB for complex filtering.
      // Given we already have allTimePayments, let's filter in memory to save a DB call 
      // UNLESS we need strict DB matching. 
      // Let's stick to the original pattern of querying for the list to ensure consistent behavior with search/dates
      // strictly matching the previous logic.
      const payQuery: any = {
        societeId: new mongoose.Types.ObjectId(tenantId),
        customerId: customerObjectId
      };
      if (dateFilter) payQuery.datePaiement = dateFilter;
      if (search) {
        payQuery.$or = [
          { numero: { $regex: search, $options: 'i' } },
          { reference: { $regex: search, $options: 'i' } }
        ];
      }
      listPayments = await (PaiementClient as any).find(payQuery).lean();
    }


    // Process Documents into Transactions
    const transactions: any[] = [];

    allDocs.forEach((doc: any) => {
      let docType = 'facture';
      if (doc.type === 'AVOIR') docType = 'avoir';
      else if (doc.type === 'DEVIS') docType = 'devis';
      else if (doc.type === 'BC') docType = 'commande';
      else if (doc.type === 'BL') docType = 'livraison';
      else if (doc.type === 'FAC' || doc.type === 'INT_FAC') docType = 'facture';

      const montantTotal = doc.totalTTC || doc.totalBaseHT || 0;
      let montantPaye = 0;
      let soldeRestant = 0;

      if (docType === 'facture' || docType === 'avoir') {
        const paid = globalInvoicePaymentsMap[doc._id.toString()] || 0;
        montantPaye = Math.abs(paid);
        const total = Math.abs(montantTotal);
        soldeRestant = docType === 'avoir' ? -(total - montantPaye) : (total - montantPaye);
      } else {
        // For Devis, BC, BL, we don't track payments directly usually
        montantPaye = 0;
        soldeRestant = montantTotal;
      }

      transactions.push({
        id: doc._id.toString(),
        type: docType,
        numero: doc.numero,
        reference: doc.referenceExterne || doc.numero || '',
        date: doc.dateDoc,
        dateEcheance: doc.dateEcheance || null,
        montant: Math.abs(montantTotal),
        montantPaye: montantPaye,
        soldeRestant: soldeRestant,
        statut: doc.statut,
        devise: doc.devise || 'TND',
        notes: doc.notes || '',
        documentType: 'Document',
        invoiceType: doc.type
      });
    });

    // Process Payments into Transactions
    listPayments.forEach((p: any) => {
      const isOnAccount = p.isPaymentOnAccount || false;

      // Calculate how much of the payment is actually used
      let amountUsed = 0;
      if (p.lignes && Array.isArray(p.lignes)) {
        amountUsed = p.lignes.reduce((sum: number, ligne: any) => {
          // If line is 'on account', it's not 'used' in the sense of paying an invoice
          return ligne.isPaymentOnAccount ? sum : sum + (ligne.montantPaye || 0);
        }, 0);
      }

      // Determining "Remaining" (Solde Restant) for this payment row:
      let amountUnused = 0;

      if (isOnAccount) {
        // If it is an advance payment, use the FIFO calculated remaining balance
        // If the ID is not in map (shouldn't happen for advance), fallback to naive calc
        if (advanceInfoMap[p._id.toString()] !== undefined) {
          amountUnused = advanceInfoMap[p._id.toString()];
        } else {
          amountUnused = Math.max(0, p.montantTotal - amountUsed);
        }
      } else {
        // If normal payment, check if it has any mixed on-account lines?
        // For now, normal payments usually fully used or excess is lost/not tracked unless strict mixed mode.
        // BUT, we calculated `advanceInfoMap` for ALL payments that have on-account lines.
        if (advanceInfoMap[p._id.toString()] !== undefined) {
          amountUnused = advanceInfoMap[p._id.toString()];
        } else {
          // Standard unused amount logic for robust display
          amountUnused = Math.max(0, p.montantTotal - amountUsed);
        }
      }

      transactions.push({
        id: p._id.toString(),
        type: 'paiement',
        numero: p.numero,
        reference: p.reference || '',
        date: p.datePaiement,
        dateEcheance: null,
        montant: p.montantTotal,
        montantPaye: amountUsed, // Show how much was assigned to invoices
        soldeRestant: -amountUnused, // Negative means credit (money available to use)
        statut: isOnAccount ? 'PAYE_SUR_COMPTE' : 'PAYE',
        devise: 'TND',
        documentType: 'PaiementClient',
        isPaymentOnAccount: isOnAccount,
        lignes: p.lignes
      });
    });

    // Sort
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    // Pagination
    const total = transactions.length;
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);

    // Summary (Calculate based on ALL fetched, not just paginated)
    // Note: If filters applied (date, search), summary reflects filtered data.
    // Calculate Global Solde Avance Disponible AND other stats (ignoring filters)

    // OLD LOCATION OF duplicate logic removed from here
    // Variables allTimePayments, globalInvoicePaymentsMap, allTimeDocs are already available from top scope.

    // We need to fetch allTimeDocs if we haven't already (we defined logic for it but check if it was declared)
    // Wait, we defined `allDocs` (filtered) but `allTimeDocs` (unfiltered) was part of the block we need to keep or move?

    // Check line 299 in original file: `const allTimeDocs = ...`
    // We should keep `allTimeDocs` fetch here IF it wasn't moved to top. 
    // Looking at file: `allTimeDocs` is NOT at the top. So we keep it.

    // Fetch all docs for this customer to calc global stats if not already fetched
    const allTimeDocs = await (Document as any).find({
      tenantId,
      customerId: { $in: [customerObjectId, id.toString()] },
      type: { $in: ['FAC', 'INT_FAC', 'AVOIR'] },
      statut: { $nin: ['annulee', 'ANNULEE'] }
    }).select('type totalTTC totalBaseHT _id status').lean();

    // The `globalInvoicePaymentsMap` was already built at line 147. We do NOT need to rebuild it or redeclare it.
    // References to it below (line 355) will use the top-level variable.


    // 2. Calculate Stats
    let totalFactures = 0;
    let totalAvoirs = 0;
    let facturesOuvertes = 0;
    let globalSoldeAvance = 0;
    // Total Payments = Sum of (Total Amount - Advance Used)
    // This ensures we only count NEW money coming in, not recycling of advance credit.
    let totalPaiements = allTimePayments.reduce((sum: number, p: any) => {
      const amount = p.montantTotal || 0;
      const usedAdvance = p.advanceUsed || 0;
      // The real money inflow is Total amount minus amount paid by Advance
      return sum + Math.max(0, amount - usedAdvance);
    }, 0);

    // Calc Solde Avance
    allTimePayments.forEach((p: any) => {
      // Credit comes from lines marked as on account
      const creditFromLines = (p.lignes || []).reduce((s: number, l: any) => {
        return l.isPaymentOnAccount ? s + (l.montantPaye || 0) : s;
      }, 0);

      // Debit comes from using advance in other payments
      const advanceUsed = p.advanceUsed || 0;

      globalSoldeAvance += (creditFromLines - advanceUsed);
    });

    // Calc Factures/Avoirs/Ouvertes
    allTimeDocs.forEach((doc: any) => {
      const amount = doc.totalTTC || doc.totalBaseHT || 0;
      if (doc.type === 'AVOIR') {
        totalAvoirs += amount;
      } else {
        totalFactures += amount;
        // Check open balance
        const paid = globalInvoicePaymentsMap[doc._id.toString()] || 0;
        const remaining = Math.max(0, amount - paid);
        if (remaining > 0.001) {
          facturesOuvertes += remaining;
        }
      }
    });

    const summary = {
      totalFactures,
      totalPaiements,
      totalAvoirs,
      facturesOuvertes,
      soldeAvanceDisponible: globalSoldeAvance,
      soldeActuel: 0 // Logic complex, skipping for now or strictly based on filtered
    };

    return NextResponse.json({
      customer: {
        id: customer._id.toString(),
        nom: customer.raisonSociale || `${customer.nom} ${customer.prenom}`,
        email: customer.email,
        telephone: customer.telephone
      },
      transactions: paginatedTransactions,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error in customer transactions API:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
