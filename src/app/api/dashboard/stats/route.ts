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

    // Convert tenantId to ObjectId for models that use ObjectId (PaiementClient, PaiementFournisseur)
    let tenantObjectId: mongoose.Types.ObjectId;
    try {
      tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    } catch (error) {
      // If tenantId is not a valid ObjectId, try to find it as string
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
    ] = await Promise.all([
      // Clients - uses 'actif' not 'isActive'
      (Customer as any).countDocuments({ tenantId, actif: true }),
      
      // Fournisseurs - uses 'actif' not 'isActive'
      (Supplier as any).countDocuments({ tenantId, actif: true }),
      
      // Produits - uses 'actif' not 'isActive'
      (Product as any).countDocuments({ tenantId, actif: true }),
      
      // Factures clients (total) - Document uses 'totalTTC' directly, not 'totaux.totalTTC'
      (Document as any).countDocuments({ tenantId, type: 'FAC' }),
      
      // Devis (total)
      (Document as any).countDocuments({ tenantId, type: 'DEVIS' }),
      
      // Bons de livraison (total)
      (Document as any).countDocuments({ tenantId, type: 'BL' }),
      
      // Factures fournisseurs (total) - uses 'societeId' not 'tenantId'
      (PurchaseInvoice as any).countDocuments({ societeId: tenantId }),
      
      // Factures clients ce mois
      (Document as any).countDocuments({
        tenantId,
        type: 'FAC',
        dateDoc: { $gte: startOfMonth },
      }),
      
      // Factures clients mois dernier
      (Document as any).countDocuments({
        tenantId,
        type: 'FAC',
        dateDoc: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
      
      // Factures fournisseurs ce mois - uses 'societeId' and 'dateFacture' not 'dateDoc'
      (PurchaseInvoice as any).countDocuments({
        societeId: tenantId,
        dateFacture: { $gte: startOfMonth },
      }),
      
      // Factures fournisseurs mois dernier
      (PurchaseInvoice as any).countDocuments({
        societeId: tenantId,
        dateFacture: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      }),
      
      // Chiffre d'affaires ce mois (factures clients) - Document uses 'totalTTC' directly
      (Document as any).aggregate([
        {
          $match: {
            tenantId,
            type: 'FAC',
            dateDoc: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalTTC' },
          },
        },
      ]),
      
      // Chiffre d'affaires mois dernier
      (Document as any).aggregate([
        {
          $match: {
            tenantId,
            type: 'FAC',
            dateDoc: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totalTTC' },
          },
        },
      ]),
      
      // Dépenses ce mois (factures fournisseurs) - uses 'societeId' and 'dateFacture' and 'totaux.totalTTC'
      (PurchaseInvoice as any).aggregate([
        {
          $match: {
            societeId: tenantId,
            dateFacture: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totaux.totalTTC' },
          },
        },
      ]),
      
      // Dépenses mois dernier
      (PurchaseInvoice as any).aggregate([
        {
          $match: {
            societeId: tenantId,
            dateFacture: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$totaux.totalTTC' },
          },
        },
      ]),
      
      // Paiements clients (total) - uses 'societeId' (ObjectId) not 'tenantId' (string)
      (PaiementClient as any).countDocuments({ societeId: tenantObjectId }),
      
      // Paiements fournisseurs (total) - uses 'societeId' (ObjectId) not 'tenantId' (string)
      (PaiementFournisseur as any).countDocuments({ societeId: tenantObjectId }),
      
      // Produits en stock faible - uses 'actif' not 'isActive'
      (Product as any).countDocuments({
        tenantId,
        actif: true,
        estStocke: true,
        $expr: {
          $lte: ['$stockActuel', '$min'],
        },
      }),
      
      // Factures récentes (5 dernières) - Document uses 'totalTTC' directly
      (Document as any)
        .find({ tenantId, type: 'FAC' })
        .sort({ dateDoc: -1 })
        .limit(5)
        .populate('customerId', 'raisonSociale nom prenom type')
        .lean(),
      
      // Paiements récents (5 derniers) - uses 'societeId' (ObjectId)
      (PaiementClient as any)
        .find({ societeId: tenantObjectId })
        .sort({ datePaiement: -1 })
        .limit(5)
        .lean(),
    ]);

    // Calculer les pourcentages de changement
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

    // Formater les factures récentes
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
    }));

    // Formater les paiements récents
    const formattedRecentPayments = recentPayments.map((pay: any) => ({
      id: pay._id,
      numero: pay.numero,
      date: pay.datePaiement,
      customer: pay.customerNom || 'N/A',
      montant: pay.montantTotal || 0,
    }));

    return NextResponse.json({
      stats: {
        customers: {
          total: totalCustomers,
          label: 'Clients',
        },
        suppliers: {
          total: totalSuppliers,
          label: 'Fournisseurs',
        },
        products: {
          total: totalProducts,
          label: 'Produits',
        },
        invoices: {
          total: totalInvoices,
          thisMonth: invoicesThisMonth,
          change: parseFloat(invoiceChange),
          label: 'Factures clients',
        },
        quotes: {
          total: totalQuotes,
          label: 'Devis',
        },
        deliveries: {
          total: totalDeliveries,
          label: 'Bons de livraison',
        },
        purchaseInvoices: {
          total: totalPurchaseInvoices,
          thisMonth: purchaseInvoicesThisMonth,
          change: parseFloat(purchaseInvoiceChange),
          label: 'Factures fournisseurs',
        },
        revenue: {
          total: revenue || 0,
          change: parseFloat(revenueChange),
          label: 'Chiffre d\'affaires',
        },
        expenses: {
          total: expenses || 0,
          change: parseFloat(expensesChange),
          label: 'Dépenses',
        },
        customerPayments: {
          total: totalCustomerPayments,
          label: 'Paiements clients',
        },
        supplierPayments: {
          total: totalSupplierPayments,
          label: 'Paiements fournisseurs',
        },
        lowStock: {
          total: lowStockProducts,
          label: 'Alertes stock',
        },
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
