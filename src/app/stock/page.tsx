'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { CubeIcon, MagnifyingGlassIcon, ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface StockItem {
  _id: string;
  sku: string;
  nom: string;
  referenceClient?: string;
  categorieCode?: string;
  uomStock: string;
  stockActuel: number;
  min?: number;
  max?: number;
  totalEntree: number;
  totalSortie: number;
  totalInventaire: number;
}

export default function StockPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Multi-warehouse
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [multiWarehouseEnabled, setMultiWarehouseEnabled] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchSettings();
      fetchWarehouses();
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) fetchStock();
  }, [tenantId, lowStockFilter, selectedWarehouseId]);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId || '' },
      });
      if (response.ok) {
        const data = await response.json();
        setMultiWarehouseEnabled(data.stock?.multiEntrepots ?? false);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }

  async function fetchWarehouses() {
    try {
      const response = await fetch('/api/stock/warehouses', {
        headers: { 'X-Tenant-Id': tenantId || '' },
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses(data);
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  }

  async function fetchStock() {
    if (!tenantId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.append('q', q);
      if (lowStockFilter) params.append('lowStock', 'true');
      if (selectedWarehouseId) params.append('warehouseId', selectedWarehouseId);

      const response = await fetch(`/api/stock?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        const data = await response.json();
        setStockItems(data.items || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Erreur lors du chargement du stock');
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = stockItems.filter((item) => {
    if (!q) return true;
    const searchLower = q.toLowerCase();
    return (
      item.nom.toLowerCase().includes(searchLower) ||
      item.sku.toLowerCase().includes(searchLower) ||
      (item.referenceClient && item.referenceClient.toLowerCase().includes(searchLower))
    );
  });

  const getStockStatus = (stock: number, min?: number) => {
    if (min === undefined || min === null) return 'normal';
    if (stock <= 0) return 'out';
    if (stock <= min) return 'low';
    return 'normal';
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    }
  };

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'out':
        return 'Rupture';
      case 'low':
        return 'Stock faible';
      default:
        return 'En stock';
    }
  };

  const getStockColor = (stockActuel: number) => {
    if (stockActuel < 0) {
      return 'text-red-600 dark:text-red-400';
    } else if (stockActuel > 0) {
      return 'text-green-600 dark:text-green-400';
    } else {
      return 'text-gray-900 dark:text-white';
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

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Retour"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <CubeIcon className="w-6 h-6 sm:w-8 sm:h-8" />
              <span>Stock</span>
            </h1>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {multiWarehouseEnabled && warehouses.length > 0 && (
            <div className="w-full sm:w-64">
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="">Tous les entrepôts</option>
                {warehouses.map((wh) => (
                  <option key={wh._id} value={wh._id}>
                    {wh.name} {wh.isDefault ? '(Défaut)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, SKU ou référence..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  fetchStock();
                }
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => setLowStockFilter(e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-500"
            />
            <span className="text-sm sm:text-base">Stock faible uniquement</span>
          </label>
          <button
            onClick={fetchStock}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
          >
            Actualiser
          </button>
        </div>

        {/* Stock list */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border dark:border-gray-700">
            <div className="hidden lg:block">
              <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-6 gap-4 px-6 py-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-24"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-16"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-20"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-12"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-12"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-16"></div>
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="px-6 py-4 grid grid-cols-6 gap-4">
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-16"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-12"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-8"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile Skeleton */}
            <div className="lg:hidden p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
            <CubeIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aucun produit en stock</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {q ? 'Aucun résultat pour votre recherche.' : 'Aucun produit n\'a de stock actuellement.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border dark:border-gray-700">
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Stock actuel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unité</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Min</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredItems.map((item) => {
                    const status = getStockStatus(item.stockActuel, item.min);
                    return (
                      <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{item.nom}</div>
                          {item.referenceClient && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">Ref: {item.referenceClient}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{item.sku}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-semibold ${getStockColor(item.stockActuel)}`}>
                            {item.stockActuel.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{item.uomStock}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{item.min !== undefined ? item.min : '—'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(status)}`}>
                            {getStockStatusLabel(status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.map((item) => {
                const status = getStockStatus(item.stockActuel, item.min);
                return (
                  <div key={item._id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.nom}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">SKU: {item.sku}</div>
                        {item.referenceClient && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">Ref: {item.referenceClient}</div>
                        )}
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatusColor(status)}`}>
                        {getStockStatusLabel(status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Stock actuel</div>
                        <div className={`text-sm font-semibold ${getStockColor(item.stockActuel)}`}>
                          {item.stockActuel.toFixed(2)} {item.uomStock}
                        </div>
                      </div>
                      {item.min !== undefined && (
                        <div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Minimum</div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{item.min} {item.uomStock}</div>
                        </div>
                      )}
                    </div>
                    {status === 'low' && item.min !== undefined && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span>Stock en dessous du minimum ({item.min})</span>
                      </div>
                    )}
                    {status === 'out' && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span>Rupture de stock</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}








