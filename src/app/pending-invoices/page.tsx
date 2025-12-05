'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { DocumentTextIcon, ExclamationTriangleIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
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
            <p className="mt-4 text-gray-600">Chargement...</p>
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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <ExclamationTriangleIcon className="w-8 h-8 text-orange-500" />
              Factures en attente de paiement
            </h1>
            <p className="text-gray-600 mt-2">
              Liste des factures (internes et officielles) non payées ou partiellement payées
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total factures en attente</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalCount}</p>
                </div>
                <DocumentTextIcon className="w-12 h-12 text-orange-500 opacity-20" />
              </div>
            </div>
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Factures internes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalInternalCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatPrice(summary.totalInternalPending)}
                  </p>
                </div>
                <DocumentTextIcon className="w-12 h-12 text-blue-500 opacity-20" />
              </div>
            </div>
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Factures officielles</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalOfficialCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
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
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Montant total en attente
                </h3>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {formatPrice(summary.totalPendingAmount)}
                </p>
              </div>
              <ExclamationTriangleIcon className="w-16 h-16 text-orange-500 opacity-30" />
            </div>
          </div>
        )}

        {/* Invoices List */}
        {invoices.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune facture en attente
            </h3>
            <p className="text-gray-600">
              Toutes les factures sont payées intégralement
            </p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Projet
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total TTC
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Payé
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Restant
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            invoice.type === 'internal'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {invoice.typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{invoice.numero}</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(invoice.dateDoc)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {invoice.customerName || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {invoice.projetName || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatPrice(invoice.totalTTC, invoice.devise)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                        {formatPrice(invoice.totalPaid, invoice.devise)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-orange-600">
                          {formatPrice(invoice.remainingBalance, invoice.devise)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <Link
                          href={getInvoiceUrl(invoice)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 font-medium text-sm"
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
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


