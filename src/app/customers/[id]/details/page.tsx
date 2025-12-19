'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import {
  MagnifyingGlassIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  DocumentTextIcon,
  BanknotesIcon,
  CreditCardIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface Transaction {
  id: string;
  type: 'facture' | 'paiement' | 'avoir';
  numero: string;
  reference: string;
  date: string;
  dateEcheance: string | null;
  montant: number;
  montantPaye: number;
  soldeRestant: number;
  statut: string;
  devise: string;
  notes?: string;
  conditionsPaiement?: string;
  modePaiement?: string;
  documentType: string;
  invoiceType?: string; // 'FAC' or 'INT_FAC' - to distinguish between official and internal invoices
  lignes?: Array<{
    factureNumero: string;
    montantPaye: number;
  }>;
  isPaymentOnAccount?: boolean;
}

interface Summary {
  totalFactures: number;
  totalPaiements: number;
  totalAvoirs: number;
  soldeActuel: number;
  facturesOuvertes: number;
  soldeAvanceDisponible?: number;
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('facture'); // Default to facture
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);


  useEffect(() => {
    if (tenantId && customerId) {
      setCurrentPage(1); // Reset to first page when filters change
    }
  }, [tenantId, customerId, dateDebut, dateFin, typeFilter, searchTerm]);

  useEffect(() => {
    if (tenantId && customerId) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, customerId, dateDebut, dateFin, typeFilter, searchTerm, currentPage]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      if (!tenantId) return;

      const params = new URLSearchParams();
      if (dateDebut) params.append('dateDebut', dateDebut);
      if (dateFin) params.append('dateFin', dateFin);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', currentPage.toString());
      params.append('limit', '50');

      const response = await fetch(`/api/customers/${customerId}/transactions?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomer(data.customer);
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors du chargement des transactions');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'facture':
        return 'Facture';
      case 'paiement':
        return 'Paiement';
      case 'avoir':
        return 'Avoir';
      default:
        return type;
    }
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'facture':
        return <DocumentTextIcon className="w-5 h-5 text-blue-600" />;
      case 'paiement':
        return <BanknotesIcon className="w-5 h-5 text-green-600" />;
      case 'avoir':
        return <CreditCardIcon className="w-5 h-5 text-orange-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (statut: string, type: string) => {
    const baseClasses = 'px-2 py-1 rounded text-xs font-medium';
    if (type === 'paiement') {
      if (statut === 'PAYE_SUR_COMPTE') {
        return <span className={`${baseClasses} bg-purple-100 text-purple-800`}>Paiement sur compte</span>;
      }
      return <span className={`${baseClasses} bg-green-100 text-green-800`}>Payé</span>;
    }
    if (type === 'avoir') {
      return <span className={`${baseClasses} bg-orange-100 text-orange-800`}>Avoir</span>;
    }
    switch (statut) {
      case 'PAYEE':
        return <span className={`${baseClasses} bg-green-100 text-green-800`}>Payée</span>;
      case 'PARTIELLEMENT_PAYEE':
        return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>Partiellement payée</span>;
      case 'VALIDEE':
        return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>Validée</span>;
      case 'BROUILLON':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>Brouillon</span>;
      case 'ANNULEE':
        return <span className={`${baseClasses} bg-red-100 text-red-800`}>Annulée</span>;
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{statut}</span>;
    }
  };

  const handleExport = async () => {
    try {
      // Fetch all transactions without pagination for export
      const params = new URLSearchParams();
      if (dateDebut) params.append('dateDebut', dateDebut);
      if (dateFin) params.append('dateFin', dateFin);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', '1');
      params.append('limit', '10000'); // Large limit to get all

      const response = await fetch(`/api/customers/${customerId}/transactions?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId || '' },
      });

      if (!response.ok) {
        alert('Erreur lors de l\'export');
        return;
      }

      const data = await response.json();
      const allTransactions = data.transactions || [];
      const exportSummary = data.summary || summary;

      // Create CSV content with header info
      const csvLines: string[] = [];

      // Header information
      csvLines.push(`"Détails des transactions - ${customer?.nom || 'Client'}"`);
      csvLines.push(`"Date d'export: ${new Date().toLocaleDateString('fr-FR')}"`);
      csvLines.push('');

      if (exportSummary) {
        csvLines.push('"RÉSUMÉ"');
        csvLines.push(`"Total Factures","${exportSummary.totalFactures.toFixed(3)}"`);
        csvLines.push(`"Total Paiements","${exportSummary.totalPaiements.toFixed(3)}"`);
        csvLines.push(`"Total Avoirs","${exportSummary.totalAvoirs.toFixed(3)}"`);
        csvLines.push(`"Factures Ouvertes","${exportSummary.facturesOuvertes.toFixed(3)}"`);
        csvLines.push(`"Solde avance disponible","${(exportSummary.soldeAvanceDisponible ?? 0).toFixed(3)}"`);
        csvLines.push('');
      }

      // Table headers
      const headers = ['Référence', 'Date', 'Échéance', 'Montant (TND)', 'Payé (TND)', 'Reste (TND)', 'Statut', 'Mode Paiement', 'Notes'];
      csvLines.push(headers.map(h => `"${h}"`).join(','));

      // Table rows
      allTransactions.forEach(t => {
        const row = [
          t.reference || t.numero || '',
          formatDate(t.date),
          formatDate(t.dateEcheance) || '',
          t.montant.toFixed(3),
          t.montantPaye.toFixed(3),
          t.soldeRestant.toFixed(3),
          t.statut,
          t.modePaiement || '',
          (t.notes || '').replace(/"/g, '""'), // Escape quotes in notes
        ];
        csvLines.push(row.map(cell => `"${cell}"`).join(','));
      });

      const csvContent = csvLines.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const fileName = `transactions_${(customer?.nom || 'client').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting:', err);
      alert('Erreur lors de l\'export');
    }
  };

  const handleViewDocument = (transaction: Transaction) => {
    if (transaction.documentType === 'Document') {
      // Check if it's an internal invoice using invoiceType field
      if (transaction.invoiceType === 'INT_FAC') {
        router.push(`/internal-invoices/${transaction.id}`);
      } else {
        router.push(`/sales/invoices/${transaction.id}`);
      }
    } else if (transaction.documentType === 'PaiementClient') {
      router.push(`/sales/payments/${transaction.id}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Détails des transactions</h1>
              {customer && (
                <p className="text-gray-600 dark:text-gray-400">{customer.nom}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Exporter CSV
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Factures</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(summary.totalFactures)}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Paiements</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(summary.totalPaiements)}
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Avoirs</div>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {formatCurrency(summary.totalAvoirs)}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Factures Ouvertes</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(summary.facturesOuvertes)}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Solde avance disponible</div>
              <div className={`text-2xl font-bold ${(summary.soldeAvanceDisponible ?? 0) >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {(summary.soldeAvanceDisponible ?? 0) >= 0 && '+'}
                {formatCurrency(Math.abs(summary.soldeAvanceDisponible ?? 0))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 space-y-4">
          {/* Type Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setTypeFilter('facture')}
                className={`${typeFilter === 'facture'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
              >
                <DocumentTextIcon className="w-5 h-5" />
                Factures
              </button>
              <button
                onClick={() => setTypeFilter('paiement')}
                className={`${typeFilter === 'paiement'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
                  } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
              >
                <BanknotesIcon className="w-5 h-5" />
                Paiements
              </button>
            </nav>
          </div>

          {/* Search and Date Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher par numéro, référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date Début */}
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Date début"
              />
            </div>

            {/* Date Fin */}
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Date fin"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    {[...Array(8)].map((_, i) => (
                      <th key={i} className="px-6 py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : error ? (
          <div className="text-red-600 py-4">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Aucune transaction trouvée
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Échéance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Payé
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Reste
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((transaction) => (
                    <tr key={`${transaction.type}-${transaction.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {transaction.type === 'paiement' && transaction.isPaymentOnAccount
                            ? 'Paiement sur compte'
                            : transaction.reference || transaction.numero || '-'}
                        </div>
                        {transaction.type === 'paiement' && transaction.isPaymentOnAccount && (
                          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Sur compte</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-300">{formatDate(transaction.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-300">{formatDate(transaction.dateEcheance)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${transaction.type === 'avoir' || transaction.type === 'paiement'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-900 dark:text-white'
                          }`}>
                          {transaction.type === 'avoir' || transaction.type === 'paiement' ? '-' : ''}
                          {formatCurrency(transaction.montant)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {formatCurrency(transaction.montantPaye)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${transaction.soldeRestant > 0
                          ? 'text-red-600 dark:text-red-400'
                          : transaction.soldeRestant < 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-600 dark:text-gray-400'
                          }`}>
                          {transaction.soldeRestant > 0 ? '+' : ''}
                          {formatCurrency(Math.abs(transaction.soldeRestant))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getStatusBadge(transaction.statut, transaction.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDocument(transaction)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                            title="Voir le document"
                          >
                            <EyeIcon className="w-4 h-4 mr-1" />
                            Voir
                          </button>
                          {transaction.type === 'paiement' && transaction.lignes && transaction.lignes.length > 0 && (
                            <span
                              className="text-xs text-gray-500 dark:text-gray-400"
                              title={`Paiement pour ${transaction.lignes.length} facture(s)`}
                            >
                              ({transaction.lignes.length})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                disabled={currentPage === pagination.totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Affichage de <span className="font-medium text-gray-900 dark:text-white">{(currentPage - 1) * pagination.limit + 1}</span> à{' '}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Math.min(currentPage * pagination.limit, pagination.total)}
                  </span>{' '}
                  sur <span className="font-medium text-gray-900 dark:text-white">{pagination.total}</span> résultats
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === pageNum
                          ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                          : 'text-gray-900 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

