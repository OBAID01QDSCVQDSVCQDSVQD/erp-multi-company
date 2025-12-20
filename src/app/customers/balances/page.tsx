'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { MagnifyingGlassIcon, EyeIcon, CalendarIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface CustomerBalance {
  customerId: string;
  customerNom: string;
  soldeDu: number;
  aging: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '>90': number;
  };
  factures: Array<{
    _id: string;
    numero: string;
    dateDoc: string;
    dateEcheance: string | null;
    montantTotal: number;
    montantPaye: number;
    soldeRestant: number;
    statut: string;
    aging: string;
    joursEchus: number;
  }>;
  netAdvanceBalance?: number; // Solde avance disponible
}

export default function CustomerBalancesPage() {
  const { tenantId } = useTenantId();
  const router = useRouter();
  const [balances, setBalances] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (tenantId) {
      fetchBalances();
    }
  }, [tenantId, referenceDate, selectedCustomer]);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      setError('');
      if (!tenantId) return;

      const params = new URLSearchParams();
      params.append('date', referenceDate);
      if (selectedCustomer) {
        params.append('customerId', selectedCustomer);
      }

      const response = await fetch(`/api/customers/balances?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        const data = await response.json();
        setBalances(data.balances || []);
        setTotal(data.total || 0);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erreur lors du chargement des soldes');
      }
    } catch (err) {
      setError('Erreur de connexion');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBalances = balances.filter((balance) =>
    balance.customerNom.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const getAgingColor = (bucket: string) => {
    switch (bucket) {
      case '0-30':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case '31-60':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case '61-90':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case '>90':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="Retour à la page précédente"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Soldes clients</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Reference Date */}
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Customer Filter - will be populated from API if needed */}
            <div>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tous les clients</option>
                {/* Options will be populated dynamically */}
              </select>
            </div>
          </div>

          {/* Total */}
          <div className="pt-4 border-t dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total des soldes dus:</span>
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Balances Table */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    {[...Array(7)].map((_, i) => (
                      <th key={i} className="px-6 py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(7)].map((_, j) => (
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
          <div className="text-red-600 dark:text-red-400 py-4">{error}</div>
        ) : filteredBalances.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {searchTerm
              ? 'Aucun client trouvé avec ce terme de recherche'
              : 'Aucun client trouvé'}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Solde
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      0-30 jours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      31-60 jours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      61-90 jours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      &gt;90 jours
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBalances.map((balance) => (
                    <tr key={balance.customerId} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {balance.customerNom}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end">
                          <div
                            className={`text-sm font-bold ${balance.soldeDu > 0
                              ? 'text-red-600 dark:text-red-400'
                              : balance.soldeDu < 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-600 dark:text-gray-400'
                              }`}
                          >
                            {balance.soldeDu > 0 && '-'}
                            {balance.soldeDu < 0 && '+'}
                            {formatCurrency(Math.abs(balance.soldeDu))}
                          </div>
                          {balance.netAdvanceBalance !== undefined && balance.netAdvanceBalance !== 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              (Solde avance disponible: {formatCurrency(balance.netAdvanceBalance)})
                            </span>
                          )}
                          {balance.netAdvanceBalance === 0 && balance.soldeDu < 0 && balance.aging['0-30'] === 0 && balance.aging['31-60'] === 0 && balance.aging['61-90'] === 0 && balance.aging['>90'] === 0 && (
                            <span className="text-xs text-green-600 dark:text-green-400 mt-1">
                              (Avoir)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCurrency(balance.aging['0-30'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCurrency(balance.aging['31-60'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCurrency(balance.aging['61-90'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCurrency(balance.aging['>90'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => router.push(`/customers/${balance.customerId}/details`)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        >
                          <EyeIcon className="w-4 h-4 mr-1" />
                          Voir détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {filteredBalances.map((balance) => (
                <div key={balance.customerId} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{balance.customerNom}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Solde dû:</span>
                        <span className={`text-sm font-bold ${balance.soldeDu > 0
                          ? 'text-red-600 dark:text-red-400'
                          : balance.soldeDu < 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-600 dark:text-gray-400'
                          }`}>
                          {balance.soldeDu > 0 && '-'}
                          {balance.soldeDu < 0 && '+'}
                          {formatCurrency(Math.abs(balance.soldeDu))}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/customers/${balance.customerId}/details`)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Voir détails"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Aging breakdown */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-t dark:border-gray-700 pt-3">
                    <div className="flex flex-col">
                      <span className="text-gray-500 dark:text-gray-400">0-30 jours</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(balance.aging['0-30'])}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 dark:text-gray-400">31-60 jours</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(balance.aging['31-60'])}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 dark:text-gray-400">61-90 jours</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(balance.aging['61-90'])}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-500 dark:text-gray-400">&gt;90 jours</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(balance.aging['>90'])}</span>
                    </div>
                  </div>

                  {balance.netAdvanceBalance !== undefined && balance.netAdvanceBalance !== 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-2 rounded text-xs text-blue-700 dark:text-blue-300">
                      Solde avance disponible: {formatCurrency(balance.netAdvanceBalance)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

