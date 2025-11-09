'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, EyeIcon, TrashIcon, ArrowDownTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
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

export default function PurchasePaymentsPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [paiements, setPaiements] = useState<PaiementFournisseur[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fournisseurFilter, setFournisseurFilter] = useState<string>('');

  useEffect(() => {
    if (tenantId) {
      fetchPayments();
    }
  }, [tenantId, fournisseurFilter]);

  async function fetchPayments() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fournisseurFilter) params.append('fournisseurId', fournisseurFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/purchases/payments?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setPaiements(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Erreur lors du chargement des paiements');
    } finally {
      setLoading(false);
    }
  }

  const filteredPayments = paiements.filter((p) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      p.numero.toLowerCase().includes(search) ||
      p.fournisseurNom.toLowerCase().includes(search) ||
      (p.reference?.toLowerCase().includes(search) ?? false)
    );
  });

  async function handleDelete(paymentId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return;

    if (!tenantId) return;
    try {
      const response = await fetch(`/api/purchases/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        toast.success('Paiement supprimé avec succès');
        fetchPayments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Erreur lors de la suppression');
    }
  }

  function handleDownloadPdf(paymentId: string) {
    window.open(`/api/purchases/payments/${paymentId}/pdf`, '_blank');
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paiements Fournisseurs</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Gérez les paiements de vos fournisseurs</p>
            </div>
            <button
              onClick={() => router.push('/purchases/payments/new')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              Nouveau paiement
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par numéro, fournisseur, référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">Aucun paiement trouvé</p>
            <button
              onClick={() => router.push('/purchases/payments/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Créer votre premier paiement
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50 border-b-2 border-blue-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800 whitespace-nowrap">N° Paiement</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Date</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Fournisseur</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">N° Facture Fournisseur</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Mode de paiement</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Référence</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Montant</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((paiement) => (
                    <tr key={paiement._id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">{paiement.numero}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{paiement.fournisseurNom}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                        {paiement.lignes && paiement.lignes.length > 0
                          ? paiement.lignes
                              .map((ligne) => ligne.referenceFournisseur)
                              .filter((ref) => ref && ref.trim() !== '') // Only keep non-empty references
                              .filter((ref, index, self) => self.indexOf(ref) === index) // Remove duplicates
                              .join(', ') || '—'
                          : '—'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{paiement.modePaiement}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{paiement.reference || '—'}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {paiement.montantTotal.toFixed(3)} DT
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => router.push(`/purchases/payments/${paiement._id}`)}
                            className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                            title="Voir les détails"
                          >
                            <EyeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(paiement._id)}
                            className="p-1.5 sm:p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded transition-colors"
                            title="Télécharger PDF"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(paiement._id)}
                            className="p-1.5 sm:p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </div>
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

