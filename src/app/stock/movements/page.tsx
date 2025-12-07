'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { TruckIcon, MagnifyingGlassIcon, ArrowLeftIcon, ArrowDownTrayIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface StockMovement {
  _id: string;
  productId: string;
  productName: string;
  productSku: string;
  productUom: string;
  type: 'ENTREE' | 'SORTIE' | 'INVENTAIRE';
  qte: number;
  date: string;
  source: 'BR' | 'BL' | 'FAC' | 'INV' | 'AJUST' | 'TRANSFERT' | 'AUTRE' | 'RETOUR';
  sourceId?: string;
  referenceName?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  ENTREE: 'Entrée',
  SORTIE: 'Sortie',
  INVENTAIRE: 'Inventaire',
};

const SOURCE_LABELS: Record<string, string> = {
  BR: 'Bon de réception',
  BL: 'Bon de livraison',
  FAC: 'Facture',
  INT_FAC: 'Facture interne',
  INT_FAC_BROUILLON: 'Facture interne brouillon',
  INV: 'Inventaire',
  AJUST: 'Ajustement',
  TRANSFERT: 'Transfert',
  AUTRE: 'Autre',
  RETOUR: 'Bon de retour',
};

const TYPE_COLORS: Record<string, string> = {
  ENTREE: 'bg-green-100 text-green-800',
  SORTIE: 'bg-red-100 text-red-800',
  INVENTAIRE: 'bg-blue-100 text-blue-800',
};

export default function StockMovementsPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  
  // Filters
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchMovements();
    }
  }, [tenantId, page, typeFilter, sourceFilter, dateFrom, dateTo]);

  async function fetchMovements() {
    if (!tenantId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      if (q) params.append('q', q);
      if (typeFilter) params.append('type', typeFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const response = await fetch(`/api/stock/movements?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        const data = await response.json();
        setMovements(data.movements || []);
        setTotal(data.total || 0);
      } else {
        toast.error('Erreur lors du chargement des mouvements');
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => {
    setPage(1);
    fetchMovements();
  };

  const handleExport = () => {
    // Export all movements (without pagination) to CSV
    const params = new URLSearchParams();
    params.append('page', '1');
    params.append('limit', '10000'); // Large limit to get all
    
    if (q) params.append('q', q);
    if (typeFilter) params.append('type', typeFilter);
    if (sourceFilter) params.append('source', sourceFilter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    
    fetch(`/api/stock/movements?${params.toString()}`, {
      headers: { 'X-Tenant-Id': tenantId || '' },
    })
      .then(res => res.json())
      .then(data => {
        const csv = [
          ['Date', 'Produit', 'SKU', 'Type', 'Source', 'Quantité', 'Unité', 'Référence', 'Notes'].join(','),
          ...(data.movements || []).map((m: StockMovement) => [
            new Date(m.date).toLocaleDateString('fr-FR'),
            `"${m.productName}"`,
            m.productSku,
            TYPE_LABELS[m.type] || m.type,
            SOURCE_LABELS[m.source] || m.source,
            m.qte.toFixed(2),
            m.productUom,
            m.referenceName || m.sourceId || '-',
            `"${m.notes || ''}"`,
          ].join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `mouvements-stock-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Export réussi');
      })
      .catch(error => {
        console.error('Export error:', error);
        toast.error('Erreur lors de l\'export');
      });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleViewSource = (source: string, sourceId?: string) => {
    if (!sourceId) return;
    
    if (source === 'BR') {
      router.push(`/purchases/receptions/${sourceId}`);
    } else if (source === 'BL') {
      router.push(`/sales/deliveries/${sourceId}`);
    } else if (source === 'FAC') {
      // Check if it's a sales invoice or purchase invoice by checking the movement type
      // SORTIE = sales invoice, ENTREE = purchase invoice
      const movement = movements.find(m => m.sourceId === sourceId);
      if (movement?.type === 'SORTIE') {
        router.push(`/sales/invoices/${sourceId}`);
      } else if (movement?.type === 'ENTREE') {
        router.push(`/purchases/invoices/${sourceId}`);
      }
    } else if (source === 'INT_FAC' || source === 'INT_FAC_BROUILLON') {
      router.push(`/internal-invoices/${sourceId}`);
    } else if (source === 'RETOUR') {
      router.push(`/sales/returns/${sourceId}`);
    } else {
      toast('Source non navigable');
    }
  };

  if (!tenantId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Retour"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <TruckIcon className="w-6 h-6 sm:w-8 sm:h-8" />
              <span>Mouvements de stock</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm sm:text-base flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg text-sm sm:text-base flex items-center gap-2 ${
                showFilters
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <FunnelIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Filtres</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par produit, SKU ou référence..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm sm:text-base"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
            >
              Rechercher
            </button>
          </div>

          {showFilters && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Tous les types</option>
                    <option value="ENTREE">Entrée</option>
                    <option value="SORTIE">Sortie</option>
                    <option value="INVENTAIRE">Inventaire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => {
                      setSourceFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Toutes les sources</option>
                    <option value="BR">Bon de réception</option>
                    <option value="BL">Bon de livraison</option>
                    <option value="FAC">Facture</option>
                    <option value="INT_FAC">Facture interne</option>
                    <option value="INT_FAC_BROUILLON">Facture interne brouillon</option>
                    <option value="INV">Inventaire</option>
                    <option value="AJUST">Ajustement</option>
                    <option value="TRANSFERT">Transfert</option>
                    <option value="RETOUR">Bon de retour</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setTypeFilter('');
                    setSourceFilter('');
                    setDateFrom('');
                    setDateTo('');
                    setPage(1);
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Movements table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <TruckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun mouvement de stock</h3>
            <p className="mt-1 text-sm text-gray-500">
              {q || typeFilter || sourceFilter || dateFrom || dateTo
                ? 'Aucun résultat pour votre recherche.'
                : 'Aucun mouvement de stock enregistré.'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référence</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {movements.map((movement) => (
                      <tr key={movement._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(movement.date)}</div>
                          <div className="text-xs text-gray-500">{formatDateTime(movement.createdAt)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{movement.productName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{movement.productSku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${TYPE_COLORS[movement.type] || 'bg-gray-100 text-gray-800'}`}>
                            {TYPE_LABELS[movement.type] || movement.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{SOURCE_LABELS[movement.source] || movement.source}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className={`text-sm font-semibold ${
                            movement.type === 'ENTREE' ? 'text-green-600' : 
                            movement.type === 'SORTIE' ? 'text-red-600' : 
                            'text-blue-600'
                          }`}>
                            {movement.type === 'SORTIE' ? '-' : movement.type === 'ENTREE' ? '+' : ''}
                            {Math.abs(movement.qte).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{movement.productUom}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {movement.sourceId ? (
                            <button
                              onClick={() => handleViewSource(movement.source, movement.sourceId)}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {movement.referenceName || movement.sourceId}
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 max-w-xs truncate">{movement.notes || '—'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {movements.map((movement) => (
                  <div key={movement._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{movement.productName}</div>
                        <div className="text-xs text-gray-500 mt-1">SKU: {movement.productSku}</div>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${TYPE_COLORS[movement.type] || 'bg-gray-100 text-gray-800'}`}>
                        {TYPE_LABELS[movement.type] || movement.type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-xs text-gray-500">Date</div>
                        <div className="text-sm font-medium text-gray-900">{formatDate(movement.date)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Source</div>
                        <div className="text-sm text-gray-900">{SOURCE_LABELS[movement.source] || movement.source}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Quantité</div>
                        <div className={`text-sm font-semibold ${
                          movement.type === 'ENTREE' ? 'text-green-600' : 
                          movement.type === 'SORTIE' ? 'text-red-600' : 
                          'text-blue-600'
                        }`}>
                          {movement.type === 'SORTIE' ? '-' : movement.type === 'ENTREE' ? '+' : ''}
                          {Math.abs(movement.qte).toFixed(2)} {movement.productUom}
                        </div>
                      </div>
                      {movement.sourceId && (
                        <div>
                          <div className="text-xs text-gray-500">Référence</div>
                          <button
                            onClick={() => handleViewSource(movement.source, movement.sourceId)}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {movement.referenceName || movement.sourceId}
                          </button>
                        </div>
                      )}
                    </div>
                    {movement.notes && (
                      <div className="mt-2">
                        <div className="text-xs text-gray-500">Notes</div>
                        <div className="text-sm text-gray-700">{movement.notes}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-700">
                    Affichage de <span className="font-medium">{(page - 1) * limit + 1}</span> à{' '}
                    <span className="font-medium">{Math.min(page * limit, total)}</span> sur{' '}
                    <span className="font-medium">{total}</span> résultats
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Précédent"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-700 px-2">
                    Page {page} sur {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Suivant"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

