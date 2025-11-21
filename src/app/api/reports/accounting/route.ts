import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Expense from '@/lib/models/Expense';
import ExpenseCategory from '@/lib/models/ExpenseCategory';
import Document from '@/lib/models/Document';
import PurchaseInvoice from '@/lib/models/PurchaseInvoice';
import PaiementClient from '@/lib/models/PaiementClient';
import PaiementFournisseur from '@/lib/models/PaiementFournisseur';
import Customer from '@/lib/models/Customer';
import Supplier from '@/lib/models/Supplier';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    
    // Filtres de date
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const type = searchParams.get('type'); // 'expenses', 'sales', 'purchases', 'payments', 'all'

    // Construire le filtre de date
    const dateFilter: any = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999); // Fin de la journée
      dateFilter.$lte = endDate;
    }

    const results: any = {};

    // 1. Dépenses (Expenses)
    if (!type || type === 'expenses' || type === 'all') {
      const expenseQuery: any = { tenantId };
      if (Object.keys(dateFilter).length > 0) {
        expenseQuery.date = dateFilter;
      }

      const expenses = await (Expense as any).find(expenseQuery)
        .sort({ date: -1 })
        .lean();

      // Récupérer les catégories et fournisseurs manuellement
      const categorieIds = Array.from(new Set(expenses.map((e: any) => e.categorieId?.toString()).filter(Boolean)));
      const fournisseurIds = Array.from(new Set(expenses.map((e: any) => e.fournisseurId?.toString()).filter(Boolean)));

      const categories = categorieIds.length > 0 
        ? await (ExpenseCategory as any).find({ _id: { $in: categorieIds.map((id: string) => new mongoose.Types.ObjectId(id)) } }).lean()
        : [];
      const fournisseurs = fournisseurIds.length > 0
        ? await (Supplier as any).find({ _id: { $in: fournisseurIds.map((id: string) => new mongoose.Types.ObjectId(id)) } }).lean()
        : [];

      const categoriesMap = new Map(categories.map((c: any) => [c._id.toString(), c]));
      const fournisseursMap = new Map(fournisseurs.map((f: any) => [f._id.toString(), f]));

      results.expenses = expenses.map((exp: any) => {
        const categorie = exp.categorieId ? (categoriesMap.get(exp.categorieId.toString()) as any) : null;
        const fournisseur = exp.fournisseurId ? (fournisseursMap.get(exp.fournisseurId.toString()) as any) : null;
        
        // Utiliser les valeurs calculées du modèle Expense
        const tvaPct = exp.tvaPct || 0;
        const totalHT = exp.totalHT || 0;
        const totalTTC = exp.totalTTC || 0;
        const timbreFiscal = exp.timbreFiscal || 0;
        const fodec = exp.fodec || 0;
        const tvaAmount = exp.tva || 0; // Montant TVA calculé
        
        return {
          _id: exp._id,
          numero: exp.numero,
          date: exp.date,
          companyName: fournisseur
            ? (fournisseur.raisonSociale || `${fournisseur.nom || ''} ${fournisseur.prenom || ''}`.trim())
            : 'N/A',
          tva: tvaPct, // Pourcentage TVA pour l'affichage
          tvaAmount: tvaAmount, // Montant TVA pour les calculs
          fodec: fodec,
          timbre: timbreFiscal,
          totalHT: totalHT,
          totalTTC: totalTTC,
          devise: exp.devise || 'TND',
          description: exp.description,
          categorie: categorie?.nom || 'N/A',
          statut: exp.statut || 'brouillon',
        };
      });

      // Calculer les totaux par devise
      const expensesByCurrency: Record<string, { totalHT: number; totalTVA: number; totalTimbre: number; totalTTC: number; count: number }> = {};
      results.expenses.forEach((exp: any) => {
        const currency = exp.devise || 'TND';
        if (!expensesByCurrency[currency]) {
          expensesByCurrency[currency] = { totalHT: 0, totalTVA: 0, totalTimbre: 0, totalTTC: 0, count: 0 };
        }
        // Récupérer la TVA réelle depuis l'expense
        const tvaAmount = exp.tvaAmount || (exp.totalTTC - exp.totalHT - (exp.timbre || 0) - (exp.fodec || 0));
        
        expensesByCurrency[currency].totalHT += exp.totalHT;
        expensesByCurrency[currency].totalTVA += tvaAmount;
        expensesByCurrency[currency].totalTimbre += exp.timbre || 0;
        expensesByCurrency[currency].totalTTC += exp.totalTTC;
        expensesByCurrency[currency].count += 1;
      });
      results.expensesSummaryByCurrency = expensesByCurrency;
    }

    // 2. Factures de vente (Sales Invoices)
    if (!type || type === 'sales' || type === 'all') {
      const salesQuery: any = { tenantId, type: 'FAC' };
      if (Object.keys(dateFilter).length > 0) {
        salesQuery.dateDoc = dateFilter;
      }

      const salesInvoices = await (Document as any).find(salesQuery)
        .sort({ dateDoc: -1 })
        .lean();

      // Récupérer les clients manuellement car customerId est un String
      const customerIds = Array.from(new Set(salesInvoices.map((inv: any) => inv.customerId).filter(Boolean)));
      const customers = customerIds.length > 0
        ? await (Customer as any).find({ 
            _id: { $in: customerIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
            tenantId 
          }).lean()
        : [];

      const customersMap = new Map(customers.map((c: any) => [c._id.toString(), c]));

      results.salesInvoices = salesInvoices.map((inv: any) => {
        const customer = inv.customerId ? (customersMap.get(inv.customerId) as any) : null;
        
        return {
          _id: inv._id,
          numero: inv.numero,
          date: inv.dateDoc,
          companyName: customer
            ? (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim())
            : 'N/A',
          tva: inv.totalTVA || 0,
          fodec: 0, // Fodec non applicable pour les ventes
          timbre: inv.timbreFiscal || 0,
          totalHT: inv.totalBaseHT || 0,
          totalTTC: inv.totalTTC || 0,
          devise: inv.devise || 'TND', // Utiliser TND comme valeur par défaut (comme dans le modèle)
          tauxChange: inv.tauxChange || 1, // Taux de change pour conversion en TND
          statut: inv.statut,
          referenceExterne: inv.referenceExterne,
        };
      });

      // Calculer les totaux par devise
      const salesByCurrency: Record<string, { totalHT: number; totalTVA: number; totalTimbre: number; totalTTC: number; count: number }> = {};
      results.salesInvoices.forEach((inv: any) => {
        const currency = inv.devise || 'TND';
        if (!salesByCurrency[currency]) {
          salesByCurrency[currency] = { totalHT: 0, totalTVA: 0, totalTimbre: 0, totalTTC: 0, count: 0 };
        }
        salesByCurrency[currency].totalHT += inv.totalHT;
        salesByCurrency[currency].totalTVA += inv.tva;
        salesByCurrency[currency].totalTimbre += inv.timbre || 0;
        salesByCurrency[currency].totalTTC += inv.totalTTC;
        salesByCurrency[currency].count += 1;
      });
      results.salesSummaryByCurrency = salesByCurrency;
    }

    // 3. Factures d'achat (Purchase Invoices)
    if (!type || type === 'purchases' || type === 'all') {
      const purchaseQuery: any = { societeId: tenantId };
      if (Object.keys(dateFilter).length > 0) {
        purchaseQuery.dateFacture = dateFilter;
      }

      const purchaseInvoices = await (PurchaseInvoice as any).find(purchaseQuery)
        .sort({ dateFacture: -1 })
        .lean();

      results.purchaseInvoices = purchaseInvoices.map((inv: any) => ({
        _id: inv._id,
        numero: inv.numero,
        date: inv.dateFacture,
        companyName: inv.fournisseurNom || 'N/A',
        tva: inv.totaux?.totalTVA || 0,
        fodec: inv.totaux?.totalFodec || 0,
        timbre: inv.totaux?.totalTimbre || 0,
        totalHT: inv.totaux?.totalHT || 0,
        totalTTC: inv.totaux?.totalTTC || 0,
        devise: inv.devise || 'TND',
        tauxChange: inv.tauxChange || 1, // Taux de change pour conversion en TND
        statut: inv.statut,
        referenceFournisseur: inv.referenceFournisseur,
      }));

      // Calculer les totaux par devise
      const purchasesByCurrency: Record<string, { totalHT: number; totalTVA: number; totalFodec: number; totalTimbre: number; totalTTC: number; count: number }> = {};
      results.purchaseInvoices.forEach((inv: any) => {
        const currency = inv.devise || 'TND';
        if (!purchasesByCurrency[currency]) {
          purchasesByCurrency[currency] = { totalHT: 0, totalTVA: 0, totalFodec: 0, totalTimbre: 0, totalTTC: 0, count: 0 };
        }
        purchasesByCurrency[currency].totalHT += inv.totalHT;
        purchasesByCurrency[currency].totalTVA += inv.tva;
        purchasesByCurrency[currency].totalFodec += inv.fodec;
        purchasesByCurrency[currency].totalTimbre += inv.timbre;
        purchasesByCurrency[currency].totalTTC += inv.totalTTC;
        purchasesByCurrency[currency].count += 1;
      });
      results.purchasesSummaryByCurrency = purchasesByCurrency;
    }

    // Résumé Financier - Convertir toutes les devises en TND
    const financialSummary = {
      totalVentesHT: 0,
      totalVentesTVA: 0,
      totalVentesTimbre: 0,
      totalVentesTTC: 0,
      totalAchatsHT: 0,
      totalAchatsTVA: 0,
      totalAchatsFodec: 0,
      totalAchatsTimbre: 0,
      totalAchatsTTC: 0,
      totalDepensesHT: 0,
      totalDepensesTVA: 0,
      totalDepensesTTC: 0,
    };

    // Convertir les ventes en TND
    if (results.salesInvoices) {
      results.salesInvoices.forEach((inv: any) => {
        const tauxChange = inv.tauxChange || 1;
        const currency = inv.devise || 'TND';
        
        if (currency !== 'TND') {
          financialSummary.totalVentesHT += (inv.totalHT || 0) * tauxChange;
          financialSummary.totalVentesTVA += (inv.tva || 0) * tauxChange;
          financialSummary.totalVentesTimbre += (inv.timbre || 0) * tauxChange;
          financialSummary.totalVentesTTC += (inv.totalTTC || 0) * tauxChange;
        } else {
          financialSummary.totalVentesHT += inv.totalHT || 0;
          financialSummary.totalVentesTVA += inv.tva || 0;
          financialSummary.totalVentesTimbre += inv.timbre || 0;
          financialSummary.totalVentesTTC += inv.totalTTC || 0;
        }
      });
    }

    // Convertir les achats en TND
    if (results.purchaseInvoices) {
      results.purchaseInvoices.forEach((inv: any) => {
        const tauxChange = inv.tauxChange || 1;
        const currency = inv.devise || 'TND';
        
        if (currency !== 'TND') {
          financialSummary.totalAchatsHT += (inv.totalHT || 0) * tauxChange;
          financialSummary.totalAchatsTVA += (inv.tva || 0) * tauxChange;
          financialSummary.totalAchatsFodec += (inv.fodec || 0) * tauxChange;
          financialSummary.totalAchatsTimbre += (inv.timbre || 0) * tauxChange;
          financialSummary.totalAchatsTTC += (inv.totalTTC || 0) * tauxChange;
        } else {
          financialSummary.totalAchatsHT += inv.totalHT || 0;
          financialSummary.totalAchatsTVA += inv.tva || 0;
          financialSummary.totalAchatsFodec += inv.fodec || 0;
          financialSummary.totalAchatsTimbre += inv.timbre || 0;
          financialSummary.totalAchatsTTC += inv.totalTTC || 0;
        }
      });
    }

    // Convertir les dépenses en TND
    if (results.expenses) {
      results.expenses.forEach((exp: any) => {
        const tauxChange = 1; // TODO: Ajouter tauxChange dans Expense model si nécessaire
        const currency = exp.devise || 'TND';
        const tvaAmount = exp.tvaAmount || (exp.totalTTC - exp.totalHT - (exp.timbre || 0) - (exp.fodec || 0));
        
        if (currency !== 'TND') {
          financialSummary.totalDepensesHT += (exp.totalHT || 0) * tauxChange;
          financialSummary.totalDepensesTVA += tvaAmount * tauxChange;
          financialSummary.totalDepensesTTC += (exp.totalTTC || 0) * tauxChange;
        } else {
          financialSummary.totalDepensesHT += exp.totalHT || 0;
          financialSummary.totalDepensesTVA += tvaAmount;
          financialSummary.totalDepensesTTC += exp.totalTTC || 0;
        }
      });
    }

    results.financialSummary = financialSummary;

    // 4. افوار (Invoices) - Combine Sales and Purchase Invoices
    if (!type || type === 'invoices' || type === 'all') {
      const allInvoices: any[] = [];
      
      // Add sales invoices
      if (results.salesInvoices) {
        results.salesInvoices.forEach((inv: any) => {
          allInvoices.push({
            _id: inv._id,
            numero: inv.numero,
            date: inv.date,
            companyName: inv.companyName,
            type: 'vente',
            tva: inv.tva,
            fodec: 0, // Fodec non applicable pour les ventes
            timbre: inv.timbre,
            totalHT: inv.totalHT,
            totalTTC: inv.totalTTC,
            devise: inv.devise,
            statut: inv.statut,
            referenceExterne: inv.referenceExterne,
          });
        });
      }
      
      // Add purchase invoices
      if (results.purchaseInvoices) {
        results.purchaseInvoices.forEach((inv: any) => {
          allInvoices.push({
            _id: inv._id,
            numero: inv.numero,
            date: inv.date,
            companyName: inv.companyName,
            type: 'achat',
            tva: inv.tva,
            fodec: inv.fodec,
            timbre: inv.timbre,
            totalHT: inv.totalHT,
            totalTTC: inv.totalTTC,
            devise: inv.devise,
            statut: inv.statut,
            referenceFournisseur: inv.referenceFournisseur,
          });
        });
      }
      
      // Sort by date descending
      results.invoices = allInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // 5. Paiements (Payments)
    if (!type || type === 'payments' || type === 'all') {
      // Paiements clients
      const customerPaymentsQuery: any = { 
        societeId: new mongoose.Types.ObjectId(tenantId) 
      };
      if (Object.keys(dateFilter).length > 0) {
        customerPaymentsQuery.datePaiement = dateFilter;
      }

      const customerPayments = await (PaiementClient as any).find(customerPaymentsQuery)
        .populate('customerId', 'raisonSociale nom prenom')
        .sort({ datePaiement: -1 })
        .lean();

      // Paiements fournisseurs
      const supplierPaymentsQuery: any = { 
        societeId: new mongoose.Types.ObjectId(tenantId) 
      };
      if (Object.keys(dateFilter).length > 0) {
        supplierPaymentsQuery.datePaiement = dateFilter;
      }

      const supplierPayments = await (PaiementFournisseur as any).find(supplierPaymentsQuery)
        .populate('fournisseurId', 'raisonSociale nom prenom')
        .sort({ datePaiement: -1 })
        .lean();

      results.payments = [
        ...customerPayments.map((pay: any) => ({
          _id: pay._id,
          numero: pay.numero,
          date: pay.datePaiement,
          companyName: pay.customerId
            ? (pay.customerId.raisonSociale || `${pay.customerId.nom || ''} ${pay.customerId.prenom || ''}`.trim())
            : pay.customerNom || 'N/A',
          type: 'client',
          montant: pay.montantTotal || 0,
          modePaiement: pay.modePaiement,
          reference: pay.reference,
          isPaymentOnAccount: pay.isPaymentOnAccount || false,
        })),
        ...supplierPayments.map((pay: any) => ({
          _id: pay._id,
          numero: pay.numero,
          date: pay.datePaiement,
          companyName: pay.fournisseurId
            ? (pay.fournisseurId.raisonSociale || `${pay.fournisseurId.nom || ''} ${pay.fournisseurId.prenom || ''}`.trim())
            : pay.fournisseurNom || 'N/A',
          type: 'fournisseur',
          montant: pay.montantTotal || 0,
          modePaiement: pay.modePaiement,
          reference: pay.reference,
          isPaymentOnAccount: pay.isPaymentOnAccount || false,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // Calculer les totaux
    if (results.expenses) {
      results.expensesSummary = {
        total: results.expenses.length,
        totalHT: results.expenses.reduce((sum: number, e: any) => sum + (e.totalHT || 0), 0),
        totalTVA: results.expenses.reduce((sum: number, e: any) => {
          return sum + (e.tvaAmount || (e.totalTTC - e.totalHT - (e.timbre || 0) - (e.fodec || 0)));
        }, 0),
        totalTTC: results.expenses.reduce((sum: number, e: any) => sum + (e.totalTTC || 0), 0),
      };
    }

    if (results.salesInvoices) {
      results.salesSummary = {
        total: results.salesInvoices.length,
        totalHT: results.salesInvoices.reduce((sum: number, inv: any) => sum + inv.totalHT, 0),
        totalTVA: results.salesInvoices.reduce((sum: number, inv: any) => sum + inv.tva, 0),
        totalTTC: results.salesInvoices.reduce((sum: number, inv: any) => sum + inv.totalTTC, 0),
      };
    }

    if (results.purchaseInvoices) {
      results.purchasesSummary = {
        total: results.purchaseInvoices.length,
        totalHT: results.purchaseInvoices.reduce((sum: number, inv: any) => sum + inv.totalHT, 0),
        totalTVA: results.purchaseInvoices.reduce((sum: number, inv: any) => sum + inv.tva, 0),
        totalFodec: results.purchaseInvoices.reduce((sum: number, inv: any) => sum + inv.fodec, 0),
        totalTTC: results.purchaseInvoices.reduce((sum: number, inv: any) => sum + inv.totalTTC, 0),
      };
    }

    if (results.payments) {
      results.paymentsSummary = {
        count: results.payments.length,
        totalClients: results.payments.filter((p: any) => p.type === 'client').reduce((sum: number, p: any) => sum + p.montant, 0),
        totalFournisseurs: results.payments.filter((p: any) => p.type === 'fournisseur').reduce((sum: number, p: any) => sum + p.montant, 0),
        total: results.payments.reduce((sum: number, p: any) => sum + p.montant, 0),
      };
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Erreur lors de la récupération des rapports comptables:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

