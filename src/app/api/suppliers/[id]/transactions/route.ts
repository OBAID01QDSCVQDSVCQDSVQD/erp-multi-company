import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import Document from '@/lib/models/Document';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import PurchaseOrder from '@/lib/models/PurchaseOrder';
import Reception from '@/lib/models/Reception';
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
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);

    // Filters
    const dateDebut = searchParams.get('dateDebut');
    const dateFin = searchParams.get('dateFin');
    const type = searchParams.get('type'); // 'facture', 'paiement', 'avoir', 'commande', 'reception', 'all'
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get supplier info
    const supplier = await (Supplier as any).findOne({ _id: id, tenantId }).lean();
    if (!supplier) return NextResponse.json({ error: 'Fournisseur non trouvé' }, { status: 404 });

    // Date Filter Construction
    const dateFilter: any = {};
    if (dateDebut) dateFilter.$gte = new Date(dateDebut);
    if (dateFin) {
      const endDate = new Date(dateFin);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }
    const hasDateFilter = dateDebut || dateFin;

    // --- Fetching Data ---
    let transactions: any[] = [];
    const supplierObjectId = new mongoose.Types.ObjectId(id);

    // 1. Purchase Orders
    if (!type || type === 'all' || type === 'commande') {
      const query: any = { societeId: tenantId, fournisseurId: id }; // PO usually stores IDs as strings? Model def says string.
      if (hasDateFilter) query.dateDoc = dateFilter;
      if (search) {
        query.$or = [
          { numero: { $regex: search, $options: 'i' } }
        ];
      }

      const orders = await (PurchaseOrder as any).find(query).lean();
      orders.forEach((o: any) => {
        transactions.push({
          id: o._id.toString(),
          type: 'commande',
          numero: o.numero,
          reference: '', // PO usually doesn't have ext ref?
          date: o.dateDoc,
          dateEcheance: null,
          montant: o.totalTTC || 0,
          montantPaye: 0,
          soldeRestant: o.totalTTC || 0,
          statut: o.statut,
          devise: o.devise || 'TND',
          notes: o.notes || '',
          documentType: 'PurchaseOrder'
        });
      });
    }

    // 2. Receptions
    if (!type || type === 'all' || type === 'reception') {
      const query: any = { societeId: tenantId, fournisseurId: id };
      if (hasDateFilter) query.dateDoc = dateFilter;
      if (search) {
        query.$or = [
          { numero: { $regex: search, $options: 'i' } }
        ];
      }

      const receptions = await (Reception as any).find(query).lean();
      receptions.forEach((r: any) => {
        transactions.push({
          id: r._id.toString(),
          type: 'reception',
          numero: r.numero,
          reference: r.purchaseOrderId ? `PO: ${r.purchaseOrderId}` : '',
          date: r.dateDoc,
          dateEcheance: null,
          montant: r.totaux?.totalTTC || 0,
          montantPaye: 0,
          soldeRestant: r.totaux?.totalTTC || 0,
          statut: r.statut,
          devise: 'TND', // Reception model implies local usually
          notes: r.notes || '',
          documentType: 'Reception'
        });
      });
    }

    // 3. Purchase Invoices & Avoirs
    if (!type || type === 'all' || type === 'facture' || type === 'avoir') {
      const query: any = { societeId: tenantId, fournisseurId: id };

      if (hasDateFilter) query.dateFacture = dateFilter;
      if (search) {
        query.$or = [
          { numero: { $regex: search, $options: 'i' } },
          { referenceFournisseur: { $regex: search, $options: 'i' } }
        ];
      }
      if (type === 'facture') query.type = { $ne: 'AVOIRFO' }; // Keep filtering invoices

      // Avoir Query (Document model)
      const avoirQuery: any = { tenantId: tenantId, supplierId: id, type: 'AVOIRFO', statut: { $ne: 'ANNULEE' } };
      if (hasDateFilter) avoirQuery.dateDoc = dateFilter;
      if (search) avoirQuery.numero = { $regex: search, $options: 'i' };

      // Fetch parallel
      const [invoices, avoirdocs, allPayments] = await Promise.all([
        (PurchaseInvoice as any).find(query).lean(),
        Document.find(avoirQuery).lean(),
        (PaiementFournisseur as any).find({
          societeId: new mongoose.Types.ObjectId(tenantId),
          fournisseurId: supplierObjectId
        }).lean()
      ]);

      const invoicePaymentsMap: { [key: string]: number } = {};
      allPayments.forEach((p: any) => {
        if (p.lignes && Array.isArray(p.lignes)) {
          p.lignes.forEach((l: any) => {
            if (l.factureId && !l.isPaymentOnAccount) {
              invoicePaymentsMap[l.factureId.toString()] = (invoicePaymentsMap[l.factureId.toString()] || 0) + (l.montantPaye || 0);
            }
          });
        }
      });

      // Process Invoices
      invoices.forEach((invoice: any) => {
        const montantTotal = (invoice.totalTTC ?? invoice.totaux?.totalTTC) || 0;
        const isCreditNote = invoice.type === 'AVOIRFO' || montantTotal < 0;

        // Skip if looking for Avoirs only and this is an invoice (unless it's an old-style avoir in PI collection)
        if (type === 'avoir' && !isCreditNote) return;
        // Skip if looking for Invoices only and this is an old-style avoir
        if (type === 'facture' && isCreditNote) return;

        const paid = invoicePaymentsMap[invoice._id.toString()] || 0;
        const montantPaye = Math.abs(paid);
        const total = Math.abs(montantTotal);
        const solde = isCreditNote ? -(total - montantPaye) : (total - montantPaye);

        transactions.push({
          id: invoice._id.toString(),
          type: isCreditNote ? 'avoir' : 'facture',
          numero: invoice.numero,
          reference: invoice.referenceFournisseur || '',
          date: invoice.dateFacture,
          dateEcheance: calculateDateEcheance(new Date(invoice.dateFacture), invoice.conditionsPaiement),
          montant: total,
          montantPaye: montantPaye,
          soldeRestant: solde,
          statut: invoice.statut,
          devise: invoice.devise || 'TND',
          notes: invoice.notes || '',
          documentType: 'PurchaseInvoice'
        });
      });

      // Process New Avoirs (Document model)
      if (type !== 'facture') {
        avoirdocs.forEach((avoir: any) => {
          let paid = invoicePaymentsMap[avoir._id.toString()] || 0;

          // Add conversion payments which are not in invoicePaymentsMap
          if (avoir.paiements && Array.isArray(avoir.paiements)) {
            avoir.paiements.forEach((p: any) => {
              if (p.mode === 'Conversion vers Solde') {
                paid += (p.montant || 0);
              }
            });
          }

          const montantPaye = Math.abs(paid);
          const total = avoir.totalTTC || 0;
          // Solde is negative of (Total - Used)
          const solde = -(total - montantPaye);

          transactions.push({
            id: avoir._id.toString(),
            type: 'avoir',
            numero: avoir.numero,
            reference: avoir.referenceExterne || '',
            date: avoir.dateDoc,
            dateEcheance: null,
            montant: total,
            montantPaye: montantPaye,
            soldeRestant: solde,
            statut: avoir.statut,
            devise: avoir.devise || 'TND',
            notes: avoir.notes || '',
            documentType: 'Document'
          });
        });
      }
    }

    // 4. Payments
    if (!type || type === 'all' || type === 'paiement') {
      const query: any = { societeId: new mongoose.Types.ObjectId(tenantId), fournisseurId: supplierObjectId };
      if (hasDateFilter) query.datePaiement = dateFilter;
      if (search) {
        query.$or = [
          { numero: { $regex: search, $options: 'i' } },
          { reference: { $regex: search, $options: 'i' } }
        ];
      }

      const payments = await (PaiementFournisseur as any).find(query).lean();
      payments.forEach((p: any) => {
        const isOnAccount = p.isPaymentOnAccount || false;
        transactions.push({
          id: p._id.toString(),
          type: 'paiement',
          numero: p.numero,
          reference: p.reference || '',
          date: p.datePaiement,
          dateEcheance: null,
          montant: p.montantTotal,
          montantPaye: p.montantTotal,
          soldeRestant: -p.montantTotal,
          statut: isOnAccount ? 'PAYE_SUR_COMPTE' : 'PAYE',
          devise: 'TND',
          modePaiement: p.modePaiement,
          notes: p.notes || (isOnAccount ? 'Paiement sur compte' : ''),
          documentType: 'PaiementFournisseur',
          isPaymentOnAccount: isOnAccount,
          lignes: p.lignes
        });
      });
    }

    // Sort
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Pagination
    const total = transactions.length;
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);

    // Summary - Recalculate based on full dataset (unfiltered by current view limit but considering type for correctness if needed, or global?)
    // Original code did NOT filter summary by type of view, but by *all types*.
    // And it fetched *all* invoices/payments to do so.
    // For performance, we might want to do aggregation properly, but for now I'll stick to a simplified summary or recalculate full if needed.
    // To replicate original summary, we need ALL invoices and ALL payments regardless of current valid filters?
    // User expects summary of *the supplier*, not just the search results?
    // Actually, dashboard summary usually is global.
    // I will do a separate lightweight aggregation for summary to ensure it's accurate and fast.

    // Aggregation for Summary
    const summary: any = {
      totalFactures: 0,
      totalPaiements: 0,
      totalAvoirs: 0,
      soldeActuel: 0,
      facturesOuvertes: 0,
      soldeAvanceDisponible: 0
    };

    // Calculate Summary efficiently
    // This part can be optimized later. For now, if current fetched transactions are subsets (due to search/date), summary might be misleading if we only sum them.
    // Let's assume for now summary is based on *displayed/filtered* results OR skip it if it's too heavy.
    // But existing page relied on it.
    // I will try to fetch global totals using aggregations in a future step if performance is key.
    // For now, to keep response fast, I'll return 0s or calculated from fetched if "all" was fetched.
    // OR: I'll execute the separate aggregation queries logic from original file but keep it concise?
    // The original file fetched EVERYTHING. That is bad for scale.
    // I will IMPLEMENT minimal aggregation for summary.

    // Summary Aggregation:
    const invoiceAgg = await (PurchaseInvoice as any).aggregate([
      { $match: { societeId: tenantId, fournisseurId: id, statut: { $ne: 'ANNULEE' } } },
      {
        $project: {
          montant: { $ifNull: ["$totalTTC", "$totaux.totalTTC"] },
          type: 1
        }
      },
      {
        $group: {
          _id: { $cond: [{ $or: [{ $eq: ["$type", "AVOIRFO"] }, { $lt: ["$montant", 0] }] }, "avoir", "facture"] },
          total: { $sum: { $abs: "$montant" } }
        }
      }
    ]);

    invoiceAgg.forEach((curr: any) => {
      if (curr._id === 'facture') summary.totalFactures = curr.total;
      if (curr._id === 'avoir') summary.totalAvoirs = curr.total;
    });

    // New Document Aggregation for Avoirs (from 'documents' collection)
    const documentAgg = await Document.aggregate([
      { $match: { tenantId: tenantId, supplierId: id, type: 'AVOIRFO', statut: 'VALIDEE' } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalTTC" }
        }
      }
    ]);

    if (documentAgg.length > 0) {
      summary.totalAvoirs += documentAgg[0].total;
    }

    const paymentAgg = await (PaiementFournisseur as any).aggregate([
      { $match: { societeId: new mongoose.Types.ObjectId(tenantId), fournisseurId: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          totalRaw: { $sum: "$montantTotal" },
          totalAdvanceUsed: { $sum: { $ifNull: ["$advanceUsed", 0] } },
          totalOnAccount: {
            $sum: {
              $cond: [{ $eq: ["$isPaymentOnAccount", true] }, "$montantTotal", 0]
            }
          }
        }
      }
    ]);

    let totalPaiementsRaw = 0;
    let totalAdvanceUsed = 0;
    let totalOnAccount = 0;

    if (paymentAgg.length > 0) {
      totalPaiementsRaw = paymentAgg[0].totalRaw || 0;
      totalAdvanceUsed = paymentAgg[0].totalAdvanceUsed || 0;
      totalOnAccount = paymentAgg[0].totalOnAccount || 0;
    }

    // Correct Formulas
    // Cash Out (Real Money Paid) = Raw Payments - Advance Usages (Internal Transfers)
    summary.totalPaiements = totalPaiementsRaw - totalAdvanceUsed;

    // Unpaid Invoices Amount = Invoices - Avoirs - (Payments applied to invoices)
    // Payments applied to invoices = Raw Payments - OnAccount Payments
    const paymentsToInvoices = totalPaiementsRaw - totalOnAccount;
    // Don't cap at 0 just in case data is weird, but mathematically should be >= 0 usually
    summary.facturesOuvertes = summary.totalFactures - summary.totalAvoirs - paymentsToInvoices;

    // Available Advance = OnAccount Payments - Used Advances
    summary.soldeAvanceDisponible = Math.max(0, totalOnAccount - totalAdvanceUsed);

    // Net Balance (What we owe properly) = Invoices - Avoirs - Cash Paid
    summary.soldeActuel = summary.totalFactures - summary.totalAvoirs - summary.totalPaiements;

    return NextResponse.json({
      supplier: {
        id: supplier._id.toString(),
        nom: supplier.raisonSociale || `${supplier.nom} ${supplier.prenom}`,
        email: supplier.email,
        telephone: supplier.telephone
      },
      transactions: paginatedTransactions,
      summary: summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error in supplier transactions API:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
