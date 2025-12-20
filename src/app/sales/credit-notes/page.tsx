'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface CreditNote {
  _id: string;
  numero: string;
  referenceExterne?: string;
  customerId?: string;
  dateDoc: string;
  totalTTC: number;
  devise?: string;
  statut?: string;
  notes?: string;
  linkedDocuments?: string[];
}

interface InvoiceLookupState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: any;
  error?: string;
}

const formatPrice = (value: number, currency: string = 'TND') =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
  }).format(value || 0);

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '-';

export default function CreditNotesPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    reason: '',
  });
  const [invoiceLookup, setInvoiceLookup] = useState<InvoiceLookupState>({
    status: 'idle',
  });
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<any[]>([]);
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false);
  const [invoiceSearchError, setInvoiceSearchError] = useState<string | null>(null);
  const [invoiceDropdownPosition, setInvoiceDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (tenantId) {
      fetchCreditNotes();
    }
  }, [tenantId]);

  const fetchCreditNotes = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const response = await fetch('/api/sales/credit-notes', {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCreditNotes(data.items || []);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Impossible de charger les avoirs');
      }
    } catch (error) {
      console.error('Error fetching credit notes:', error);
      toast.error('Erreur lors du chargement des avoirs');
    } finally {
      setLoading(false);
    }
  };

  const filteredCreditNotes = useMemo(() => {
    if (!q.trim()) return creditNotes;
    const query = q.toLowerCase();
    return creditNotes.filter(
      (note) =>
        note.numero?.toLowerCase().includes(query) ||
        note.referenceExterne?.toLowerCase().includes(query)
    );
  }, [creditNotes, q]);

  const handleOpenModal = () => {
    setFormData({ invoiceNumber: '', reason: '' });
    setInvoiceLookup({ status: 'idle' });
    setInvoiceSearchResults([]);
    setInvoiceSearchError(null);
    setShowModal(true);
  };

  useEffect(() => {
    if (!showModal) return;

    if (
      invoiceLookup.status === 'success' &&
      invoiceLookup.data?.numero &&
      formData.invoiceNumber.trim() !== invoiceLookup.data.numero
    ) {
      setInvoiceLookup({ status: 'idle' });
    }
  }, [formData.invoiceNumber, invoiceLookup, showModal]);

  useEffect(() => {
    if (!showModal) return;
    const query = formData.invoiceNumber.trim();
    const isCurrentSelection =
      invoiceLookup.status === 'success' &&
      invoiceLookup.data?.numero &&
      invoiceLookup.data.numero === query;

    if (!tenantId) return;

    // إذا لم يُكتب شيء، نعرض آخر الفواتير
    if (!formData.invoiceNumber.trim()) {
      setInvoiceSearchLoading(true);
      setInvoiceSearchError(null);

      const controller = new AbortController();
      const timeout = setTimeout(async () => {
        try {
          const response = await fetch(`/api/sales/invoices/by-number`, {
            headers: { 'X-Tenant-Id': tenantId },
            signal: controller.signal,
          });

          if (response.ok) {
            const data = await response.json();
            setInvoiceSearchResults(data.items || []);
          } else {
            const error = await response.json();
            setInvoiceSearchError(error.error || 'Erreur lors de la recherche');
            setInvoiceSearchResults([]);
          }
        } catch (error) {
          if ((error as any).name === 'AbortError') return;
          console.error('Error searching invoices:', error);
          setInvoiceSearchError('Erreur lors de la recherche');
          setInvoiceSearchResults([]);
        } finally {
          setInvoiceSearchLoading(false);
        }
      }, 200);

      return () => {
        clearTimeout(timeout);
        controller.abort();
      };
    }

    if (isCurrentSelection || formData.invoiceNumber.trim().length < 2) {
      setInvoiceSearchResults([]);
      setInvoiceSearchError(null);
      setInvoiceSearchLoading(false);
      return;
    }

    setInvoiceSearchLoading(true);
    setInvoiceSearchError(null);

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/sales/invoices/by-number?q=${encodeURIComponent(query)}`,
          {
            headers: { 'X-Tenant-Id': tenantId },
            signal: controller.signal,
          }
        );

        if (response.ok) {
          const data = await response.json();
          setInvoiceSearchResults(data.items || []);
        } else {
          const error = await response.json();
          setInvoiceSearchError(error.error || 'Erreur lors de la recherche');
          setInvoiceSearchResults([]);
        }
      } catch (error) {
        if ((error as any).name === 'AbortError') return;
        console.error('Error searching invoices:', error);
        setInvoiceSearchError('Erreur lors de la recherche');
        setInvoiceSearchResults([]);
      } finally {
        setInvoiceSearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [formData.invoiceNumber, tenantId, showModal, invoiceLookup]);

  useEffect(() => {
    if (!showModal || invoiceSearchResults.length === 0 || !invoiceInputRef.current) {
      setInvoiceDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = invoiceInputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setInvoiceDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [invoiceSearchResults, showModal]);

  const fetchInvoiceDetails = async (numeroOverride?: string) => {
    if (!tenantId) return;
    const invoiceNumber = (numeroOverride ?? formData.invoiceNumber).trim();
    if (!invoiceNumber) {
      toast.error('Veuillez saisir un numéro de facture');
      return;
    }

    try {
      setInvoiceLookup({ status: 'loading' });
      const response = await fetch(
        `/api/sales/invoices/by-number?numero=${encodeURIComponent(
          invoiceNumber
        )}`,
        {
          headers: { 'X-Tenant-Id': tenantId },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setInvoiceLookup({ status: 'success', data });
      } else {
        const error = await response.json();
        setInvoiceLookup({
          status: 'error',
          error: error.error || 'Facture introuvable',
        });
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      setInvoiceLookup({
        status: 'error',
        error: 'Erreur lors de la recherche de la facture',
      });
    }
  };

  const handleLookupInvoice = async () => {
    fetchInvoiceDetails();
  };

  const handleCreateCreditNote = async () => {
    if (!tenantId) return;
    if (invoiceLookup.status !== 'success' || !invoiceLookup.data) {
      toast.error('Veuillez sélectionner une facture valide');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/sales/credit-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          invoiceNumber: invoiceLookup.data.numero,
          reason: formData.reason || undefined,
        }),
      });

      if (response.ok) {
        toast.success('Avoir créé avec succès');
        setShowModal(false);
        setFormData({ invoiceNumber: '', reason: '' });
        setInvoiceLookup({ status: 'idle' });
        fetchCreditNotes();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la création de l’avoir');
      }
    } catch (error) {
      console.error('Error creating credit note:', error);
      toast.error('Erreur lors de la création de l’avoir');
    } finally {
      setCreating(false);
    }
  };

  const handleViewCreditNote = (note: CreditNote) => {
    if (!note._id) return;
    router.push(`/sales/credit-notes/${note._id}`);
  };

  const handleDownloadPdf = async (note: CreditNote) => {
    if (!tenantId) return;
    try {
      const response = await fetch(`/api/sales/credit-notes/${note._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Avoir-${note.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Impossible de télécharger le PDF');
    }
  };

  const handleDeleteCreditNote = async (note: CreditNote) => {
    if (!tenantId) return;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'avoir ${note.numero} ?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/sales/credit-notes/${note._id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        toast.success('Avoir supprimé avec succès');
        fetchCreditNotes();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting credit note:', error);
      toast.error('Erreur lors de la suppression de l\'avoir');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
              <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                <DocumentTextIcon className="w-7 h-7 text-blue-600" />
                Avoirs clients
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Générez des notes de crédit à partir d'une facture existante.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchCreditNotes}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Rafraîchir
            </button>
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="w-5 h-5" />
              Nouvel avoir
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher par numéro d’avoir ou de facture..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
              </div>
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile Skeleton */}
            <div className="lg:hidden space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredCreditNotes.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 border-dashed">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Aucun avoir trouvé
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Créez un avoir en sélectionnant la facture correspondante.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Avoir
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Facture liée
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCreditNotes.map((note) => (
                    <tr key={note._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {note.numero}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {note.referenceExterne || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(note.dateDoc)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400">
                        {formatPrice(Math.abs(note.totalTTC || 0), note.devise)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/sales/credit-notes/${note._id}/edit`)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
                            title="Modifier l'avoir"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleViewCreditNote(note)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
                            title="Voir l'avoir"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(note)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
                            title="Télécharger le PDF"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCreditNote(note)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Supprimer l'avoir"
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


            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {filteredCreditNotes.map((note) => (
                <div key={note._id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{note.numero}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {formatDate(note.dateDoc)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewCreditNote(note)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Voir"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => router.push(`/sales/credit-notes/${note._id}/edit`)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Facture liée:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{note.referenceExterne || '-'}</span>
                    </div>
                  </div>

                  <div className="border-t dark:border-gray-700 pt-3 flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Montant TTC</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {formatPrice(Math.abs(note.totalTTC || 0), note.devise)}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleDownloadPdf(note)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => handleDeleteCreditNote(note)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Créer un avoir
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Saisissez le numéro de facture pour générer un avoir.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Numéro de facture
                  </label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        ref={invoiceInputRef}
                        value={formData.invoiceNumber}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            invoiceNumber: e.target.value,
                          }))
                        }
                        placeholder="FAC-2025-0001"
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                      <button
                        onClick={handleLookupInvoice}
                        className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600"
                        disabled={invoiceLookup.status === 'loading'}
                      >
                        {invoiceLookup.status === 'loading' ? 'Recherche...' : 'Rechercher'}
                      </button>
                    </div>
                    {invoiceSearchLoading && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recherche...</p>
                    )}
                    {invoiceSearchError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{invoiceSearchError}</p>
                    )}
                    {invoiceDropdownPosition &&
                      invoiceSearchResults.length > 0 &&
                      typeof document !== 'undefined' &&
                      createPortal(
                        <div
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                          style={{
                            position: 'fixed',
                            top: invoiceDropdownPosition.top,
                            left: invoiceDropdownPosition.left,
                            width: invoiceDropdownPosition.width,
                            zIndex: 2000,
                          }}
                        >
                          {invoiceSearchResults.map((invoice) => {
                            const alreadyUsed = creditNotes.some(
                              (note) => note.referenceExterne === invoice.numero
                            );

                            return (
                              <button
                                type="button"
                                key={invoice._id || invoice.numero}
                                disabled={alreadyUsed}
                                onClick={() => {
                                  if (alreadyUsed) return;
                                  setFormData((prev) => ({
                                    ...prev,
                                    invoiceNumber: invoice.numero,
                                  }));
                                  setInvoiceSearchResults([]);
                                  setInvoiceSearchError(null);
                                  fetchInvoiceDetails(invoice.numero);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm ${alreadyUsed
                                  ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed'
                                  : 'hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-200'
                                  }`}
                              >
                                <div className="font-semibold">
                                  {invoice.numero}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatDate(invoice.dateDoc)} ·{' '}
                                  {formatPrice(
                                    invoice.totalTTC || 0,
                                    invoice.devise || 'TND'
                                  )}
                                  {alreadyUsed && ' (déjà utilisé dans un avoir)'}
                                </div>
                              </button>
                            );
                          })}
                        </div>,
                        document.body
                      )}
                  </div>
                  {invoiceLookup.status === 'error' && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <InformationCircleIcon className="w-4 h-4" />
                      {invoiceLookup.error}
                    </p>
                  )}
                </div>

                {invoiceLookup.status === 'success' && invoiceLookup.data && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 text-lg mb-2">
                        Facture sélectionnée
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-blue-900 dark:text-blue-200">
                        <div>
                          <span className="text-blue-600 dark:text-blue-400 block text-xs uppercase">
                            Numéro
                          </span>
                          <span className="font-semibold">
                            {invoiceLookup.data.numero}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600 dark:text-blue-400 block text-xs uppercase">
                            Date
                          </span>
                          <span className="font-semibold">
                            {formatDate(invoiceLookup.data.dateDoc)}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600 dark:text-blue-400 block text-xs uppercase">
                            Montant TTC
                          </span>
                          <span className="font-semibold">
                            {formatPrice(
                              invoiceLookup.data.totalTTC || 0,
                              invoiceLookup.data.devise || 'TND'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border dark:border-gray-700 rounded-xl overflow-hidden">
                      <div className="px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Lignes de la facture
                      </div>
                      <div className="max-h-60 overflow-y-auto bg-white dark:bg-gray-800">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">
                                Désignation
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">
                                Qté
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">
                                Prix HT
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">
                                TVA %
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {invoiceLookup.data.lignes?.map((line: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                                  {line.designation}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                                  {line.quantite}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                                  {formatPrice(line.prixUnitaireHT || 0, invoiceLookup.data.devise || 'TND')}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                                  {line.tvaPct || 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Motif (optionnel)
                      </label>
                      <textarea
                        rows={3}
                        value={formData.reason}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, reason: e.target.value }))
                        }
                        placeholder="Ex: Retour partiel, remise commerciale..."
                        className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t dark:border-gray-700 flex gap-3 flex-col sm:flex-row sm:justify-end bg-white dark:bg-gray-800 rounded-b-2xl">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateCreditNote}
                  disabled={
                    creating ||
                    invoiceLookup.status !== 'success' ||
                    !invoiceLookup.data
                  }
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating ? 'Création...' : 'Créer l’avoir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout >
  );
}

