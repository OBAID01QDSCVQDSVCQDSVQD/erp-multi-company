'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { MagnifyingGlassIcon, EyeIcon, CalendarIcon } from '@heroicons/react/24/outline';
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
        return 'bg-green-100 text-green-800';
      case '31-60':
        return 'bg-yellow-100 text-yellow-800';
      case '61-90':
        return 'bg-orange-100 text-orange-800';
      case '>90':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Soldes clients</h1>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            {/* Reference Date */}
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            {/* Customer Filter - will be populated from API if needed */}
            <div>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Tous les clients</option>
                {/* Options will be populated dynamically */}
              </select>
            </div>
          </div>

          {/* Total */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total des soldes dus:</span>
              <span className="text-2xl font-bold text-red-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Balances Table */}
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : error ? (
          <div className="text-red-600 py-4">{error}</div>
        ) : filteredBalances.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchTerm
              ? 'Aucun client trouvé avec ce terme de recherche'
              : 'Aucun client trouvé'}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Solde
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      0-30 jours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      31-60 jours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      61-90 jours
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      &gt;90 jours
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBalances.map((balance) => (
                    <tr key={balance.customerId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {balance.customerNom}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end">
                          <div
                            className={`text-sm font-bold ${
                              balance.soldeDu > 0
                                ? 'text-red-600'
                                : balance.soldeDu < 0
                                ? 'text-green-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {balance.soldeDu > 0 && '-'}
                            {balance.soldeDu < 0 && '+'}
                            {formatCurrency(Math.abs(balance.soldeDu))}
                          </div>
                          {balance.netAdvanceBalance !== undefined && balance.netAdvanceBalance !== 0 && (
                            <span className="text-xs text-gray-500 mt-1">
                              (Solde avance disponible: {formatCurrency(balance.netAdvanceBalance)})
                            </span>
                          )}
                          {balance.netAdvanceBalance === 0 && balance.soldeDu < 0 && balance.aging['0-30'] === 0 && balance.aging['31-60'] === 0 && balance.aging['61-90'] === 0 && balance.aging['>90'] === 0 && (
                            <span className="text-xs text-green-600 mt-1">
                              (Avoir)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(balance.aging['0-30'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(balance.aging['31-60'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(balance.aging['61-90'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(balance.aging['>90'])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => router.push(`/customers/${balance.customerId}/details`)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
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
        )}
      </div>
    </DashboardLayout>
  );
}

