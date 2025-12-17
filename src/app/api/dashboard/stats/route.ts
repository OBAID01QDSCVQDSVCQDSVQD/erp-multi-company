import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Document from '@/lib/models/Document';
import Customer from '@/lib/models/Customer';
import Supplier from '@/lib/models/Supplier';
import Product from '@/lib/models/Product';
import PaiementClient from '@/lib/models/PaiementClient';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const tenantId = request.headers.get('X-Tenant-Id') || session.user.companyId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID manquant' }, { status: 400 });
    }

    await connectDB();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // For historical charts (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Convert tenantId to ObjectId for models that use ObjectId
    let tenantObjectId: mongoose.Types.ObjectId;
    try {
      tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    } catch (error) {
      console.warn('tenantId is not a valid ObjectId, using as string for Paiement models');
      tenantObjectId = tenantId as any;
    }

    // Calculer les statistiques
    const [
      totalCustomers,
      totalSuppliers,
      totalProducts,
      totalInvoices,
      totalQuotes,
      totalDeliveries,
      totalPurchaseInvoices,
      invoicesThisMonth,
      invoicesLastMonth,
      purchaseInvoicesThisMonth,
      purchaseInvoicesLastMonth,
      revenueThisMonth,
      revenueLastMonth,
      purchaseExpensesThisMonth,
      purchaseExpensesLastMonth,
      totalCustomerPayments,
      totalSupplierPayments,
      lowStockProducts,
      recentInvoices,
      recentPayments,
      monthlyRevenue,
      monthlyExpenses,
      topProducts
    ] = await Promise.all([
      // ... existing single value queries ...
      (Customer as any).countDocuments({ tenantId, actif: true }),
      (Supplier as any).countDocuments({ tenantId, actif: true }),
      (Product as any).countDocuments({ tenantId, actif: true }),
      (Document as any).countDocuments({ tenantId, type: 'FAC' }),
      (Document as any).countDocuments({ tenantId, type: 'DEVIS' }),
      (Document as any).countDocuments({ tenantId, type: 'BL' }),
      (PurchaseInvoice as any).countDocuments({ societeId: tenantId }),

      // Invoices counts
      (Document as any).countDocuments({ tenantId, type: 'FAC', dateDoc: { $gte: startOfMonth } }),
      (Document as any).countDocuments({ tenantId, type: 'FAC', dateDoc: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),

      // Purchase Invoices counts
      (PurchaseInvoice as any).countDocuments({ societeId: tenantId, dateFacture: { $gte: startOfMonth } }),
      (PurchaseInvoice as any).countDocuments({ societeId: tenantId, dateFacture: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),

      // Revenue this month
      (Document as any).aggregate([
        { $match: { tenantId, type: 'FAC', dateDoc: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalTTC' } } }
      ]),
      // Revenue last month
      (Document as any).aggregate([
        { $match: { tenantId, type: 'FAC', dateDoc: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: '$totalTTC' } } }
      ]),

      // Expenses this month
      (PurchaseInvoice as any).aggregate([
        { $match: { societeId: tenantId, dateFacture: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totaux.totalTTC' } } }
      ]),
      // Expenses last month
      (PurchaseInvoice as any).aggregate([
        { $match: { societeId: tenantId, dateFacture: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: '$totaux.totalTTC' } } }
      ]),

      (PaiementClient as any).countDocuments({ societeId: tenantObjectId }),
      (PaiementFournisseur as any).countDocuments({ societeId: tenantObjectId }),

      // Low stock
      (Product as any).countDocuments({
        tenantId, actif: true, estStocke: true,
        $expr: { $lte: ['$stockActuel', '$min'] }
      }),

      // Recent Invoices
      (Document as any).find({ tenantId, type: 'FAC' })
        .sort({ dateDoc: -1 }).limit(5)
        .populate('customerId', 'raisonSociale nom prenom type')
        .lean(),

      // Recent Payments
      (PaiementClient as any).find({ societeId: tenantObjectId })
        .sort({ datePaiement: -1 }).limit(5)
        .lean(),

      // [NEW] Monthly Revenue History (Last 6 Months)
      (Document as any).aggregate([
        {
          $match: {
            tenantId,
            type: 'FAC',
            dateDoc: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              month: { $month: "$dateDoc" },
              year: { $year: "$dateDoc" }
            },
            total: { $sum: "$totalTTC" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),

      // [NEW] Monthly Expenses History (Last 6 Months)
      (PurchaseInvoice as any).aggregate([
        {
          $match: {
            societeId: tenantId,
            dateFacture: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              month: { $month: "$dateFacture" },
              year: { $year: "$dateFacture" }
            },
            total: { $sum: "$totaux.totalTTC" }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]),

      // [NEW] Top Selling Products
      (Document as any).aggregate([
        {
          $match: {
            tenantId,
            type: 'FAC',
            dateDoc: { $gte: startOfMonth } // Top products this month
          }
        },
        { $unwind: "$lignes" },
        {
          $group: {
            _id: "$lignes.designation",
            totalSales: { $sum: "$lignes.quantite" },
            revenue: { $sum: { $multiply: ["$lignes.quantite", "$lignes.prixUnitaireHT"] } }
          }
        },
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ])
    ]);

    // ... Calculations ...
    const invoiceChange = invoicesLastMonth > 0
      ? ((invoicesThisMonth - invoicesLastMonth) / invoicesLastMonth * 100).toFixed(1)
      : invoicesThisMonth > 0 ? '100' : '0';

    const purchaseInvoiceChange = purchaseInvoicesLastMonth > 0
      ? ((purchaseInvoicesThisMonth - purchaseInvoicesLastMonth) / purchaseInvoicesLastMonth * 100).toFixed(1)
      : purchaseInvoicesThisMonth > 0 ? '100' : '0';

    const revenue = revenueThisMonth.length > 0 ? revenueThisMonth[0].total : 0;
    const lastRevenue = revenueLastMonth.length > 0 ? revenueLastMonth[0].total : 0;
    const revenueChange = lastRevenue > 0
      ? ((revenue - lastRevenue) / lastRevenue * 100).toFixed(1)
      : revenue > 0 ? '100' : '0';

    const expenses = purchaseExpensesThisMonth.length > 0 ? purchaseExpensesThisMonth[0].total : 0;
    const lastExpenses = purchaseExpensesLastMonth.length > 0 ? purchaseExpensesLastMonth[0].total : 0;
    const expensesChange = lastExpenses > 0
      ? ((expenses - lastExpenses) / lastExpenses * 100).toFixed(1)
      : expenses > 0 ? '100' : '0';

    // Format Data Structure for Charts
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    // Merge revenue and expenses by month
    const chartData = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthIndex = d.getMonth() + 1;
      const year = d.getFullYear();

      const revEntry = monthlyRevenue.find((r: any) => r._id.month === monthIndex && r._id.year === year);
      const expEntry = monthlyExpenses.find((e: any) => e._id.month === monthIndex && e._id.year === year);

      chartData.push({
        name: monthNames[d.getMonth()],
        revenus: revEntry ? revEntry.total : 0,
        depenses: expEntry ? expEntry.total : 0
      });
    }

    const formattedRecentInvoices = recentInvoices.map((inv: any) => ({
      id: inv._id,
      numero: inv.numero,
      date: inv.dateDoc,
      customer: inv.customerId
        ? (inv.customerId.type === 'societe'
          ? inv.customerId.raisonSociale
          : `${inv.customerId.nom || ''} ${inv.customerId.prenom || ''}`.trim())
        : 'N/A',
      total: inv.totalTTC || 0,
      status: inv.statut // Added status
    }));

    const formattedRecentPayments = recentPayments.map((pay: any) => ({
      id: pay._id,
      numero: pay.numero,
      date: pay.datePaiement,
      customer: pay.customerNom || 'N/A',
      montant: pay.montantTotal || 0,
    }));

    const formattedTopProducts = topProducts.map((p: any) => ({
      name: p._id,
      value: p.revenue
    }));

    return NextResponse.json({
      stats: {
        customers: { total: totalCustomers, label: 'Clients' },
        suppliers: { total: totalSuppliers, label: 'Fournisseurs' },
        products: { total: totalProducts, label: 'Produits' },
        invoices: {
          total: totalInvoices,
          thisMonth: invoicesThisMonth,
          change: parseFloat(invoiceChange),
          label: 'Factures clients'
        },
        quotes: { total: totalQuotes, label: 'Devis' },
        deliveries: { total: totalDeliveries, label: 'Bons de livraison' },
        purchaseInvoices: {
          total: totalPurchaseInvoices,
          thisMonth: purchaseInvoicesThisMonth,
          change: parseFloat(purchaseInvoiceChange),
          label: 'Factures fournisseurs'
        },
        revenue: {
          total: revenue || 0,
          change: parseFloat(revenueChange),
          label: 'Chiffre d\'affaires'
        },
        expenses: {
          total: expenses || 0,
          change: parseFloat(expensesChange),
          label: 'Dépenses'
        },
        customerPayments: { total: totalCustomerPayments, label: 'Paiements clients' },
        supplierPayments: { total: totalSupplierPayments, label: 'Paiements fournisseurs' },
        lowStock: { total: lowStockProducts, label: 'Alertes stock' },
      },
      charts: {
        revenue: chartData,
        topProducts: formattedTopProducts
      },
      recent: {
        invoices: formattedRecentInvoices,
        payments: formattedRecentPayments,
      },
    });

  } catch (error: any) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    );
  }
}
