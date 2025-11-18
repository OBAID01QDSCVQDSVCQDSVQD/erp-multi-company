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
  tva: number;
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

interface AccountingReportData {
  expenses?: Expense[];
  salesInvoices?: SalesInvoice[];
  purchaseInvoices?: PurchaseInvoice[];
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
  const [activeTab, setActiveTab] = useState<'expenses' | 'sales' | 'purchases' | 'payments'>('expenses');
  
  // Filtres
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [dateFrom, dateTo]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
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

  const formatPrice = (price: number, currency: string = 'TND', decimals: number = 3) => {
    // Format manuel pour afficher 3 chiffres après la virgule
    const formatted = price.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const currencySymbol = currency === 'TND' ? 'TND' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    return `${formatted.replace('.', ',')} ${currencySymbol}`;
  };

  const formatDate = (date: string | Date) => {
    try {
      return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return date.toString();
    }
  };

  const handleExportPDF = async (type: 'expenses' | 'sales' | 'purchases' | 'payments' | 'all') => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
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
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rapports & Statistiques</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Rapports comptables détaillés pour votre entreprise
            </p>
          </div>
          <button
            onClick={() => handleExportPDF('all')}
            disabled={exporting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            {exporting ? 'Exportation...' : 'Exporter tout en PDF'}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Filtres</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {reportData && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Dépenses */}
            {reportData.expensesSummary && (
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BanknotesIcon className="h-6 w-6 text-red-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Dépenses
                        </dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white">
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
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ShoppingBagIcon className="h-6 w-6 text-green-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Ventes TTC
                        </dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white">
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
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <DocumentTextIcon className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Achats TTC
                        </dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white">
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
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CreditCardIcon className="h-6 w-6 text-purple-400" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                          Paiements
                        </dt>
                        <dd className="text-lg font-medium text-gray-900 dark:text-white">
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
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'expenses', label: 'Dépenses', icon: BanknotesIcon },
              { id: 'sales', label: 'Factures de Vente', icon: ShoppingBagIcon },
              { id: 'purchases', label: 'Factures d\'Achat', icon: DocumentTextIcon },
              { id: 'payments', label: 'Paiements', icon: CreditCardIcon },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tables Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Dépenses Table */}
          {activeTab === 'expenses' && reportData?.expenses && (
            <div>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Dépenses ({reportData.expenses.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('expenses')}
                  disabled={exporting}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nom de l'entreprise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        TVA (%)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timbre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total HT
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.expenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          Aucune dépense trouvée
                        </td>
                      </tr>
                    ) : (
                      reportData.expenses.map((expense) => (
                        <tr key={expense._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(expense.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {expense.numero}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {expense.companyName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {expense.tva}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(expense.timbre || 0, expense.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatPrice(expense.totalHT, expense.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(expense.totalTTC, expense.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              expense.statut === 'paye' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              expense.statut === 'valide' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              expense.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {expense.statut}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {reportData.expensesSummaryByCurrency && reportData.expenses.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-gray-900">
                      {Object.entries(reportData.expensesSummaryByCurrency).map(([currency, summary]: [string, any]) => (
                        <tr key={currency} className="border-t border-gray-200 dark:border-gray-700">
                          <td colSpan={4} className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                            Total ({currency}):
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalHT, currency)}
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalTTC, currency)}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
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
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Factures de Vente ({reportData.salesInvoices.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('sales')}
                  disabled={exporting}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nom du client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        TVA
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timbre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total HT
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.salesInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          Aucune facture de vente trouvée
                        </td>
                      </tr>
                    ) : (
                      reportData.salesInvoices.map((invoice) => (
                        <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(invoice.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {invoice.numero}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {invoice.companyName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.tva, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.timbre || 0, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalHT, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalTTC, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              invoice.statut === 'PAYEE' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              invoice.statut === 'PARTIELLEMENT_PAYEE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              invoice.statut === 'VALIDEE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
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
                    <tfoot className="bg-gray-50 dark:bg-gray-900">
                      {Object.entries(reportData.salesSummaryByCurrency).map(([currency, summary]: [string, any]) => (
                        <tr key={currency} className="border-t border-gray-200 dark:border-gray-700">
                          <td colSpan={5} className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                            Total ({currency}):
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalHT, currency)}
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalTTC, currency)}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
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
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Factures d'Achat ({reportData.purchaseInvoices.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('purchases')}
                  disabled={exporting}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nom du fournisseur
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        TVA
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Fodec
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timbre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total HT
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.purchaseInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          Aucune facture d'achat trouvée
                        </td>
                      </tr>
                    ) : (
                      reportData.purchaseInvoices.map((invoice) => (
                        <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(invoice.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {invoice.numero}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {invoice.companyName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.tva, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.fodec, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatPrice(invoice.timbre || 0, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalHT, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(invoice.totalTTC, invoice.devise || 'TND')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              invoice.statut === 'PAYEE' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              invoice.statut === 'PARTIELLEMENT_PAYEE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              invoice.statut === 'VALIDEE' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
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
                    <tfoot className="bg-gray-50 dark:bg-gray-900">
                      {Object.entries(reportData.purchasesSummaryByCurrency).map(([currency, summary]: [string, any]) => (
                        <tr key={currency} className="border-t border-gray-200 dark:border-gray-700">
                          <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                            Total ({currency}):
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalHT, currency)}
                          </td>
                          <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(summary.totalTTC, currency)}
                          </td>
                          <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
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

          {/* Paiements Table */}
          {activeTab === 'payments' && reportData?.payments && (
            <div>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Paiements ({reportData.payments.length})
                </h3>
                <button
                  onClick={() => handleExportPDF('payments')}
                  disabled={exporting}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                  PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nom
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Mode de paiement
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Référence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.payments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                          Aucun paiement trouvé
                        </td>
                      </tr>
                    ) : (
                      reportData.payments.map((payment) => (
                        <tr key={payment._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(payment.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {payment.numero}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {payment.companyName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              payment.type === 'client' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {payment.type === 'client' ? 'Client' : 'Fournisseur'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(payment.montant)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {payment.modePaiement}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {payment.reference || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {reportData.paymentsSummary && reportData.payments.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <td colSpan={4} className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                          Total:
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {formatPrice(reportData.paymentsSummary.total)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Statistiques supplémentaires */}
        {reportData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Résumé financier */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Résumé Financier (TND)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Tous les montants sont convertis en TND selon le taux de change à la date de la facture
              </p>
              <div className="space-y-3">
                {reportData.financialSummary && (
                  <>
                    <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ventes</h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total HT:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalVentesHT, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total TVA:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalVentesTVA, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Timbre:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalVentesTimbre, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Total TTC:</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalVentesTTC, 'TND')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Achats</h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total HT:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalAchatsHT, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total TVA:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalAchatsTVA, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Fodec:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalAchatsFodec, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total Timbre:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalAchatsTimbre, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Total TTC:</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalAchatsTTC, 'TND')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="pb-2 border-b border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Dépenses</h4>
                      <div className="space-y-2 pl-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total HT:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalDepensesHT, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Total TVA:</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalDepensesTVA, 'TND')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Total TTC:</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {formatPrice(reportData.financialSummary.totalDepensesTTC, 'TND')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 border-t-2 border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">Marge brute (TND):</span>
                        <span className={`text-sm font-bold ${
                          (reportData.financialSummary.totalVentesHT - reportData.financialSummary.totalAchatsHT - reportData.financialSummary.totalDepensesHT) >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatPrice(
                            reportData.financialSummary.totalVentesHT - 
                            reportData.financialSummary.totalAchatsHT - 
                            reportData.financialSummary.totalDepensesHT,
                            'TND'
                          )}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* TVA Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Résumé TVA
              </h3>
              <div className="space-y-3">
                {reportData.salesSummary && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">TVA collectée (Ventes):</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPrice(reportData.salesSummary.totalTVA)}
                    </span>
                  </div>
                )}
                {reportData.purchasesSummary && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">TVA déductible (Achats):</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPrice(reportData.purchasesSummary.totalTVA)}
                    </span>
                  </div>
                )}
                {reportData.salesSummary && reportData.purchasesSummary && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">TVA à payer:</span>
                      <span className={`text-sm font-bold ${
                        (reportData.salesSummary.totalTVA - reportData.purchasesSummary.totalTVA) >= 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatPrice(reportData.salesSummary.totalTVA - reportData.purchasesSummary.totalTVA)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
