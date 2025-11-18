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
        console.log('📦 [Sales Payment Detail] API Response:', data);
        console.log('📦 [Sales Payment Detail] Payment images:', data.images);
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/sales/payments')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeftIcon className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Détails du paiement</h1>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <TrashIcon className="w-5 h-5" />
            Supprimer
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro
              </label>
              <div className="text-lg font-semibold text-gray-900">{payment.numero}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de paiement
              </label>
              <div className="text-lg text-gray-900">
                {new Date(payment.datePaiement).toLocaleDateString('fr-FR')}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client
              </label>
              <div className="text-lg text-gray-900">{payment.customerNom || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mode de paiement
              </label>
              <div className="text-lg text-gray-900">{payment.modePaiement}</div>
            </div>
            {payment.reference && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Référence
                </label>
                <div className="text-lg text-gray-900">{payment.reference}</div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Montant total
              </label>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(payment.montantTotal)} TND
              </div>
            </div>
          </div>

          {/* Payment Lines */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lignes de paiement</h2>
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Facture</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant Facture</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payé Avant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant Payé</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde Restant</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payment.lignes.map((ligne, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">
                        {ligne.isPaymentOnAccount ? (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                            Sur compte
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            Facture
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {ligne.numeroFacture || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {ligne.referenceExterne || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {ligne.montantFacture ? formatCurrency(ligne.montantFacture) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {ligne.montantPayeAvant ? formatCurrency(ligne.montantPayeAvant) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        {formatCurrency(ligne.montantPaye)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {ligne.soldeRestant !== undefined ? formatCurrency(ligne.soldeRestant) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <div className="p-4 bg-gray-50 rounded-lg text-gray-900">
                {payment.notes}
              </div>
            </div>
          )}

          {/* Advance Info */}
          {payment.advanceUsed && payment.advanceUsed > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm font-medium text-green-800">
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

