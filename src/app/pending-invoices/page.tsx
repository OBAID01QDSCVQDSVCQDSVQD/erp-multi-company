'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { DocumentTextIcon, ExclamationTriangleIcon, ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface PendingInvoice {
  _id: string;
  numero: string;
  dateDoc: string;
  type: 'internal' | 'official';
  typeLabel: string;
  customerId?: {
    _id: string;
    raisonSociale?: string;
    nom?: string;
    prenom?: string;
  };
  customerName?: string;
  projetId?: {
    _id: string;
    name: string;
    projectNumber?: string;
  };
  projetName?: string;
  totalTTC: number;
  remainingBalance: number;
  totalPaid: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  devise?: string;
}

interface Summary {
  totalCount: number;
  totalInternalCount: number;
  totalOfficialCount: number;
  totalPendingAmount: number;
  totalInternalPending: number;
  totalOfficialPending: number;
}

export default function PendingInvoicesPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      fetchPendingInvoices();
    }
  }, [tenantId]);

  const fetchPendingInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pending-invoices', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        const invoicesList = (data.invoices || []).map((inv: any) => {
          let customerName = 'N/A';
          if (inv.customerId) {
            if (typeof inv.customerId === 'object' && inv.customerId !== null) {
              customerName = inv.customerId.raisonSociale ||
                `${inv.customerId.nom || ''} ${inv.customerId.prenom || ''}`.trim() ||
                'N/A';
            }
          }

          let projetName = '';
          if (inv.projetId) {
            if (typeof inv.projetId === 'object' && inv.projetId !== null) {
              projetName = inv.projetId.name || '';
            }
          }

          return {
            ...inv,
            customerName,
            projetName,
          };
        });
        setInvoices(invoicesList);
        setSummary(data.summary || null);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      console.error('Error fetching pending invoices:', error);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string = 'TND') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const getInvoiceUrl = (invoice: PendingInvoice) => {
    if (invoice.type === 'internal') {
      return `/internal-invoices/${invoice._id}`;
    }
    return `/sales/invoices/${invoice._id}`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              title="Retour à la page précédente"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <ExclamationTriangleIcon className="w-8 h-8 text-orange-500" />
                Factures en attente de paiement
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Liste des factures (internes et officielles) non payées ou partiellement payées
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total factures en attente</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.totalCount}</p>
                </div>
                <DocumentTextIcon className="w-12 h-12 text-orange-500 opacity-20" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Factures internes</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.totalInternalCount}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatPrice(summary.totalInternalPending)}
                  </p>
                </div>
                <DocumentTextIcon className="w-12 h-12 text-blue-500 opacity-20" />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Factures officielles</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.totalOfficialCount}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatPrice(summary.totalOfficialPending)}
                  </p>
                </div>
                <DocumentTextIcon className="w-12 h-12 text-green-500 opacity-20" />
              </div>
            </div>
          </div>
        )}

        {/* Total Pending Amount Banner */}
        {summary && summary.totalPendingAmount > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-l-4 border-orange-500 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Montant total en attente
                </h3>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">
                  {formatPrice(summary.totalPendingAmount)}
                </p>
              </div>
              <ExclamationTriangleIcon className="w-16 h-16 text-orange-500 opacity-30" />
            </div>
          </div>
        )}

        {/* Invoices List */}
        {invoices.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-2xl">
            <DocumentTextIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Aucune facture en attente
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Toutes les factures sont payées intégralement
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Projet
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Total TTC
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Payé
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Restant
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {invoices.map((invoice) => (
                    <tr key={invoice._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${invoice.type === 'internal'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            }`}
                        >
                          {invoice.typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 dark:text-white">{invoice.numero}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(invoice.dateDoc)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {invoice.customerName || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {invoice.projetName || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                        {formatPrice(invoice.totalTTC, invoice.devise)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-300">
                        {formatPrice(invoice.totalPaid, invoice.devise)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                          {formatPrice(invoice.remainingBalance, invoice.devise)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <Link
                          href={getInvoiceUrl(invoice)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
                        >
                          Voir
                          <ArrowRightIcon className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {invoices.map((invoice) => (
                <div key={invoice._id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${invoice.type === 'internal'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          }`}>
                          {invoice.typeLabel}
                        </span>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{invoice.numero}</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(invoice.dateDoc)}
                      </p>
                    </div>
                    <Link
                      href={getInvoiceUrl(invoice)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <ArrowRightIcon className="w-5 h-5" />
                    </Link>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Client:</span>
                      <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{invoice.customerName || 'N/A'}</span>
                    </div>
                    {invoice.projetName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Projet:</span>
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{invoice.projetName}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t dark:border-gray-700 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Total TTC</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatPrice(invoice.totalTTC, invoice.devise)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Déjà payé</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {formatPrice(invoice.totalPaid, invoice.devise)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-orange-50 dark:bg-orange-900/10 p-2 rounded text-sm font-semibold">
                      <span className="text-orange-700 dark:text-orange-400">Reste à payer</span>
                      <span className="text-orange-700 dark:text-orange-400">
                        {formatPrice(invoice.remainingBalance, invoice.devise)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout >
  );
}






