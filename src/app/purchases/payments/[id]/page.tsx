'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface PaiementFournisseur {
  _id: string;
  numero: string;
  datePaiement: string;
  fournisseurId: string;
  fournisseurNom: string;
  modePaiement: string;
  reference?: string;
  montantTotal: number;
  lignes: Array<{
    factureId: string;
    numeroFacture: string;
    referenceFournisseur?: string;
    montantFacture: number;
    montantPayeAvant: number;
    montantPaye: number;
    soldeRestant: number;
  }>;
  notes?: string;
}

export default function PurchasePaymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [paiement, setPaiement] = useState<PaiementFournisseur | null>(null);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchPayment();
    }
  }, [tenantId, params.id]);

  async function fetchPayment() {
    if (!tenantId || !params.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/purchases/payments/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setPaiement(data);
      } else {
        toast.error('Paiement non trouvé');
        router.push('/purchases/payments');
      }
    } catch (error) {
      console.error('Error fetching payment:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ? Cette action est irréversible.')) return;
    if (!tenantId || !paiement) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/purchases/payments/${paiement._id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        toast.success('Paiement supprimé avec succès');
        router.push('/purchases/payments');
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

  function handleDownloadPdf() {
    if (!paiement) return;
    window.open(`/api/purchases/payments/${paiement._id}/pdf`, '_blank');
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!paiement) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6">
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Paiement non trouvé</p>
            <button
              onClick={() => router.push('/purchases/payments')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retour à la liste
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <button
          onClick={() => router.push('/purchases/payments')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span className="text-sm">Retour</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paiement Fournisseur</h1>
            <span className="text-lg sm:text-xl font-bold text-blue-600">{paiement.numero}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Télécharger PDF
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <TrashIcon className="w-5 h-5" />
              {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations du paiement</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Date de paiement</label>
                <p className="text-sm text-gray-900 mt-1">
                  {new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Fournisseur</label>
                <p className="text-sm text-gray-900 mt-1">{paiement.fournisseurNom}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Mode de paiement</label>
                <p className="text-sm text-gray-900 mt-1">{paiement.modePaiement}</p>
              </div>
              {paiement.reference && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Référence</label>
                  <p className="text-sm text-gray-900 mt-1">{paiement.reference}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Montant total</label>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {paiement.montantTotal.toFixed(3)} DT
                </p>
              </div>
            </div>
            {paiement.notes && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-500">Notes</label>
                <p className="text-sm text-gray-900 mt-1">{paiement.notes}</p>
              </div>
            )}
          </div>

          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Factures réglées</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Facture Fournisseur</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant Facture</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <span title="المبلغ المدفوع مسبقاً في دفعات سابقة قبل هذه الدفعة">Déjà Payé</span>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant Payé</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Solde Restant</th>
                      </tr>
                    </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paiement.lignes.map((ligne, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">
                        {ligne.referenceFournisseur || ligne.numeroFacture || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {ligne.montantFacture.toFixed(3)} DT
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">
                        {ligne.montantPayeAvant.toFixed(3)} DT
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                        {ligne.montantPaye.toFixed(3)} DT
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {ligne.soldeRestant.toFixed(3)} DT
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      Total du paiement:
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                      {paiement.montantTotal.toFixed(3)} DT
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

