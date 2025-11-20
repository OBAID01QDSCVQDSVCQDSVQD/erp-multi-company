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
import Supplier from '@/lib/models/Supplier';
import Customer from '@/lib/models/Customer';
import mongoose from 'mongoose';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.companyId?.toString() || '';
    const { searchParams } = new URL(request.url);
    
    // Filtres
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const type = searchParams.get('type') || 'all';

    // Construire le filtre de date
    const dateFilter: any = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = endDate;
    }

    // Utiliser l'orientation landscape pour avoir plus d'espace horizontal
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let yPosition = 20;

    // En-tête
    doc.setFontSize(18);
    doc.text('Rapport Comptable', 14, yPosition);
    yPosition += 10;

    // Période
    doc.setFontSize(12);
    const periodText = dateFrom && dateTo
      ? `Période: ${new Date(dateFrom).toLocaleDateString('fr-FR')} - ${new Date(dateTo).toLocaleDateString('fr-FR')}`
      : dateFrom
      ? `À partir du: ${new Date(dateFrom).toLocaleDateString('fr-FR')}`
      : dateTo
      ? `Jusqu'au: ${new Date(dateTo).toLocaleDateString('fr-FR')}`
      : 'Toutes les périodes';
    doc.text(periodText, 14, yPosition);
    yPosition += 15;

    const formatPrice = (price: number, currency: string = 'TND') => {
      // Format manuel pour éviter les problèmes d'encodage dans le PDF - 3 chiffres après la virgule
      const formatted = price.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const currencySymbol = currency === 'TND' ? 'TND' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
      return `${formatted.replace('.', ',')} ${currencySymbol}`;
    };

    // Variables pour Résumé Financier
    let expenses: any[] = [];
    let salesInvoices: any[] = [];
    let purchaseInvoices: any[] = [];

    // 1. Dépenses
    if (type === 'expenses' || type === 'all') {
      const expenseQuery: any = { tenantId };
      if (Object.keys(dateFilter).length > 0) {
        expenseQuery.date = dateFilter;
      }

      expenses = await (Expense as any).find(expenseQuery)
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

      if (expenses.length > 0) {
        doc.setFontSize(14);
        doc.text('Dépenses', 14, yPosition);
        yPosition += 10;

        const expenseData = expenses.map((exp: any) => {
          const fournisseur = exp.fournisseurId ? (fournisseursMap.get(exp.fournisseurId.toString()) as any) : null;
          const tvaPct = exp.tvaPct || 0;
          const montantTTC = exp.montant;
          const montantHT = tvaPct > 0 ? montantTTC / (1 + tvaPct / 100) : montantTTC;
          const currency = exp.devise || 'TND';
          
          return [
            new Date(exp.date).toLocaleDateString('fr-FR'),
            exp.numero,
            fournisseur
              ? (fournisseur.raisonSociale || `${fournisseur.nom || ''} ${fournisseur.prenom || ''}`.trim())
              : 'N/A',
            `${tvaPct}%`,
            formatPrice(0, currency), // Timbre (non applicable pour les dépenses)
            formatPrice(montantHT, currency),
            formatPrice(montantTTC, currency),
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Numéro', 'Entreprise', 'TVA', 'Timbre', 'Total HT', 'Total TTC']],
          body: expenseData,
          theme: 'striped',
          headStyles: { fillColor: [66, 139, 202], fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          bodyStyles: { fontSize: 8, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          columnStyles: {
            0: { cellWidth: 18 }, // Date
            1: { cellWidth: 32 }, // Numéro
            2: { cellWidth: 40 }, // Entreprise
            3: { cellWidth: 24, halign: 'right' }, // TVA
            4: { cellWidth: 24, halign: 'right' }, // Timbre
            5: { cellWidth: 30, halign: 'right' }, // Total HT
            6: { cellWidth: 30, halign: 'right' }, // Total TTC
          },
          styles: { overflow: 'linebreak', cellPadding: { top: 1, bottom: 1, left: 1, right: 1 }, fontSize: 8 },
          margin: { left: 5, right: 5 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        // Totaux par devise
        const expensesByCurrency: Record<string, { totalHT: number; totalTimbre: number; totalTTC: number }> = {};
        expenses.forEach((exp: any) => {
          const currency = exp.devise || 'TND';
          const tvaPct = exp.tvaPct || 0;
          const montantTTC = exp.montant;
          const montantHT = tvaPct > 0 ? montantTTC / (1 + tvaPct / 100) : montantTTC;
          
          if (!expensesByCurrency[currency]) {
            expensesByCurrency[currency] = { totalHT: 0, totalTimbre: 0, totalTTC: 0 };
          }
          expensesByCurrency[currency].totalHT += montantHT;
          expensesByCurrency[currency].totalTimbre += 0; // Timbre non applicable pour les dépenses
          expensesByCurrency[currency].totalTTC += montantTTC;
        });

        // Résumé par devise
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Résumé par devise:', 14, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        Object.entries(expensesByCurrency).forEach(([currency, totals]) => {
          doc.setFont(undefined, 'bold');
          doc.text(`${currency}:`, 14, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(`Total HT: ${formatPrice(totals.totalHT, currency)}`, 35, yPosition);
          doc.text(`Total Timbre: ${formatPrice(totals.totalTimbre, currency)}`, 95, yPosition);
          doc.text(`Total TTC: ${formatPrice(totals.totalTTC, currency)}`, 140, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }
    }

    // 2. Factures de vente
    if (type === 'sales' || type === 'all') {
      const salesQuery: any = { tenantId, type: 'FAC' };
      if (Object.keys(dateFilter).length > 0) {
        salesQuery.dateDoc = dateFilter;
      }

      salesInvoices = await (Document as any).find(salesQuery)
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

      if (salesInvoices.length > 0) {
        if (yPosition > 180) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text('Factures de Vente', 14, yPosition);
        yPosition += 10;

        const salesData = salesInvoices.map((inv: any) => {
          const customer = inv.customerId ? (customersMap.get(inv.customerId) as any) : null;
          const currency = inv.devise || 'TND';
          
          return [
            new Date(inv.dateDoc).toLocaleDateString('fr-FR'),
            inv.numero,
            customer
              ? (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim())
              : 'N/A',
            formatPrice(inv.totalTVA || 0, currency),
            formatPrice(inv.timbreFiscal || 0, currency),
            formatPrice(inv.totalBaseHT || 0, currency),
            formatPrice(inv.totalTTC || 0, currency),
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Numéro', 'Client', 'TVA', 'Timbre', 'Total HT', 'Total TTC']],
          body: salesData,
          theme: 'striped',
          headStyles: { fillColor: [40, 167, 69], fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          bodyStyles: { fontSize: 8, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          columnStyles: {
            0: { cellWidth: 18 }, // Date
            1: { cellWidth: 32 }, // Numéro
            2: { cellWidth: 40 }, // Client
            3: { cellWidth: 26, halign: 'right' }, // TVA
            4: { cellWidth: 24, halign: 'right' }, // Timbre
            5: { cellWidth: 30, halign: 'right' }, // Total HT
            6: { cellWidth: 30, halign: 'right' }, // Total TTC
          },
          styles: { overflow: 'linebreak', cellPadding: { top: 1, bottom: 1, left: 1, right: 1 }, fontSize: 8 },
          margin: { left: 5, right: 5 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        // Totaux par devise
        const salesByCurrency: Record<string, { totalHT: number; totalTVA: number; totalTimbre: number; totalTTC: number }> = {};
        salesInvoices.forEach((inv: any) => {
          const currency = inv.devise || 'TND';
          if (!salesByCurrency[currency]) {
            salesByCurrency[currency] = { totalHT: 0, totalTVA: 0, totalTimbre: 0, totalTTC: 0 };
          }
          salesByCurrency[currency].totalHT += inv.totalBaseHT || 0;
          salesByCurrency[currency].totalTVA += inv.totalTVA || 0;
          salesByCurrency[currency].totalTimbre += inv.timbreFiscal || 0;
          salesByCurrency[currency].totalTTC += inv.totalTTC || 0;
        });

        // Résumé par devise
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Résumé par devise:', 14, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        Object.entries(salesByCurrency).forEach(([currency, totals]) => {
          doc.setFont(undefined, 'bold');
          doc.text(`${currency}:`, 14, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(`Total HT: ${formatPrice(totals.totalHT, currency)}`, 35, yPosition);
          doc.text(`Total TVA: ${formatPrice(totals.totalTVA, currency)}`, 95, yPosition);
          doc.text(`Total Timbre: ${formatPrice(totals.totalTimbre, currency)}`, 140, yPosition);
          yPosition += 5;
          doc.text(`Total TTC: ${formatPrice(totals.totalTTC, currency)}`, 35, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }
    }

    // 3. Factures d'achat
    if (type === 'purchases' || type === 'all') {
      const purchaseQuery: any = { societeId: tenantId };
      if (Object.keys(dateFilter).length > 0) {
        purchaseQuery.dateFacture = dateFilter;
      }

      purchaseInvoices = await (PurchaseInvoice as any).find(purchaseQuery)
        .sort({ dateFacture: -1 })
        .lean();

      if (purchaseInvoices.length > 0) {
        if (yPosition > 180) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text('Factures d\'Achat', 14, yPosition);
        yPosition += 10;

        const purchaseData = purchaseInvoices.map((inv: any) => {
          const currency = inv.devise || 'TND';
          return [
            new Date(inv.dateFacture).toLocaleDateString('fr-FR'),
            inv.numero,
            inv.fournisseurNom || 'N/A',
            formatPrice(inv.totaux?.totalTVA || 0, currency),
            formatPrice(inv.totaux?.totalFodec || 0, currency),
            formatPrice(inv.totaux?.totalTimbre || 0, currency),
            formatPrice(inv.totaux?.totalHT || 0, currency),
            formatPrice(inv.totaux?.totalTTC || 0, currency),
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Numéro', 'Fournisseur', 'TVA', 'Fodec', 'Timbre', 'Total HT', 'Total TTC']],
          body: purchaseData,
          theme: 'striped',
          headStyles: { fillColor: [23, 162, 184], fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          bodyStyles: { fontSize: 8, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          columnStyles: {
            0: { cellWidth: 18 }, // Date
            1: { cellWidth: 32 }, // Numéro
            2: { cellWidth: 38 }, // Fournisseur
            3: { cellWidth: 26, halign: 'right' }, // TVA
            4: { cellWidth: 24, halign: 'right' }, // Fodec
            5: { cellWidth: 24, halign: 'right' }, // Timbre
            6: { cellWidth: 30, halign: 'right' }, // Total HT
            7: { cellWidth: 30, halign: 'right' }, // Total TTC
          },
          styles: { overflow: 'linebreak', cellPadding: { top: 1, bottom: 1, left: 1, right: 1 }, fontSize: 8 },
          margin: { left: 5, right: 5 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        // Totaux par devise
        const purchasesByCurrency: Record<string, { totalHT: number; totalTVA: number; totalFodec: number; totalTimbre: number; totalTTC: number }> = {};
        purchaseInvoices.forEach((inv: any) => {
          const currency = inv.devise || 'TND';
          if (!purchasesByCurrency[currency]) {
            purchasesByCurrency[currency] = { totalHT: 0, totalTVA: 0, totalFodec: 0, totalTimbre: 0, totalTTC: 0 };
          }
          purchasesByCurrency[currency].totalHT += inv.totaux?.totalHT || 0;
          purchasesByCurrency[currency].totalTVA += inv.totaux?.totalTVA || 0;
          purchasesByCurrency[currency].totalFodec += inv.totaux?.totalFodec || 0;
          purchasesByCurrency[currency].totalTimbre += inv.totaux?.totalTimbre || 0;
          purchasesByCurrency[currency].totalTTC += inv.totaux?.totalTTC || 0;
        });

        // Résumé par devise
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Résumé par devise:', 14, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        Object.entries(purchasesByCurrency).forEach(([currency, totals]) => {
          doc.setFont(undefined, 'bold');
          doc.text(`${currency}:`, 14, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(`Total HT: ${formatPrice(totals.totalHT, currency)}`, 35, yPosition);
          doc.text(`Total TVA: ${formatPrice(totals.totalTVA, currency)}`, 95, yPosition);
          doc.text(`Total Fodec: ${formatPrice(totals.totalFodec, currency)}`, 140, yPosition);
          yPosition += 5;
          doc.text(`Total Timbre: ${formatPrice(totals.totalTimbre, currency)}`, 35, yPosition);
          doc.text(`Total TTC: ${formatPrice(totals.totalTTC, currency)}`, 95, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }
    }

    // 4. افوار (Invoices) - Combine Sales and Purchase Invoices
    if (type === 'invoices' || type === 'all') {
      // Combine sales and purchase invoices
      const allInvoices: any[] = [];
      
      // Add sales invoices
      if (salesInvoices && salesInvoices.length > 0) {
        const customerIds = Array.from(new Set(salesInvoices.map((inv: any) => inv.customerId).filter(Boolean)));
        const customers = customerIds.length > 0
          ? await (Customer as any).find({ 
              _id: { $in: customerIds.map((id: string) => new mongoose.Types.ObjectId(id)) },
              tenantId 
            }).lean()
          : [];
        const customersMap = new Map(customers.map((c: any) => [c._id.toString(), c]));

        salesInvoices.forEach((inv: any) => {
          const customer = inv.customerId ? (customersMap.get(inv.customerId) as any) : null;
          allInvoices.push({
            date: inv.dateDoc,
            numero: inv.numero,
            type: 'Vente',
            companyName: customer
              ? (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim())
              : 'N/A',
            tva: inv.totalTVA || 0,
            fodec: 0,
            timbre: inv.timbreFiscal || 0,
            totalHT: inv.totalBaseHT || 0,
            totalTTC: inv.totalTTC || 0,
            devise: inv.devise || 'TND',
          });
        });
      }
      
      // Add purchase invoices
      if (purchaseInvoices && purchaseInvoices.length > 0) {
        purchaseInvoices.forEach((inv: any) => {
          allInvoices.push({
            date: inv.dateFacture,
            numero: inv.numero,
            type: 'Achat',
            companyName: inv.fournisseurNom || 'N/A',
            tva: inv.totaux?.totalTVA || 0,
            fodec: inv.totaux?.totalFodec || 0,
            timbre: inv.totaux?.totalTimbre || 0,
            totalHT: inv.totaux?.totalHT || 0,
            totalTTC: inv.totaux?.totalTTC || 0,
            devise: inv.devise || 'TND',
          });
        });
      }
      
      // Sort by date descending
      allInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (allInvoices.length > 0) {
        if (yPosition > 180) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text('افوار (Factures)', 14, yPosition);
        yPosition += 10;

        const invoiceData = allInvoices.map((inv: any) => {
          const currency = inv.devise || 'TND';
          return [
            new Date(inv.date).toLocaleDateString('fr-FR'),
            inv.numero,
            inv.type,
            inv.companyName,
            formatPrice(inv.tva, currency),
            formatPrice(inv.fodec || 0, currency),
            formatPrice(inv.timbre || 0, currency),
            formatPrice(inv.totalHT, currency),
            formatPrice(inv.totalTTC, currency),
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Numéro', 'Type', 'Nom', 'TVA', 'Fodec', 'Timbre', 'Total HT', 'Total TTC']],
          body: invoiceData,
          theme: 'striped',
          headStyles: { fillColor: [108, 117, 125], fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          bodyStyles: { fontSize: 8, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          columnStyles: {
            0: { cellWidth: 16 }, // Date
            1: { cellWidth: 28 }, // Numéro
            2: { cellWidth: 22 }, // Type
            3: { cellWidth: 35 }, // Nom
            4: { cellWidth: 22, halign: 'right' }, // TVA
            5: { cellWidth: 20, halign: 'right' }, // Fodec
            6: { cellWidth: 20, halign: 'right' }, // Timbre
            7: { cellWidth: 26, halign: 'right' }, // Total HT
            8: { cellWidth: 26, halign: 'right' }, // Total TTC
          },
          styles: { overflow: 'linebreak', cellPadding: { top: 1, bottom: 1, left: 1, right: 1 }, fontSize: 8 },
          margin: { left: 5, right: 5 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        // Totaux par devise
        const invoicesByCurrency: Record<string, { totalHT: number; totalTVA: number; totalFodec: number; totalTimbre: number; totalTTC: number }> = {};
        allInvoices.forEach((inv: any) => {
          const currency = inv.devise || 'TND';
          if (!invoicesByCurrency[currency]) {
            invoicesByCurrency[currency] = { totalHT: 0, totalTVA: 0, totalFodec: 0, totalTimbre: 0, totalTTC: 0 };
          }
          invoicesByCurrency[currency].totalHT += inv.totalHT;
          invoicesByCurrency[currency].totalTVA += inv.tva;
          invoicesByCurrency[currency].totalFodec += inv.fodec || 0;
          invoicesByCurrency[currency].totalTimbre += inv.timbre || 0;
          invoicesByCurrency[currency].totalTTC += inv.totalTTC;
        });

        // Résumé par devise
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Résumé par devise:', 14, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        
        Object.entries(invoicesByCurrency).forEach(([currency, totals]) => {
          doc.setFont(undefined, 'bold');
          doc.text(`${currency}:`, 14, yPosition);
          doc.setFont(undefined, 'normal');
          doc.text(`Total HT: ${formatPrice(totals.totalHT, currency)}`, 35, yPosition);
          doc.text(`Total TVA: ${formatPrice(totals.totalTVA, currency)}`, 90, yPosition);
          doc.text(`Total Fodec: ${formatPrice(totals.totalFodec, currency)}`, 140, yPosition);
          yPosition += 5;
          doc.text(`Total Timbre: ${formatPrice(totals.totalTimbre, currency)}`, 35, yPosition);
          doc.text(`Total TTC: ${formatPrice(totals.totalTTC, currency)}`, 90, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }
    }

    // 5. Paiements
    if (type === 'payments' || type === 'all') {
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

      const allPayments = [
        ...customerPayments.map((pay: any) => ({
          ...pay,
          type: 'client',
          companyName: pay.customerId
            ? (pay.customerId.raisonSociale || `${pay.customerId.nom || ''} ${pay.customerId.prenom || ''}`.trim())
            : pay.customerNom || 'N/A',
        })),
        ...supplierPayments.map((pay: any) => ({
          ...pay,
          type: 'fournisseur',
          companyName: pay.fournisseurId
            ? (pay.fournisseurId.raisonSociale || `${pay.fournisseurId.nom || ''} ${pay.fournisseurId.prenom || ''}`.trim())
            : pay.fournisseurNom || 'N/A',
        })),
      ].sort((a, b) => new Date(b.datePaiement).getTime() - new Date(a.datePaiement).getTime());

      if (allPayments.length > 0) {
        if (yPosition > 180) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text('Paiements', 14, yPosition);
        yPosition += 10;

        const paymentData = allPayments.map((pay: any) => [
          new Date(pay.datePaiement).toLocaleDateString('fr-FR'),
          pay.numero,
          pay.companyName,
          pay.type === 'client' ? 'Client' : 'Fournisseur',
          formatPrice(pay.montantTotal || 0),
          pay.modePaiement || 'N/A',
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Date', 'Numéro', 'Nom', 'Type', 'Montant', 'Mode']],
          body: paymentData,
          theme: 'striped',
          headStyles: { fillColor: [108, 117, 125], fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          bodyStyles: { fontSize: 8, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 } },
          columnStyles: {
            0: { cellWidth: 20 }, // Date
            1: { cellWidth: 35 }, // Numéro
            2: { cellWidth: 45 }, // Nom
            3: { cellWidth: 25 }, // Type
            4: { cellWidth: 32, halign: 'right' }, // Montant
            5: { cellWidth: 25 }, // Mode
          },
          styles: { overflow: 'linebreak', cellPadding: { top: 1, bottom: 1, left: 1, right: 1 }, fontSize: 8 },
          margin: { left: 5, right: 5 },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;

        // Total
        const total = allPayments.reduce((sum: number, p: any) => sum + (p.montantTotal || 0), 0);
        const totalClients = allPayments.filter((p: any) => p.type === 'client').reduce((sum: number, p: any) => sum + (p.montantTotal || 0), 0);
        const totalFournisseurs = allPayments.filter((p: any) => p.type === 'fournisseur').reduce((sum: number, p: any) => sum + (p.montantTotal || 0), 0);
        doc.setFontSize(10);
        doc.text(`Total Clients: ${formatPrice(totalClients)}`, 14, yPosition);
        doc.text(`Total Fournisseurs: ${formatPrice(totalFournisseurs)}`, 100, yPosition);
        doc.text(`Total: ${formatPrice(total)}`, 14, yPosition + 5);
      }
    }

    // Résumé Financier - Convertir toutes les devises en TND
    if (type === 'all') {
      if (yPosition > 180) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(14);
      doc.text('Résumé Financier (TND)', 14, yPosition);
      yPosition += 8;
      doc.setFontSize(9);
      doc.text('Tous les montants sont convertis en TND selon le taux de change à la date de la facture', 14, yPosition);
      yPosition += 10;

      // Calculer les totaux convertis en TND
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

      // Convertir les ventes
      if (salesInvoices && salesInvoices.length > 0) {
        salesInvoices.forEach((inv: any) => {
          const tauxChange = inv.tauxChange || 1;
          const currency = inv.devise || 'TND';
          
          if (currency !== 'TND') {
            financialSummary.totalVentesHT += (inv.totalBaseHT || 0) * tauxChange;
            financialSummary.totalVentesTVA += (inv.totalTVA || 0) * tauxChange;
            financialSummary.totalVentesTimbre += (inv.timbreFiscal || 0) * tauxChange;
            financialSummary.totalVentesTTC += (inv.totalTTC || 0) * tauxChange;
          } else {
            financialSummary.totalVentesHT += inv.totalBaseHT || 0;
            financialSummary.totalVentesTVA += inv.totalTVA || 0;
            financialSummary.totalVentesTimbre += inv.timbreFiscal || 0;
            financialSummary.totalVentesTTC += inv.totalTTC || 0;
          }
        });
      }

      // Convertir les achats
      if (purchaseInvoices && purchaseInvoices.length > 0) {
        purchaseInvoices.forEach((inv: any) => {
          const tauxChange = inv.tauxChange || 1;
          const currency = inv.devise || 'TND';
          
          if (currency !== 'TND') {
            financialSummary.totalAchatsHT += (inv.totaux?.totalHT || 0) * tauxChange;
            financialSummary.totalAchatsTVA += (inv.totaux?.totalTVA || 0) * tauxChange;
            financialSummary.totalAchatsFodec += (inv.totaux?.totalFodec || 0) * tauxChange;
            financialSummary.totalAchatsTimbre += (inv.totaux?.totalTimbre || 0) * tauxChange;
            financialSummary.totalAchatsTTC += (inv.totaux?.totalTTC || 0) * tauxChange;
          } else {
            financialSummary.totalAchatsHT += inv.totaux?.totalHT || 0;
            financialSummary.totalAchatsTVA += inv.totaux?.totalTVA || 0;
            financialSummary.totalAchatsFodec += inv.totaux?.totalFodec || 0;
            financialSummary.totalAchatsTimbre += inv.totaux?.totalTimbre || 0;
            financialSummary.totalAchatsTTC += inv.totaux?.totalTTC || 0;
          }
        });
      }

      // Convertir les dépenses
      if (expenses && expenses.length > 0) {
        expenses.forEach((exp: any) => {
          const tauxChange = 1; // TODO: Ajouter tauxChange dans Expense
          const currency = exp.devise || 'TND';
          const tvaPct = exp.tvaPct || 0;
          const montantTTC = exp.montant;
          const montantHT = tvaPct > 0 ? montantTTC / (1 + tvaPct / 100) : montantTTC;
          
          if (currency !== 'TND') {
            financialSummary.totalDepensesHT += montantHT * tauxChange;
            financialSummary.totalDepensesTVA += (montantTTC - montantHT) * tauxChange;
            financialSummary.totalDepensesTTC += montantTTC * tauxChange;
          } else {
            financialSummary.totalDepensesHT += montantHT;
            financialSummary.totalDepensesTVA += (montantTTC - montantHT);
            financialSummary.totalDepensesTTC += montantTTC;
          }
        });
      }

      // Afficher le résumé
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Ventes:', 14, yPosition);
      yPosition += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text(`Total HT: ${formatPrice(financialSummary.totalVentesHT, 'TND')}`, 20, yPosition);
      doc.text(`Total TVA: ${formatPrice(financialSummary.totalVentesTVA, 'TND')}`, 80, yPosition);
      doc.text(`Total Timbre: ${formatPrice(financialSummary.totalVentesTimbre, 'TND')}`, 140, yPosition);
      yPosition += 5;
      doc.setFont(undefined, 'bold');
      doc.text(`Total TTC: ${formatPrice(financialSummary.totalVentesTTC, 'TND')}`, 20, yPosition);
      yPosition += 8;

      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('Achats:', 14, yPosition);
      yPosition += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text(`Total HT: ${formatPrice(financialSummary.totalAchatsHT, 'TND')}`, 20, yPosition);
      doc.text(`Total TVA: ${formatPrice(financialSummary.totalAchatsTVA, 'TND')}`, 80, yPosition);
      doc.text(`Total Fodec: ${formatPrice(financialSummary.totalAchatsFodec, 'TND')}`, 140, yPosition);
      yPosition += 5;
      doc.text(`Total Timbre: ${formatPrice(financialSummary.totalAchatsTimbre, 'TND')}`, 20, yPosition);
      doc.setFont(undefined, 'bold');
      doc.text(`Total TTC: ${formatPrice(financialSummary.totalAchatsTTC, 'TND')}`, 80, yPosition);
      yPosition += 8;

      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.text('Dépenses:', 14, yPosition);
      yPosition += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      doc.text(`Total HT: ${formatPrice(financialSummary.totalDepensesHT, 'TND')}`, 20, yPosition);
      doc.text(`Total TVA: ${formatPrice(financialSummary.totalDepensesTVA, 'TND')}`, 80, yPosition);
      doc.setFont(undefined, 'bold');
      doc.text(`Total TTC: ${formatPrice(financialSummary.totalDepensesTTC, 'TND')}`, 140, yPosition);
      yPosition += 8;

      // Marge brute
      const margeBrute = financialSummary.totalVentesHT - financialSummary.totalAchatsHT - financialSummary.totalDepensesHT;
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Marge brute (TND):', 14, yPosition);
      doc.setFont(undefined, 'normal');
      doc.text(formatPrice(margeBrute, 'TND'), 80, yPosition);
    }

    // Pied de page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} sur ${pageCount} - Généré le ${new Date().toLocaleDateString('fr-FR')}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    // Générer le PDF
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-comptable-${type}-${dateFrom || 'all'}-${dateTo || 'all'}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Erreur lors de l\'exportation PDF:', error);
    return NextResponse.json(
      { error: 'Erreur serveur', details: (error as Error).message },
      { status: 500 }
    );
  }
}

