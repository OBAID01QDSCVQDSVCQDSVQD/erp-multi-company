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
    
    console.log(`[Customer Transactions] Customer found: ${customerName}, ID: ${id}, Tenant: ${tenantId}`);

    // Convert customerId to ObjectId - try multiple formats
    const customerObjectId = mongoose.Types.ObjectId.isValid(id) 
      ? new mongoose.Types.ObjectId(id)
      : id;

    // Build date filter if provided
    let dateFilter: any = undefined;
    if (dateDebut || dateFin) {
      dateFilter = {};
      if (dateDebut) {
        dateFilter.$gte = new Date(dateDebut);
      }
      if (dateFin) {
        const endDate = new Date(dateFin);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
    }

    // Try multiple queries to find ALL invoices for this customer
    // Some invoices might have customerId as ObjectId, some as string
    const invoiceQuery1: any = {
      tenantId: tenantId,
      customerId: customerObjectId, // Try as ObjectId
      type: { $in: ['FAC', 'INT_FAC'] },
      statut: { $nin: ['ANNULEE', 'annulee'] },
    };
    if (dateFilter) invoiceQuery1.dateDoc = dateFilter;

    const invoiceQuery2: any = {
      tenantId: tenantId,
      customerId: id.toString(), // Try as string
      type: { $in: ['FAC', 'INT_FAC'] },
      statut: { $nin: ['ANNULEE', 'annulee'] },
    };
    if (dateFilter) invoiceQuery2.dateDoc = dateFilter;

    const invoiceQuery3: any = {
      tenantId: tenantId,
      customerId: { $in: [customerObjectId, id.toString(), id] }, // Try all formats
      type: { $in: ['FAC', 'INT_FAC'] },
      statut: { $nin: ['ANNULEE', 'annulee'] },
    };
    if (dateFilter) invoiceQuery3.dateDoc = dateFilter;

    // Execute all queries in parallel
    const [invoices1, invoices2, invoices3] = await Promise.all([
      (Document as any).find(invoiceQuery1).lean(),
      (Document as any).find(invoiceQuery2).lean(),
      (Document as any).find(invoiceQuery3).lean(),
    ]);

    // Merge results and remove duplicates
    const allInvoicesMap = new Map();
    [...invoices1, ...invoices2, ...invoices3].forEach((inv: any) => {
      allInvoicesMap.set(inv._id.toString(), inv);
    });
    
    const allInvoices = Array.from(allInvoicesMap.values())
      .sort((a: any, b: any) => new Date(b.dateDoc || b.createdAt).getTime() - new Date(a.dateDoc || a.createdAt).getTime());

    console.log(`[Customer Transactions] Query results: ObjectId=${invoices1.length}, String=${invoices2.length}, All=${invoices3.length}, Total unique=${allInvoices.length}`);
    console.log(`[Customer Transactions] Found ${allInvoices.length} invoices for customer ${id}`);
    
    // Debug: Log invoice details
    if (allInvoices.length > 0) {
      console.log(`[Customer Transactions] Sample invoices:`, allInvoices.slice(0, 3).map((inv: any) => ({
        numero: inv.numero,
        type: inv.type,
        customerId: inv.customerId?.toString() || inv.customerId,
        customerIdType: typeof inv.customerId
      })));
    } else {
      // If no invoices found, try comprehensive debug queries
      console.log(`[Customer Transactions] DEBUG - No invoices found, running debug queries...`);
      
      // Query 1: All documents for this customerId (any type, any status)
      const debugQuery1: any = {
        tenantId: tenantId,
        customerId: { $in: [customerObjectId, id.toString(), id] },
      };
      const debugInvoices1 = await (Document as any).find(debugQuery1).select('numero type customerId statut tenantId').limit(20).lean();
      console.log(`[Customer Transactions] DEBUG Query 1 - All documents (any type/status): ${debugInvoices1.length}`, debugInvoices1.map((inv: any) => ({
        numero: inv.numero,
        type: inv.type,
        statut: inv.statut,
        customerId: inv.customerId?.toString(),
        customerIdType: typeof inv.customerId
      })));
      
      // Query 2: All FAC/INT_FAC invoices for this tenant (any customer)
      const debugQuery2: any = {
        tenantId: tenantId,
        type: { $in: ['FAC', 'INT_FAC'] },
      };
      const debugInvoices2 = await (Document as any).find(debugQuery2).select('numero type customerId statut').limit(10).lean();
      console.log(`[Customer Transactions] DEBUG Query 2 - All FAC/INT_FAC in tenant (first 10):`, debugInvoices2.map((inv: any) => ({
        numero: inv.numero,
        type: inv.type,
        customerId: inv.customerId?.toString(),
        customerIdMatches: inv.customerId?.toString() === id || inv.customerId?.toString() === customerObjectId.toString()
      })));
      
      // Query 3: Count total invoices for this tenant
      const totalInvoicesCount = await (Document as any).countDocuments({
        tenantId: tenantId,
        type: { $in: ['FAC', 'INT_FAC'] },
      });
      console.log(`[Customer Transactions] DEBUG Query 3 - Total FAC/INT_FAC invoices in tenant: ${totalInvoicesCount}`);
    }

    // Get ALL payments for this customer
    const paymentQuery: any = {
      societeId: new mongoose.Types.ObjectId(tenantId),
      customerId: customerObjectId,
    };

    // Apply date filter to payments if provided
    if (dateDebut || dateFin) {
      const dateFilter: any = {};
      if (dateDebut) {
        dateFilter.$gte = new Date(dateDebut);
      }
      if (dateFin) {
        const endDate = new Date(dateFin);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      paymentQuery.datePaiement = dateFilter;
    }

    const allPayments = await (PaiementClient as any)
      .find(paymentQuery)
      .lean();

    console.log(`[Customer Transactions] Found ${allPayments.length} payments for customer ${id}`);

    // Calculate paid amounts for each invoice
    const invoicePayments: { [key: string]: number } = {};
    allPayments.forEach((payment: any) => {
      if (payment.lignes && Array.isArray(payment.lignes)) {
        payment.lignes.forEach((line: any) => {
          if (line.factureId && !line.isPaymentOnAccount) {
            const invoiceId = line.factureId.toString();
            invoicePayments[invoiceId] = (invoicePayments[invoiceId] || 0) + (line.montantPaye || 0);
          }
        });
      }
    });

    // Build transactions array from invoices
    const allTransactions: any[] = [];
    
    allInvoices.forEach((invoice: any) => {
      const invoiceId = invoice._id.toString();
      const montantTotal = invoice.totalTTC || invoice.totalBaseHT || 0;
      const montantPaye = invoicePayments[invoiceId] || 0;
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
        invoiceType: invoice.type, // 'FAC' or 'INT_FAC'
      };

      allTransactions.push(transaction);
    });

    // Build transactions array from payments
    allPayments.forEach((payment: any) => {
      const isOnAccount = payment.isPaymentOnAccount || false;
      
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
    });

    // Calculate advance balance
    let totalPaymentsOnAccount = 0;
    let totalAdvanceUsed = 0;

    allPayments.forEach((payment: any) => {
      const paymentTotalFromLignes = payment.lignes && Array.isArray(payment.lignes)
        ? payment.lignes.reduce((sum: number, line: any) => sum + (line.montantPaye || 0), 0)
        : 0;

      if (payment.isPaymentOnAccount === true) {
        totalPaymentsOnAccount += paymentTotalFromLignes;
      } else {
        if (payment.lignes && Array.isArray(payment.lignes)) {
          payment.lignes.forEach((line: any) => {
            if (line.isPaymentOnAccount === true) {
              totalPaymentsOnAccount += line.montantPaye || 0;
            }
          });
        }
      }

      if (payment.advanceUsed && payment.advanceUsed > 0) {
        totalAdvanceUsed += payment.advanceUsed;
      }
    });

    const netAdvanceBalance = Math.round((totalPaymentsOnAccount - totalAdvanceUsed) * 1000) / 1000;

    // Apply filters to transactions
    let filteredTransactions = allTransactions;

    // Filter by type
    if (type && type !== 'all') {
      filteredTransactions = filteredTransactions.filter((t) => {
        if (type === 'facture') return t.type === 'facture';
        if (type === 'paiement') return t.type === 'paiement';
        if (type === 'avoir') return t.type === 'avoir';
        return true;
      });
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTransactions = filteredTransactions.filter((t) => {
        return (
          t.numero?.toLowerCase().includes(searchLower) ||
          t.reference?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by date (descending)
    filteredTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Pagination
    const total = filteredTransactions.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

    // Calculate summary from ALL transactions (before filtering)
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

    console.log(`[Customer Transactions] Summary: ${allInvoices.length} invoices, ${allPayments.length} payments, ${filteredTransactions.length} filtered transactions`);

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
