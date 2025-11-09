import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import Supplier from '@/lib/models/Supplier';
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

    // Get supplier info
    const supplier = await (Supplier as any).findOne({
      _id: id,
      tenantId,
    }).lean();

    if (!supplier) {
      return NextResponse.json({ error: 'Fournisseur non trouvé' }, { status: 404 });
    }

    const supplierName = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();

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

    // Get ALL purchase invoices (for summary calculation)
    const allInvoiceQuery: any = {
      societeId: tenantId,
      fournisseurId: id,
      statut: { $ne: 'ANNULEE' }, // Exclude cancelled invoices
    };

    // Apply date filter to all invoices query if provided
    if (dateDebut || dateFin) {
      allInvoiceQuery.dateFacture = dateFilter;
    }

    const allInvoices = await (PurchaseInvoice as any)
      .find(allInvoiceQuery)
      .sort({ dateFacture: -1, createdAt: -1 })
      .lean();

    // Get ALL payments (for summary calculation)
    const allPayments = await (PaiementFournisseur as any)
      .find({
        societeId: new mongoose.Types.ObjectId(tenantId),
        fournisseurId: new mongoose.Types.ObjectId(id),
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
      if (invoice.statut === 'ANNULEE') return;

      const invoiceId = invoice._id.toString();
      const montantTotal = invoice.totaux?.totalTTC || 0;
      const montantPaye = allInvoicePayments[invoiceId] || 0;
      const soldeRestant = montantTotal - montantPaye;
      const isCreditNote = montantTotal < 0;

      const dateEcheance = calculateDateEcheance(
        new Date(invoice.dateFacture),
        invoice.conditionsPaiement
      );

      const transaction = {
        id: invoice._id.toString(),
        type: isCreditNote ? 'avoir' : 'facture',
        numero: invoice.numero,
        reference: invoice.referenceFournisseur || '',
        date: invoice.dateFacture,
        dateEcheance: dateEcheance,
        montant: Math.abs(montantTotal),
        montantPaye: Math.abs(montantPaye),
        soldeRestant: isCreditNote ? -Math.abs(soldeRestant) : Math.abs(soldeRestant),
        statut: invoice.statut,
        devise: invoice.devise || 'TND',
        notes: invoice.notes || '',
        conditionsPaiement: invoice.conditionsPaiement || '',
        documentType: 'PurchaseInvoice',
      };

      // Always add to allTransactions for summary calculation
      allTransactions.push(transaction);

      // Add to filtered transactions if matches type filter
      // Note: Date filter is already applied in the query, search filter is applied here
      if (!type || type === 'all' || type === 'facture') {
        // Apply search filter for filtered transactions
        if (!search || 
            invoice.numero?.toLowerCase().includes(search.toLowerCase()) ||
            invoice.referenceFournisseur?.toLowerCase().includes(search.toLowerCase())) {
          filteredTransactions.push(transaction);
        }
      }
    });

    // Calculate net advance balance
    // First, calculate totals for all transaction types
    const totalFacturesAmount = allTransactions
      .filter(t => t.type === 'facture')
      .reduce((sum, t) => sum + t.montant, 0);
    const totalPaiementsAmount = allTransactions
      .filter(t => t.type === 'paiement')
      .reduce((sum, t) => sum + t.montant, 0);
    const totalAvoirsAmount = allTransactions
      .filter(t => t.type === 'avoir')
      .reduce((sum, t) => sum + t.montant, 0);
    
    // Calculate net advance balance
    // netAdvanceBalance = payments on account - advance used
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
    
    // Calculate net advance balance: payments on account - advance used
    // Round to 3 decimal places to avoid floating point issues
    const netAdvanceBalance = Math.round((totalPaymentsOnAccount - totalAdvanceUsed) * 1000) / 1000;

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
        documentType: 'PaiementFournisseur',
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
            payment.reference?.toLowerCase().includes(search.toLowerCase())) {
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
    // This ensures summary doesn't change when switching between Factures/Paiements tabs
    const summary = {
      // Total Factures: مجموع كل مبالغ الفواتير (من نوع 'facture')
      // Formula: Sum of all invoice amounts (montantTotal TTC)
      totalFactures: allTransactions
        .filter(t => t.type === 'facture')
        .reduce((sum, t) => sum + t.montant, 0),
      // Total Paiements: مجموع المبالغ المدفوعة للفواتير فقط (بدون دفعات على الحساب)
      // Formula: Sum of payment amounts for invoices only (exclude payments on account)
      // This includes:
      // 1. Regular payments linked to invoices (دفعات عادية مرتبطة بفواتير)
      // 2. Does NOT include payments on account (لا يشمل دفعات على الحساب)
      // The payment on account are tracked separately in soldeAvanceDisponible
      totalPaiements: allTransactions
        .filter(t => t.type === 'paiement' && !t.isPaymentOnAccount)
        .reduce((sum, t) => sum + t.montant, 0),
      // Total Avoirs: مجموع كل مبالغ الأور (credit notes)
      // Formula: Sum of all credit note amounts (montantTotal when negative)
      totalAvoirs: allTransactions
        .filter(t => t.type === 'avoir')
        .reduce((sum, t) => sum + t.montant, 0),
      // Solde Actuel calculation:
      // الرصيد الحالي = مجموع الفواتير - مجموع المدفوعات
      // 
      // 1. الفواتير (facture): montant = المبلغ الكامل للفاتورة (موجب)
      // 2. الأور (avoir): montant = المبلغ الكامل للائتمان (موجب، لكن سيُطرح)
      // 3. المدفوعات (paiement): montant = المبلغ المدفوع (موجب، لكن سيُطرح)
      // 
      // الصيغة: Solde Actuel = (مجموع الفواتير + الأور) - (مجموع المدفوعات)
      // أو: Solde Actuel = مجموع الفواتير - مجموع المدفوعات (حيث الأور تُحسب كفواتير سالبة)
      // 
      // Use allTransactions for summary (not filtered by type)
      soldeActuel: allTransactions.reduce((sum, t) => {
        if (t.type === 'facture') {
          // الفواتير: أضف المبلغ الكامل (موجب)
          return sum + (t.montant || 0);
        } else if (t.type === 'avoir') {
          // الأور: اطرح المبلغ (لأنها تقلل الرصيد)
          // أو يمكن اعتبارها فواتير سالبة
          return sum - (t.montant || 0);
        } else if (t.type === 'paiement') {
          // المدفوعات: اطرح المبلغ (لأنها تقلل الرصيد)
          return sum - (t.montant || 0);
        }
        return sum;
      }, 0),
      // Use allTransactions for summary (not filtered by type)
      facturesOuvertes: allTransactions
        .filter(t => t.type === 'facture' && t.soldeRestant > 0)
        .reduce((sum, t) => sum + t.soldeRestant, 0),
      // Solde avance disponible = المدفوعات على الحساب - المبلغ المستخدم من الرصيد المتقدم
      soldeAvanceDisponible: netAdvanceBalance,
    };

    return NextResponse.json({
      supplier: {
        id: supplier._id.toString(),
        nom: supplierName,
        email: supplier.email,
        telephone: supplier.telephone,
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
    console.error('Erreur GET /api/suppliers/[id]/transactions:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

