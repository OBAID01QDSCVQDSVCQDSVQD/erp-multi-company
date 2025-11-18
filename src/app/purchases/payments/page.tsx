'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, EyeIcon, TrashIcon, ArrowDownTrayIcon, MagnifyingGlassIcon, PhotoIcon, XMarkIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ImageGallery, { ImageItem } from '@/components/common/ImageGallery';
import ImageUploader, { ImageData } from '@/components/common/ImageUploader';

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
  images?: ImageItem[];
}

export default function PurchasePaymentsPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [paiements, setPaiements] = useState<PaiementFournisseur[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fournisseurFilter, setFournisseurFilter] = useState<string>('');
  const [selectedPaymentImages, setSelectedPaymentImages] = useState<{ paymentNumero: string; images: ImageItem[] } | null>(null);
  const [showAddImagesModal, setShowAddImagesModal] = useState(false);
  const [selectedPaymentForImages, setSelectedPaymentForImages] = useState<PaiementFournisseur | null>(null);
  const [newImages, setNewImages] = useState<ImageData[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

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

  function handleAddImages(payment: PaiementFournisseur) {
    setSelectedPaymentForImages(payment);
    setNewImages([]);
    setShowAddImagesModal(true);
  }

  async function handleSaveImages() {
    if (!selectedPaymentForImages || !tenantId) return;
    
    if (newImages.length === 0) {
      toast.error('Veuillez ajouter au moins une image');
      return;
    }

    setUploadingImages(true);
    try {
      // Get current payment to merge images
      const currentPayment = paiements.find(p => p._id === selectedPaymentForImages._id);
      const existingImages = currentPayment?.images || [];
      const allImages = [...existingImages, ...newImages];

      const response = await fetch(`/api/purchases/payments/${selectedPaymentForImages._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          images: allImages,
        }),
      });

      if (response.ok) {
        toast.success(`${newImages.length} image(s) ajoutée(s) avec succès`);
        setShowAddImagesModal(false);
        setSelectedPaymentForImages(null);
        setNewImages([]);
        fetchPayments(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de l\'ajout des images');
      }
    } catch (error) {
      console.error('Error saving images:', error);
      toast.error('Erreur lors de l\'ajout des images');
    } finally {
      setUploadingImages(false);
    }
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
                    <th className="px-4 sm:px-6 py-3 text-center text-sm font-bold text-gray-800 whitespace-nowrap">Images</th>
                    <th className="px-2 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Actions</th>
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
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center">
                        {paiement.images && paiement.images.length > 0 ? (
                          <button
                            onClick={() => setSelectedPaymentImages({ paymentNumero: paiement.numero, images: paiement.images! })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                            title={`${paiement.images.length} image(s) jointe(s)`}
                          >
                            <PhotoIcon className="w-4 h-4" />
                            <span>{paiement.images.length}</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => router.push(`/purchases/payments/${paiement._id}`)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                            title="Voir les détails"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(paiement._id)}
                            className="p-1.5 text-green-600 hover:text-green-900 hover:bg-green-50 rounded transition-colors"
                            title="Télécharger PDF"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleAddImages(paiement)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded transition-colors"
                            title="Ajouter des images"
                          >
                            <PlusCircleIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(paiement._id)}
                            className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
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

        {/* Add Images Modal */}
        {showAddImagesModal && selectedPaymentForImages && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  Ajouter des images - Paiement {selectedPaymentForImages.numero}
                </h2>
                <button
                  onClick={() => {
                    setShowAddImagesModal(false);
                    setSelectedPaymentForImages(null);
                    setNewImages([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <ImageUploader
                  images={newImages}
                  onChange={setNewImages}
                  maxImages={10}
                  maxSizeMB={5}
                  label="Images jointes (Chèque, Virement, etc.)"
                  folder="erp-uploads"
                />
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setShowAddImagesModal(false);
                    setSelectedPaymentForImages(null);
                    setNewImages([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveImages}
                  disabled={uploadingImages || newImages.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingImages ? 'Enregistrement...' : `Enregistrer ${newImages.length} image(s)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Images Modal */}
        {selectedPaymentImages && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  Images - Paiement {selectedPaymentImages.paymentNumero}
                </h2>
                <button
                  onClick={() => setSelectedPaymentImages(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <ImageGallery images={selectedPaymentImages.images} title="" />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

