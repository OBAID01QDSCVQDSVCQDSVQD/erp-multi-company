'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ExclamationTriangleIcon, MagnifyingGlassIcon, ArrowLeftIcon, ArrowDownTrayIcon, FunnelIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface StockAlert {
  _id: string;
  productId: string;
  sku: string;
  nom: string;
  referenceClient?: string;
  categorieCode?: string;
  uomStock: string;
  stockActuel: number;
  min: number;
  max?: number;
  status: 'low' | 'out';
  diff: number;
  leadTimeJours?: number;
  prixAchatRef?: number;
  devise?: string;
}

interface AlertStats {
  total: number;
  low: number;
  out: number;
}

export default function StockAlertsPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [stats, setStats] = useState<AlertStats>({ total: 0, low: 0, out: 0 });
  
  // Filters
  const [q, setQ] = useState('');
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchAlerts();
    }
  }, [tenantId, page, alertTypeFilter]);

  async function fetchAlerts() {
    if (!tenantId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      if (q) params.append('q', q);
      if (alertTypeFilter) params.append('alertType', alertTypeFilter);
      
      const response = await fetch(`/api/stock/alerts?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
        setTotal(data.total || 0);
        setStats(data.stats || { total: 0, low: 0, out: 0 });
      } else {
        toast.error('Erreur lors du chargement des alertes');
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = () => {
    setPage(1);
    fetchAlerts();
  };

  const handleExport = () => {
    // Export all alerts (without pagination) to CSV
    const params = new URLSearchParams();
    params.append('page', '1');
    params.append('limit', '10000'); // Large limit to get all
    
    if (q) params.append('q', q);
    if (alertTypeFilter) params.append('alertType', alertTypeFilter);
    
    fetch(`/api/stock/alerts?${params.toString()}`, {
      headers: { 'X-Tenant-Id': tenantId || '' },
    })
      .then(res => res.json())
      .then(data => {
        const csv = [
          ['Produit', 'SKU', 'Stock actuel', 'Minimum', 'Différence', 'Statut', 'Unité', 'Prix achat', 'Référence'].join(','),
          ...(data.alerts || []).map((a: StockAlert) => [
            `"${a.nom}"`,
            a.sku,
            a.stockActuel.toFixed(2),
            a.min.toFixed(2),
            a.diff.toFixed(2),
            a.status === 'out' ? 'Rupture' : 'Stock faible',
            a.uomStock,
            a.prixAchatRef ? `${a.prixAchatRef} ${a.devise || 'TND'}` : '-',
            a.referenceClient || '-',
          ].join(','))
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `alertes-stock-${new Date().toISOString().split('T')[0]}.csv`);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'out':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'out':
        return 'Rupture de stock';
      case 'low':
        return 'Stock faible';
      default:
        return 'Normal';
    }
  };

  const formatCurrency = (amount: number, devise: string = 'TND') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: devise,
    }).format(amount);
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
              <ExclamationTriangleIcon className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
              <span>Alertes stock minimum</span>
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ruptures de stock</p>
                <p className="text-2xl font-bold text-red-600">{stats.out}</p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock faible</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.low}</p>
              </div>
              <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total alertes</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-blue-500" />
            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type d'alerte</label>
                  <select
                    value={alertTypeFilter}
                    onChange={(e) => {
                      setAlertTypeFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Tous les types</option>
                    <option value="out">Rupture de stock</option>
                    <option value="low">Stock faible</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setAlertTypeFilter('');
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

        {/* Alerts table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune alerte de stock</h3>
            <p className="mt-1 text-sm text-gray-500">
              {q || alertTypeFilter
                ? 'Aucun résultat pour votre recherche.'
                : 'Tous les produits ont un stock suffisant.'}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock actuel</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Minimum</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Différence</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prix achat</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {alerts.map((alert) => (
                      <tr key={alert._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{alert.nom}</div>
                          {alert.referenceClient && (
                            <div className="text-xs text-gray-500">Ref: {alert.referenceClient}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{alert.sku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className={`text-sm font-semibold ${
                            alert.status === 'out' ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {alert.stockActuel.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900">{alert.min.toFixed(2)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className={`text-sm font-semibold ${
                            alert.diff < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {alert.diff > 0 ? '+' : ''}{alert.diff.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{alert.uomStock}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(alert.status)}`}>
                            {getStatusLabel(alert.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900">
                            {alert.prixAchatRef ? formatCurrency(alert.prixAchatRef, alert.devise) : '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {alerts.map((alert) => (
                  <div key={alert._id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{alert.nom}</div>
                        <div className="text-xs text-gray-500 mt-1">SKU: {alert.sku}</div>
                        {alert.referenceClient && (
                          <div className="text-xs text-gray-500">Ref: {alert.referenceClient}</div>
                        )}
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(alert.status)}`}>
                        {getStatusLabel(alert.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-xs text-gray-500">Stock actuel</div>
                        <div className={`text-sm font-semibold ${
                          alert.status === 'out' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {alert.stockActuel.toFixed(2)} {alert.uomStock}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Minimum</div>
                        <div className="text-sm font-medium text-gray-900">{alert.min.toFixed(2)} {alert.uomStock}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Différence</div>
                        <div className={`text-sm font-semibold ${
                          alert.diff < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {alert.diff > 0 ? '+' : ''}{alert.diff.toFixed(2)} {alert.uomStock}
                        </div>
                      </div>
                      {alert.prixAchatRef && (
                        <div>
                          <div className="text-xs text-gray-500">Prix achat</div>
                          <div className="text-sm text-gray-900">{formatCurrency(alert.prixAchatRef, alert.devise)}</div>
                        </div>
                      )}
                    </div>
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

