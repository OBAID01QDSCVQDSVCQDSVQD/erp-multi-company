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

    // Get period from query params (month, quarter, year)
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'month';

    const now = new Date();
    let startDate: Date, endDate: Date, previousStartDate: Date, previousEndDate: Date;
    let chartStartDate: Date;

    // Define dates based on period
    if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1); // Start of year
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // End of year

      previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
      previousEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

      chartStartDate = startDate;
    } else if (period === 'quarter') {
      // Last 3 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      previousStartDate = new Date(startDate.getFullYear(), startDate.getMonth() - 3, 1);
      previousEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0, 23, 59, 59);

      chartStartDate = startDate;
    } else {
      // Default: Month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      // For charts in month view, we still show last 6 months for context, or maybe just days of month?
      // Let's keep existing chart logic (last 6 months) for simplicity unless requested otherwise,
      // but strictly speaking, if user selects "This Month", they might expect daily chart.
      // For now, let's keep the Revenue/Expense Card calculation strictly tied to the period,
      // and the Main Chart showing the relevant trend.

      // If period is month, chart shows daily breakdown? No, too complex for now.
      // Let's stick to Monthly Trend for Year/Quarter, and for Month maybe stick to 6-months history or Switch to Daily.
      // To keep it simple and robust: The cards obey the period. The chart shows the trend covering that period.

      chartStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1); // Default 6 months history
      if (period === 'year') chartStartDate = new Date(now.getFullYear(), 0, 1);
    }

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

      currentPeriodInvoices,
      previousPeriodInvoices,

      currentPeriodPurchaseInvoices,
      previousPeriodPurchaseInvoices,

      revenueCurrentPeriod,
      revenuePreviousPeriod,

      expensesCurrentPeriod,
      expensesPreviousPeriod,

      totalCustomerPayments,
      totalSupplierPayments,
      lowStockProducts,
      recentInvoices,
      recentPayments,
      revenueChartData,
      expensesChartData,
      topProducts
    ] = await Promise.all([
      // Global counts (Total All Time)
      (Customer as any).countDocuments({ tenantId, actif: true }),
      (Supplier as any).countDocuments({ tenantId, actif: true }),
      (Product as any).countDocuments({ tenantId, actif: true }),
      (Document as any).countDocuments({ tenantId, type: 'FAC' }),
      (Document as any).countDocuments({ tenantId, type: 'DEVIS' }),
      (Document as any).countDocuments({ tenantId, type: 'BL' }),
      (PurchaseInvoice as any).countDocuments({ societeId: tenantId }),

      // Invoices counts (Period vs Previous)
      (Document as any).countDocuments({ tenantId, type: 'FAC', dateDoc: { $gte: startDate, $lte: endDate } }),
      (Document as any).countDocuments({ tenantId, type: 'FAC', dateDoc: { $gte: previousStartDate, $lte: previousEndDate } }),

      // Purchase Invoices counts (Period vs Previous)
      (PurchaseInvoice as any).countDocuments({ societeId: tenantId, dateFacture: { $gte: startDate, $lte: endDate } }),
      (PurchaseInvoice as any).countDocuments({ societeId: tenantId, dateFacture: { $gte: previousStartDate, $lte: previousEndDate } }),

      // Revenue (Period vs Previous)
      (Document as any).aggregate([
        { $match: { tenantId, type: 'FAC', dateDoc: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$totalTTC' } } }
      ]),
      (Document as any).aggregate([
        { $match: { tenantId, type: 'FAC', dateDoc: { $gte: previousStartDate, $lte: previousEndDate } } },
        { $group: { _id: null, total: { $sum: '$totalTTC' } } }
      ]),

      // Expenses (Period vs Previous)
      (PurchaseInvoice as any).aggregate([
        { $match: { societeId: tenantId, dateFacture: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$totaux.totalTTC' } } }
      ]),
      (PurchaseInvoice as any).aggregate([
        { $match: { societeId: tenantId, dateFacture: { $gte: previousStartDate, $lte: previousEndDate } } },
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

      // Revenue Chart Data (Dynamic based on Period)
      // If Years -> Group by month
      (Document as any).aggregate([
        {
          $match: {
            tenantId,
            type: 'FAC',
            dateDoc: { $gte: chartStartDate }
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

      // Expenses Chart Data
      (PurchaseInvoice as any).aggregate([
        {
          $match: {
            societeId: tenantId,
            dateFacture: { $gte: chartStartDate }
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

      // Top Selling Products (Within selected period)
      (Document as any).aggregate([
        {
          $match: {
            tenantId,
            type: 'FAC',
            dateDoc: { $gte: startDate, $lte: endDate }
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
    const invoiceChange = previousPeriodInvoices > 0
      ? ((currentPeriodInvoices - previousPeriodInvoices) / previousPeriodInvoices * 100).toFixed(1)
      : currentPeriodInvoices > 0 ? '100' : '0';

    const purchaseInvoiceChange = previousPeriodPurchaseInvoices > 0
      ? ((currentPeriodPurchaseInvoices - previousPeriodPurchaseInvoices) / previousPeriodPurchaseInvoices * 100).toFixed(1)
      : currentPeriodPurchaseInvoices > 0 ? '100' : '0';

    const revenue = revenueCurrentPeriod.length > 0 ? revenueCurrentPeriod[0].total : 0;
    const lastRevenue = revenuePreviousPeriod.length > 0 ? revenuePreviousPeriod[0].total : 0;
    const revenueChange = lastRevenue > 0
      ? ((revenue - lastRevenue) / lastRevenue * 100).toFixed(1)
      : revenue > 0 ? '100' : '0';

    const expenses = expensesCurrentPeriod.length > 0 ? expensesCurrentPeriod[0].total : 0;
    const lastExpenses = expensesPreviousPeriod.length > 0 ? expensesPreviousPeriod[0].total : 0;
    const expensesChange = lastExpenses > 0
      ? ((expenses - lastExpenses) / lastExpenses * 100).toFixed(1)
      : expenses > 0 ? '100' : '0';

    // Format Data Structure for Charts
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    // Merge revenue and expenses by month
    const chartData = [];

    // We need to generate labels based on period.
    // If Year: Jan -> Dec
    // If Quarter: 3 months
    // If Month: 6 previous months (as per logic)

    let loopStart, loopEnd; // indices relative to chartStartDate

    // Simplification: Iterate through the returned aggregation results and map to labels
    // Or generate the expected timeline and fill with 0

    // Let's use the generating logic consistent with previous implementation (last X months relative to now)
    // BUT now chartStartDate might be Jan 1st of current year.

    const today = new Date();
    let monthsToIterate = 6;
    let startIteratorDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    if (period === 'year') {
      monthsToIterate = 12;
      startIteratorDate = new Date(today.getFullYear(), 0, 1);
    } else if (period === 'quarter') {
      monthsToIterate = 3;
      startIteratorDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    }

    for (let i = 0; i < monthsToIterate; i++) {
      const d = new Date(startIteratorDate.getFullYear(), startIteratorDate.getMonth() + i, 1);
      const monthIndex = d.getMonth() + 1;
      const year = d.getFullYear();

      const revEntry = revenueChartData.find((r: any) => r._id.month === monthIndex && r._id.year === year);
      const expEntry = expensesChartData.find((e: any) => e._id.month === monthIndex && e._id.year === year);

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
          thisMonth: currentPeriodInvoices,
          change: parseFloat(invoiceChange),
          label: 'Factures clients'
        },
        quotes: { total: totalQuotes, label: 'Devis' },
        deliveries: { total: totalDeliveries, label: 'Bons de livraison' },
        purchaseInvoices: {
          total: totalPurchaseInvoices,
          thisMonth: currentPeriodPurchaseInvoices,
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
