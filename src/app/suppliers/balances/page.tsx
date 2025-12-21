'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { MagnifyingGlassIcon, EyeIcon, CalendarIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface SupplierBalance {
  fournisseurId: string;
  fournisseurNom: string;
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
    dateFacture: string;
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

export default function SupplierBalancesPage() {
  const { tenantId } = useTenantId();
  const router = useRouter();
  const [balances, setBalances] = useState<SupplierBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (tenantId) {
      fetchBalances();
    }
  }, [tenantId, referenceDate, selectedSupplier]);

  const fetchBalances = async () => {
    try {
      setLoading(true);
      setError('');
      if (!tenantId) return;

      const params = new URLSearchParams();
      params.append('date', referenceDate);
      if (selectedSupplier) {
        params.append('fournisseurId', selectedSupplier);
      }

      const response = await fetch(`/api/suppliers/balances?${params.toString()}`, {
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
    balance.fournisseurNom.toLowerCase().includes(searchTerm.toLowerCase())
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
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case '31-60':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case '61-90':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case '>90':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
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
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Retour à la page précédente"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Soldes fournisseurs</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un fournisseur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Reference Date */}
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Supplier Filter - will be populated from API if needed */}
            <div>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tous les fournisseurs</option>
                {/* Options will be populated dynamically */}
              </select>
            </div>
          </div>

          {/* Total */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total des soldes dus:</span>
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Balances Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Chargement...</div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400 py-4">{error}</div>
        ) : filteredBalances.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {searchTerm
              ? 'Aucun fournisseur trouvé avec ce terme de recherche'
              : 'Aucun fournisseur trouvé'}
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-4">
              {filteredBalances.map((balance) => (
                <div key={balance.fournisseurId} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white capitalize">{balance.fournisseurNom}</h3>
                      {balance.netAdvanceBalance !== undefined && balance.netAdvanceBalance !== 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avance: {formatCurrency(balance.netAdvanceBalance)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-lg font-bold ${balance.soldeDu > 0 ? 'text-red-600 dark:text-red-400' : balance.soldeDu < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {balance.soldeDu > 0 && '-'}{balance.soldeDu < 0 && '+'}{formatCurrency(Math.abs(balance.soldeDu))}
                      </span>
                      {balance.netAdvanceBalance === 0 && balance.soldeDu < 0 && balance.aging['0-30'] === 0 && balance.aging['31-60'] === 0 && balance.aging['61-90'] === 0 && balance.aging['>90'] === 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400 mt-1">(Avoir)</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">0-30 jours</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(balance.aging['0-30'])}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">31-60 jours</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(balance.aging['31-60'])}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">61-90 jours</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(balance.aging['61-90'])}</span>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                      <span className="text-gray-500 dark:text-gray-400 block text-xs mb-1">&gt;90 jours</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(balance.aging['>90'])}</span>
                    </div>
                  </div>
                  <button onClick={() => router.push(`/suppliers/${balance.fournisseurId}/details`)} className="w-full flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition-colors">
                    <EyeIcon className="w-5 h-5 mr-2" /> Voir détails
                  </button>
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Fournisseur
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
                      <tr key={balance.fournisseurId} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {balance.fournisseurNom}
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
                          <div className="text-sm text-gray-900 dark:text-gray-300">
                            {formatCurrency(balance.aging['0-30'])}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900 dark:text-gray-300">
                            {formatCurrency(balance.aging['31-60'])}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900 dark:text-gray-300">
                            {formatCurrency(balance.aging['61-90'])}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900 dark:text-gray-300">
                            {formatCurrency(balance.aging['>90'])}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => router.push(`/suppliers/${balance.fournisseurId}/details`)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition-colors"
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
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
