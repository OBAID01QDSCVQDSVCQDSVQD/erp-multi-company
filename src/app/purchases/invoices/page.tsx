'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon, ArrowDownTrayIcon, ChevronDownIcon, PhotoIcon, XMarkIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ImageGallery, { ImageItem } from '@/components/common/ImageGallery';
import ImageUploader, { ImageData } from '@/components/common/ImageUploader';

interface PurchaseInvoice {
  _id: string;
  numero: string;
  dateFacture: string;
  referenceFournisseur?: string;
  fournisseurNom: string;
  devise: string;
  statut: 'BROUILLON' | 'VALIDEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' | 'ANNULEE';
  totaux: {
    totalHT: number;
    totalFodec?: number;
    totalTVA: number;
    totalTimbre?: number;
    totalTTC: number;
  };
  images?: ImageItem[];
}

export default function PurchaseInvoicesPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedInvoiceImages, setSelectedInvoiceImages] = useState<{ invoiceNumero: string; images: ImageItem[] } | null>(null);
  const [showAddImagesModal, setShowAddImagesModal] = useState(false);
  const [selectedInvoiceForImages, setSelectedInvoiceForImages] = useState<PurchaseInvoice | null>(null);
  const [newImages, setNewImages] = useState<ImageData[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchInvoices();
    }
  }, [tenantId, statusFilter]);

  async function fetchInvoices() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/purchases/invoices?statut=${statusFilter}`
        : '/api/purchases/invoices';
      const response = await fetch(url, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (statut: string) => {
    const styles: { [key: string]: string } = {
      BROUILLON: 'bg-gray-100 text-gray-800',
      VALIDEE: 'bg-blue-100 text-blue-800',
      PARTIELLEMENT_PAYEE: 'bg-yellow-100 text-yellow-800',
      PAYEE: 'bg-green-100 text-green-800',
      ANNULEE: 'bg-red-100 text-red-800',
    };
    const labels: { [key: string]: string } = {
      BROUILLON: 'Brouillon',
      VALIDEE: 'Validée',
      PARTIELLEMENT_PAYEE: 'Partiellement payée',
      PAYEE: 'Payée',
      ANNULEE: 'Annulée',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[statut] || styles.BROUILLON}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      inv.numero.toLowerCase().includes(search) ||
      inv.fournisseurNom.toLowerCase().includes(search) ||
      (inv.referenceFournisseur?.toLowerCase().includes(search) ?? false)
    );
  });

  async function handleDelete(invoiceId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) return;
    
    if (!tenantId) return;
    try {
      const response = await fetch(`/api/purchases/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        toast.success('Facture supprimée avec succès');
        fetchInvoices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Erreur lors de la suppression');
    }
  }

  function handleDownloadPdf(invoiceId: string) {
    window.open(`/api/purchases/invoices/${invoiceId}/pdf`, '_blank');
  }

  function handleAddImages(invoice: PurchaseInvoice) {
    setSelectedInvoiceForImages(invoice);
    setNewImages([]);
    setShowAddImagesModal(true);
  }

  async function handleSaveImages() {
    if (!selectedInvoiceForImages || !tenantId) return;
    
    if (newImages.length === 0) {
      toast.error('Veuillez ajouter au moins une image');
      return;
    }

    setUploadingImages(true);
    try {
      // Get current invoice to merge images
      const currentInvoice = invoices.find(inv => inv._id === selectedInvoiceForImages._id);
      const existingImages = currentInvoice?.images || [];
      const allImages = [...existingImages, ...newImages];

      const response = await fetch(`/api/purchases/invoices/${selectedInvoiceForImages._id}`, {
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
        setSelectedInvoiceForImages(null);
        setNewImages([]);
        fetchInvoices(); // Refresh the list
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

  async function handleStatusChange(invoiceId: string, newStatus: string) {
    if (!tenantId) return;
    
    try {
      // For status change, we need to update the invoice
      // First, check if we can change the status
      const invoice = invoices.find(inv => inv._id === invoiceId);
      if (!invoice) return;

      // Validate status transition
      if (invoice.statut === 'VALIDEE' && newStatus === 'BROUILLON') {
        toast.error('Impossible de revenir à l\'état Brouillon après validation');
        return;
      }

      if (invoice.statut === 'PAYEE' && newStatus !== 'PAYEE') {
        toast.error('Impossible de modifier une facture payée');
        return;
      }

      const response = await fetch(`/api/purchases/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          statut: newStatus,
        }),
      });

      if (response.ok) {
        toast.success('Statut modifié avec succès');
        fetchInvoices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du changement de statut');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Erreur lors du changement de statut');
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Factures d'achat</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Gérez vos factures fournisseurs</p>
            </div>
            <button
              onClick={() => router.push('/purchases/invoices/new')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <PlusIcon className="w-5 h-5" />
              Ajouter une facture
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par numéro, fournisseur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="BROUILLON">Brouillon</option>
              <option value="VALIDEE">Validée</option>
              <option value="PARTIELLEMENT_PAYEE">Partiellement payée</option>
              <option value="PAYEE">Payée</option>
              <option value="ANNULEE">Annulée</option>
            </select>
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
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">Aucune facture trouvée</p>
            <button
              onClick={() => router.push('/purchases/invoices/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Créer votre première facture
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50 border-b-2 border-blue-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800 whitespace-nowrap">N° Facture</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Date</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">N° Facture Fournisseur</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Fournisseur</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Total TTC</th>
                    <th className="px-4 sm:px-6 py-3 text-center text-sm font-bold text-gray-800 whitespace-nowrap">Images</th>
                    <th className="px-4 sm:px-6 py-3 text-center text-sm font-bold text-gray-800 whitespace-nowrap">Statut</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice._id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">{invoice.numero}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(invoice.dateFacture).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                        {invoice.referenceFournisseur || '—'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{invoice.fournisseurNom}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {invoice.totaux.totalTTC.toFixed(3)} {invoice.devise || 'TND'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center">
                        {invoice.images && invoice.images.length > 0 ? (
                          <button
                            onClick={() => setSelectedInvoiceImages({ invoiceNumero: invoice.numero, images: invoice.images! })}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                            title={`${invoice.images.length} image(s) jointe(s)`}
                          >
                            <PhotoIcon className="w-4 h-4" />
                            <span>{invoice.images.length}</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {getStatusBadge(invoice.statut)}
                          <div className="relative inline-block">
                            <select
                              value={invoice.statut}
                              onChange={(e) => handleStatusChange(invoice._id, e.target.value)}
                              className="appearance-none bg-white border border-gray-300 rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                              disabled={invoice.statut === 'PAYEE' || invoice.statut === 'ANNULEE'}
                            >
                              <option value="BROUILLON">Brouillon</option>
                              <option value="VALIDEE">Validée</option>
                              <option value="PARTIELLEMENT_PAYEE">Partiellement payée</option>
                              <option value="PAYEE">Payée</option>
                              {invoice.statut !== 'PAYEE' && (
                                <option value="ANNULEE">Annulée</option>
                              )}
                            </select>
                            <ChevronDownIcon className="absolute right-1 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => router.push(`/purchases/invoices/${invoice._id}`)}
                            className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                            title="Voir les détails"
                          >
                            <EyeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          {invoice.statut === 'BROUILLON' && (
                            <>
                              <button
                                onClick={() => router.push(`/purchases/invoices/${invoice._id}/edit`)}
                                className="p-1.5 sm:p-2 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors"
                                title="Modifier"
                              >
                                <PencilIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(invoice._id)}
                                className="p-1.5 sm:p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer"
                              >
                                <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDownloadPdf(invoice._id)}
                            className="p-1.5 sm:p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded transition-colors"
                            title="Télécharger PDF"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button
                            onClick={() => handleAddImages(invoice)}
                            className="p-1.5 sm:p-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded transition-colors"
                            title="Ajouter des images"
                          >
                            <PlusCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
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
        {showAddImagesModal && selectedInvoiceForImages && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  Ajouter des images - Facture {selectedInvoiceForImages.numero}
                </h2>
                <button
                  onClick={() => {
                    setShowAddImagesModal(false);
                    setSelectedInvoiceForImages(null);
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
                    setSelectedInvoiceForImages(null);
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
        {selectedInvoiceImages && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  Images - Facture {selectedInvoiceImages.invoiceNumero}
                </h2>
                <button
                  onClick={() => setSelectedInvoiceImages(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <ImageGallery images={selectedInvoiceImages.images} title="" />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
