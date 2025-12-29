'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ImageGallery, { ImageItem } from '@/components/common/ImageGallery';

interface Payment {
  _id: string;
  numero: string;
  datePaiement: string;
  customerId: string;
  customerNom?: string;
  modePaiement: string;
  reference?: string;
  montantTotal: number;
  lignes: Array<{
    factureId?: string;
    numeroFacture?: string;
    referenceExterne?: string;
    montantFacture?: number;
    montantPayeAvant?: number;
    montantPaye: number;
    soldeRestant?: number;
    isPaymentOnAccount?: boolean;
  }>;
  notes?: string;
  isPaymentOnAccount?: boolean;
  advanceUsed?: number;
  images?: ImageItem[];
}

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchPayment();
    }
  }, [tenantId, params.id]);

  async function fetchPayment() {
    if (!tenantId || !params.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/sales/payments/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setPayment(data);
      } else {
        toast.error('Paiement non trouvé');
        router.push('/sales/payments');
      }
    } catch (error) {
      console.error('Error fetching payment:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!tenantId || !payment) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/sales/payments/${payment._id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        toast.success('Paiement supprimé');
        router.push('/sales/payments');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!payment) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12 text-gray-500">Paiement non trouvé</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/sales/payments')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6 dark:text-slate-300" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Détails du paiement</h1>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 w-full sm:w-auto justify-center transition-colors"
          >
            <TrashIcon className="w-5 h-5" />
            Supprimer
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6 space-y-6">
          {/* Payment Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                Numéro
              </label>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{payment.numero}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                Date de paiement
              </label>
              <div className="text-lg text-gray-900 dark:text-slate-200">
                {new Date(payment.datePaiement).toLocaleDateString('fr-FR')}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                Client
              </label>
              <div className="text-lg text-gray-900 dark:text-slate-200">{payment.customerNom || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                Mode de paiement
              </label>
              <div className="text-lg text-gray-900 dark:text-slate-200">{payment.modePaiement}</div>
            </div>
            {payment.reference && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                  Référence
                </label>
                <div className="text-lg text-gray-900 dark:text-slate-200">{payment.reference}</div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                Montant total
              </label>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(payment.montantTotal)} TND
              </div>
            </div>
          </div>

          {/* Payment Lines */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Lignes de paiement</h2>

            {/* Desktop Table */}
            <div className="hidden sm:block border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">N° Facture</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Référence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Montant Facture</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Payé Avant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Montant Payé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Solde Restant</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {payment.lignes.map((ligne, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">
                        {ligne.isPaymentOnAccount ? (
                          <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs font-medium">
                            Sur compte
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
                            Facture
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {ligne.numeroFacture || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">
                        {ligne.referenceExterne || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {ligne.montantFacture ? formatCurrency(ligne.montantFacture) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 whitespace-nowrap">
                        {ligne.montantPayeAvant ? formatCurrency(ligne.montantPayeAvant) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                        {formatCurrency(ligne.montantPaye)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {ligne.soldeRestant !== undefined ? formatCurrency(ligne.soldeRestant) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-4 sm:hidden">
              {payment.lignes.map((ligne, index) => (
                <div key={index} className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                  <div className="flex justify-between items-start mb-3">
                    {ligne.isPaymentOnAccount ? (
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded text-xs font-medium">
                        Sur compte
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">
                        Facture
                      </span>
                    )}
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(ligne.montantPaye)} TND
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">Payé</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-slate-400">N° Facture:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ligne.numeroFacture || '-'}</span>
                    </div>
                    {ligne.referenceExterne && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Référence:</span>
                        <span className="text-gray-700 dark:text-slate-300">{ligne.referenceExterne}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Montant Facture:</span>
                      <span className="text-gray-900 dark:text-white">{ligne.montantFacture ? formatCurrency(ligne.montantFacture) : '-'}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
                      <span className="font-medium text-gray-700 dark:text-slate-300">Solde Restant:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{ligne.soldeRestant !== undefined ? formatCurrency(ligne.soldeRestant) : '-'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">
                Notes
              </label>
              <div className="p-4 bg-gray-50 dark:bg-slate-900/50 rounded-lg text-gray-900 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
                {payment.notes}
              </div>
            </div>
          )}

          {/* Advance Info */}
          {payment.advanceUsed && payment.advanceUsed > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="text-sm font-medium text-green-800 dark:text-green-300">
                Avance utilisée: {formatCurrency(payment.advanceUsed)} TND
              </div>
            </div>
          )}

          {/* Images Gallery */}
          {payment.images && payment.images.length > 0 && (
            <ImageGallery images={payment.images} title="Images jointes" />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

