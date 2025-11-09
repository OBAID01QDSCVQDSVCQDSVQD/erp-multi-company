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
  isPaymentOnAccount?: boolean;
  lignes?: Array<{
    factureNumero: string;
    montantPaye: number;
  }>;
}

interface Summary {
  totalFactures: number;
  totalPaiements: number;
  totalAvoirs: number;
  soldeActuel: number;
  facturesOuvertes: number;
  soldeAvanceDisponible?: number;
}

export default function SupplierDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<any>(null);
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
    if (tenantId && supplierId) {
      setCurrentPage(1); // Reset to first page when filters change
    }
  }, [tenantId, supplierId, dateDebut, dateFin, typeFilter, searchTerm]);

  useEffect(() => {
    if (tenantId && supplierId) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, supplierId, dateDebut, dateFin, typeFilter, searchTerm, currentPage]);

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

      const response = await fetch(`/api/suppliers/${supplierId}/transactions?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        const data = await response.json();
        setSupplier(data.supplier);
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

      const response = await fetch(`/api/suppliers/${supplierId}/transactions?${params.toString()}`, {
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
      csvLines.push(`"Détails des transactions - ${supplier?.nom || 'Fournisseur'}"`);
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
      const headers = ['Type', 'N°', 'Référence', 'Date', 'Échéance', 'Montant (TND)', 'Payé (TND)', 'Reste (TND)', 'Statut', 'Mode Paiement', 'Notes'];
      csvLines.push(headers.map(h => `"${h}"`).join(','));

      // Table rows
      allTransactions.forEach(t => {
        const row = [
          getTransactionTypeLabel(t.type),
          t.numero,
          t.reference || '',
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
      const fileName = `transactions_${(supplier?.nom || 'fournisseur').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
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
    if (transaction.documentType === 'PurchaseInvoice') {
      router.push(`/purchases/invoices/${transaction.id}`);
    } else if (transaction.documentType === 'PaiementFournisseur') {
      router.push(`/purchases/payments/${transaction.id}`);
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
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Détails des transactions</h1>
              {supplier && (
                <p className="text-gray-600">{supplier.nom}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Exporter CSV
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-gray-600 mb-1">Total Factures</div>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(summary.totalFactures)}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-gray-600 mb-1">Total Paiements</div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(summary.totalPaiements)}
              </div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="text-sm text-gray-600 mb-1">Total Avoirs</div>
              <div className="text-2xl font-bold text-orange-700">
                {formatCurrency(summary.totalAvoirs)}
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm text-gray-600 mb-1">Factures Ouvertes</div>
              <div className="text-2xl font-bold text-red-700">
                {formatCurrency(summary.facturesOuvertes)}
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-sm text-gray-600 mb-1">Solde avance disponible</div>
              <div className={`text-2xl font-bold ${(summary.soldeAvanceDisponible ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {(summary.soldeAvanceDisponible ?? 0) >= 0 && '+'}
                {formatCurrency(Math.abs(summary.soldeAvanceDisponible ?? 0))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          {/* Type Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setTypeFilter('facture')}
                className={`${
                  typeFilter === 'facture'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2`}
              >
                <DocumentTextIcon className="w-5 h-5" />
                Factures
              </button>
              <button
                onClick={() => setTypeFilter('paiement')}
                className={`${
                  typeFilter === 'paiement'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par numéro, référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            {/* Date Début */}
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                placeholder="Date début"
              />
            </div>

            {/* Date Fin */}
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                placeholder="Date fin"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : error ? (
          <div className="text-red-600 py-4">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucune transaction trouvée
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Référence
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Échéance
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payé
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reste
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={`${transaction.type}-${transaction.id}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {transaction.type === 'paiement' && transaction.isPaymentOnAccount 
                            ? 'Paiement sur compte' 
                            : transaction.reference || transaction.numero || '-'}
                        </div>
                        {transaction.type === 'paiement' && transaction.isPaymentOnAccount && (
                          <div className="text-xs text-purple-600 mt-1">Sur compte</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{formatDate(transaction.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{formatDate(transaction.dateEcheance)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${
                          transaction.type === 'avoir' || transaction.type === 'paiement' 
                            ? 'text-green-600' 
                            : 'text-gray-900'
                        }`}>
                          {transaction.type === 'avoir' || transaction.type === 'paiement' ? '-' : ''}
                          {formatCurrency(transaction.montant)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-600">
                          {formatCurrency(transaction.montantPaye)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-medium ${
                          transaction.soldeRestant > 0 
                            ? 'text-red-600' 
                            : transaction.soldeRestant < 0 
                            ? 'text-green-600' 
                            : 'text-gray-600'
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
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                            title="Voir le document"
                          >
                            <EyeIcon className="w-4 h-4 mr-1" />
                            Voir
                          </button>
                          {transaction.type === 'paiement' && transaction.lignes && transaction.lignes.length > 0 && (
                            <span
                              className="text-xs text-gray-500"
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
          <div className="flex items-center justify-between bg-white px-4 py-3 border-t border-gray-200 sm:px-6 rounded-lg">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                disabled={currentPage === pagination.totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{(currentPage - 1) * pagination.limit + 1}</span> à{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * pagination.limit, pagination.total)}
                  </span>{' '}
                  sur <span className="font-medium">{pagination.total}</span> résultats
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                          currentPage === pageNum
                            ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                    disabled={currentPage === pagination.totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
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

