'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  ChartBarIcon,
  DocumentTextIcon,
  CurrencyEuroIcon,
  UserGroupIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  CalendarIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface Expense {
  _id: string;
  numero: string;
  date: string;
  companyName: string;
  tva: number; // Pourcentage TVA
  tvaAmount?: number; // Montant TVA
  fodec: number;
  timbre: number;
  totalHT: number;
  totalTTC: number;
  devise: string;
  description: string;
  categorie: string;
  statut: string;
}

interface SalesInvoice {
  _id: string;
  numero: string;
  date: string;
  companyName: string;
  tva: number;
  fodec: number;
  timbre: number;
  totalHT: number;
  totalTTC: number;
  devise: string;
  statut: string;
  referenceExterne?: string;
}

interface PurchaseInvoice {
  _id: string;
  numero: string;
  date: string;
  companyName: string;
  tva: number;
  fodec: number;
  timbre: number;
  totalHT: number;
  totalTTC: number;
  devise: string;
  statut: string;
  referenceFournisseur?: string;
}

interface Payment {
  _id: string;
  numero: string;
  date: string;
  companyName: string;
  type: 'client' | 'fournisseur';
  montant: number;
  modePaiement: string;
  reference?: string;
  isPaymentOnAccount: boolean;
}

interface Invoice {
  _id: string;
  numero: string;
  date: string;
  companyName: string;
  type: 'vente' | 'achat';
  tva: number;
  fodec?: number;
  timbre: number;
  totalHT: number;
  totalTTC: number;
  devise: string;
  statut: string;
  referenceExterne?: string;
  referenceFournisseur?: string;
}

interface AccountingReportData {
  expenses?: Expense[];
  salesInvoices?: SalesInvoice[];
  purchaseInvoices?: PurchaseInvoice[];
  invoices?: Invoice[];
  payments?: Payment[];
  expensesSummary?: {
    total: number;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
  };
  expensesSummaryByCurrency?: Record<string, { totalHT: number; totalTVA: number; totalTimbre: number; totalTTC: number; count: number }>;
  salesSummary?: {
    total: number;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
  };
  salesSummaryByCurrency?: Record<string, { totalHT: number; totalTVA: number; totalTimbre: number; totalTTC: number; count: number }>;
  purchasesSummary?: {
    total: number;
    totalHT: number;
    totalTVA: number;
    totalFodec: number;
    totalTTC: number;
  };
  purchasesSummaryByCurrency?: Record<string, { totalHT: number; totalTVA: number; totalFodec: number; totalTimbre: number; totalTTC: number; count: number }>;
  paymentsSummary?: {
    count: number;
    totalClients: number;
    totalFournisseurs: number;
    total: number;
  };
  financialSummary?: {
    totalVentesHT: number;
    totalVentesTVA: number;
    totalVentesTimbre: number;
    totalVentesTTC: number;
    totalAchatsHT: number;
    totalAchatsTVA: number;
    totalAchatsFodec: number;
    totalAchatsTimbre: number;
    totalAchatsTTC: number;
    totalDepensesHT: number;
    totalDepensesTVA: number;
    totalDepensesTTC: number;
  };
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<AccountingReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'expenses' | 'sales' | 'purchases' | 'payments' | 'invoices'>('expenses');

  // Filtres
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [justification, setJustification] = useState('justified'); // 'justified', 'non_justified', 'all'
  const [avoirType, setAvoirType] = useState('client'); // 'client', 'fournisseur', 'all'
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [dateFrom, dateTo, justification, avoirType]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      if (justification === 'justified') {
        params.append('isDeclared', 'true');
      } else if (justification === 'non_justified') {
        params.append('isDeclared', 'false');
      }

      params.append('avoirType', avoirType);
      params.append('type', 'all');

      const response = await fetch(`/api/reports/accounting?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors du chargement des rapports');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (expenseId: string, newStatus: string) => {
    console.log('Changing status for expense:', expenseId, 'to:', newStatus);
    try {
      // Mettre à jour l'état local immédiatement pour un feedback visuel rapide
      if (reportData && reportData.expenses) {
        setReportData({
          ...reportData,
          expenses: reportData.expenses.map(exp =>
            exp._id === expenseId ? { ...exp, statut: newStatus } : exp
          )
        });
      }

      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statut: newStatus }),
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const updatedData = await response.json();
        console.log('Updated expense:', updatedData);
        // Rafraîchir les données pour s'assurer de la cohérence
        await fetchReportData();
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la mise à jour:', errorData);
        setError(errorData.error || 'Erreur lors de la mise à jour du statut');
        // Recharger les données pour annuler le changement local
        await fetchReportData();
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError('Erreur de connexion lors de la mise à jour du statut');
      // Recharger les données pour annuler le changement local
      await fetchReportData();
    }
  };

  const formatPrice = (price: number, currency: string = 'TND', decimals: number = 3) => {
    // Format manuel pour afficher 3 chiffres après la virgule
    // Utiliser toLocaleString pour un formatage correct avec espaces insécables
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(price);
    const currencySymbol = currency === 'TND' ? 'TND' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    // Utiliser un espace insécable (\u00A0) pour éviter le retour à la ligne
    return `${formatted}\u00A0${currencySymbol}`;
  };

  const formatDate = (date: string | Date) => {
    try {
      return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return date.toString();
    }
  };

  const handleExportPDF = async (type: 'expenses' | 'sales' | 'purchases' | 'payments' | 'invoices' | 'all') => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      if (justification === 'justified') {
        params.append('isDeclared', 'true');
      } else if (justification === 'non_justified') {
        params.append('isDeclared', 'false');
      }

      params.append('avoirType', avoirType);

      params.append('type', type);
      params.append('format', 'pdf');

      const response = await fetch(`/api/reports/accounting/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-${type}-${dateFrom || 'all'}-${dateTo || 'all'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Rapport téléchargé avec succès');
      } else {
        toast.error('Erreur lors de l\'exportation');
      }
    } catch (err) {
      toast.error('Erreur de connexion');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setJustification('justified');
    setAvoirType('client');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 h-32 border dark:border-gray-700" />

          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 h-24 rounded-lg shadow border dark:border-gray-700" />
            ))}
          </div>

          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-full" />

          <div className="bg-white dark:bg-gray-800 h-96 rounded-lg shadow border dark:border-gray-700" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Rapports & Statistiques</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Rapports comptables détaillés pour votre entreprise
            </p>
          </div>
          <button
            onClick={() => handleExportPDF('all')}
            disabled={exporting}
            className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent rounded-md shadow-sm text-xs sm:text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 w-full sm:w-auto"
          >
            <ArrowDownTrayIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className="hidden sm:inline">{exporting ? 'Exportation...' : 'Exporter tout en PDF'}</span>
            <span className="sm:hidden">{exporting ? 'Export...' : 'Exporter PDF'}</span>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900/50 rounded-md p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
            <FunnelIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Filtres</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>

            {activeTab === 'expenses' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Justification
                </label>
                <select
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="justified">Justifiée</option>
                  <option value="non_justified">Non justifiée</option>
                  <option value="all">Tout</option>
                </select>
              </div>
            )}

            {activeTab === 'invoices' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type d'Avoir
                </label>
                <select
                  value={avoirType}
                  onChange={(e) => setAvoirType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="client">Client</option>
                  <option value="fournisseur">Fournisseur</option>
                  <option value="all">Tout</option>
                </select>
              </div>
            )}

            <div className="flex items-end sm:col-span-1 lg:col-span-1">
              <button
                onClick={resetFilters}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {reportData && (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Dépenses */}
            {reportData.expensesSummary && (
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
                <div className="p-4 sm:p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BanknotesIcon className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" />
                    </div>
                    <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                      <dl>
                        <dt className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Dépenses
                        </dt>
                        <dd className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">
                          {formatPrice(reportData.expensesSummary.totalTTC)}
                        </dd>
                        <dd className="text-xs text-gray-500 dark:text-gray-400">
                          {reportData.expensesSummary.total} dépense(s)
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Ventes */}
            {reportData.salesSummary && (
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
                <div className="p-4 sm:p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ShoppingBagIcon className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
                    </div>
                    <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                      <dl>
                        <dt className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Ventes TTC
                        </dt>
                        <dd className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">
                          {formatPrice(reportData.salesSummary.totalTTC)}
                        </dd>
                        <dd className="text-xs text-gray-500 dark:text-gray-400">
                          {reportData.salesSummary.total} facture(s)
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Achats */}
            {reportData.purchasesSummary && (
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
                <div className="p-4 sm:p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                    </div>
                    <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                      <dl>
                        <dt className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Achats TTC
                        </dt>
                        <dd className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">
                          {formatPrice(reportData.purchasesSummary.totalTTC)}
                        </dd>
                        <dd className="text-xs text-gray-500 dark:text-gray-400">
                          {reportData.purchasesSummary.total} facture(s)
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Paiements */}
            {reportData.paymentsSummary && (
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border dark:border-gray-700">
                <div className="p-4 sm:p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CreditCardIcon className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                    </div>
                    <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                      <dl>
                        <dt className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Paiements
                        </dt>
                        <dd className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">
                          {formatPrice(reportData.paymentsSummary.total)}
                        </dd>
                        <dd className="text-xs text-gray-500 dark:text-gray-400">
                          {reportData.paymentsSummary.total} paiement(s)
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max sm:min-w-0">
            {[
              { id: 'expenses', label: 'Dépenses', icon: BanknotesIcon, shortLabel: 'Dépenses' },
              { id: 'sales', label: 'Factures de Vente', icon: ShoppingBagIcon, shortLabel: 'Ventes' },
              { id: 'purchases', label: "Factures d'Achat", icon: DocumentTextIcon, shortLabel: 'Achats' },
              { id: 'invoices', label: "Factures d'Avoir", icon: DocumentTextIcon, shortLabel: 'Avoirs' },
              { id: 'payments', label: 'Paiements', icon: CreditCardIcon, shortLabel: 'Paiements' },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center space-x-1 sm:space-x-2 whitespace-nowrap ${activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tables Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
          {/* Dépenses Table */}
          {activeTab === 'expenses' && reportData?.expenses && (
            <div>
              <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  Dépenses ({reportData.expenses.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('expenses')}
                  disabled={exporting}
                  className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 w-full sm:w-auto"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                        Nom de l'entreprise
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        TVA
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        FODEC
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        Timbre
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total HT
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.expenses.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          Aucune dépense trouvée
                        </td>
                      </tr>
                    ) : (
                      reportData.expenses.map((expense) => (
                        <tr key={expense._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white">
                            {formatDate(expense.date)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white">
                            {expense.numero}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            {expense.companyName}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400" style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(expense.tvaAmount || ((expense.totalTTC || 0) - (expense.totalHT || 0) - (expense.timbre || 0) - (expense.fodec || 0)), expense.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell" style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(expense.fodec || 0, expense.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell" style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(expense.timbre || 0, expense.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white" style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(expense.totalHT, expense.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white" style={{ whiteSpace: 'nowrap' }}>
                            {formatPrice(expense.totalTTC, expense.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`px-1.5 inline-flex text-xs leading-5 font-semibold rounded-full ${expense.statut === 'paye' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                              expense.statut === 'valide' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                expense.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                              {expense.statut.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {reportData.expensesSummaryByCurrency && reportData.expenses.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                      {Object.entries(reportData.expensesSummaryByCurrency).map(([currency, summary]: [string, any]) => (
                        <tr key={currency} className="border-t border-gray-200 dark:border-gray-700">
                          <td colSpan={5} className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            Total ({currency}):
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white hidden md:table-cell">
                            {formatPrice(summary.totalHT, currency)}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalTTC, currency)}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                            ({summary.count} dépense{summary.count > 1 ? 's' : ''})
                          </td>
                        </tr>
                      ))}
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Factures de Vente Table */}
          {activeTab === 'sales' && reportData?.salesInvoices && (
            <div>
              <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  Factures de Vente ({reportData.salesInvoices.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('sales')}
                  disabled={exporting}
                  className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 w-full sm:w-auto"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                        Nom du client
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        TVA
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        Timbre
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total HT
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.salesInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          Aucune facture de vente trouvée
                        </td>
                      </tr>
                    ) : (
                      reportData.salesInvoices.map((invoice) => (
                        <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                            {formatDate(invoice.date)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {invoice.numero}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            {invoice.companyName}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.tva, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {formatPrice(invoice.timbre || 0, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalHT, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalTTC, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap hidden lg:table-cell">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.statut === 'PAYEE' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                              invoice.statut === 'PARTIELLEMENT_PAYEE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                invoice.statut === 'VALIDEE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                              {invoice.statut}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {reportData.salesSummaryByCurrency && reportData.salesInvoices.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                      {Object.entries(reportData.salesSummaryByCurrency).map(([currency, summary]: [string, any]) => (
                        <tr key={currency} className="border-t border-gray-200 dark:border-gray-700">
                          <td colSpan={5} className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            Total ({currency}):
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalHT, currency)}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalTTC, currency)}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                            ({summary.count} facture{summary.count > 1 ? 's' : ''})
                          </td>
                        </tr>
                      ))}
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Factures d'Achat Table */}
          {activeTab === 'purchases' && reportData?.purchaseInvoices && (
            <div>
              <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  Factures d'Achat ({reportData.purchaseInvoices.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('purchases')}
                  disabled={exporting}
                  className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 w-full sm:w-auto"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                        Nom du fournisseur
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        TVA
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        Fodec
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        Timbre
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total HT
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden xl:table-cell">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.purchaseInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          Aucune facture d'achat trouvée
                        </td>
                      </tr>
                    ) : (
                      reportData.purchaseInvoices.map((invoice) => (
                        <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                            {formatDate(invoice.date)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {invoice.numero}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            {invoice.companyName}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.tva, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {formatPrice(invoice.fodec, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                            {formatPrice(invoice.timbre, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalHT, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalTTC, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap hidden xl:table-cell">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.statut === 'PAYEE' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                              invoice.statut === 'PARTIELLEMENT_PAYEE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                invoice.statut === 'VALIDEE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                              {invoice.statut}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {reportData.purchasesSummaryByCurrency && reportData.purchaseInvoices.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                      {Object.entries(reportData.purchasesSummaryByCurrency).map(([currency, summary]: [string, any]) => (
                        <tr key={currency} className="border-t border-gray-200 dark:border-gray-700">
                          <td colSpan={6} className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            Total ({currency}):
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalHT, currency)}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalTTC, currency)}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden xl:table-cell">
                            ({summary.count} facture{summary.count > 1 ? 's' : ''})
                          </td>
                        </tr>
                      ))}
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
          {/* Factures d'Avoir Table */}
          {activeTab === 'invoices' && reportData?.invoices && (
            <div>
              <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  Factures d'Avoir ({reportData.invoices.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('invoices')}
                  disabled={exporting}
                  className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 w-full sm:w-auto"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Tiers
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        TVA
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        Timbre
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total HT
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          Aucune facture d'avoir trouvée
                        </td>
                      </tr>
                    ) : (
                      reportData.invoices.map((invoice) => (
                        <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                            {formatDate(invoice.date)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {invoice.numero}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {invoice.companyName}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.type === 'vente'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              }`}>
                              {invoice.type === 'vente' ? 'Vente' : 'Achat'}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.tva || 0, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {formatPrice(invoice.timbre || 0, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalHT, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalTTC, invoice.devise || 'TND')}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap hidden lg:table-cell">
                            {invoice.statut ? (
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${invoice.statut === 'PAYEE' || invoice.statut === 'paye' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                                invoice.statut === 'PARTIELLEMENT_PAYEE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                  invoice.statut === 'VALIDEE' || invoice.statut === 'valide' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                {invoice.statut}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Paiements Table */}
          {activeTab === 'payments' && reportData?.payments && (
            <div>
              <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  Paiements ({reportData.payments.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('payments')}
                  disabled={exporting}
                  className="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 w-full sm:w-auto"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Tiers
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                        Mode
                      </th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        Référence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          Aucun paiement trouvé
                        </td>
                      </tr>
                    ) : (
                      reportData.payments.map((payment) => (
                        <tr key={payment._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                            {formatDate(payment.date)}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {payment.numero}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {payment.companyName}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            {payment.type === 'client' ? 'Client' : 'Fournisseur'}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(payment.montant, 'TND')}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            {payment.modePaiement}
                          </td>
                          <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {payment.reference || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
