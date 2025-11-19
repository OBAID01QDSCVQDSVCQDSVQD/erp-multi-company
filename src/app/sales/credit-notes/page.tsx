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
    if (
      showModal &&
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

    if (isCurrentSelection || !tenantId || query.length < 2) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <DocumentTextIcon className="w-7 h-7 text-blue-600" />
              Avoirs clients
            </h1>
            <p className="text-gray-600 text-sm">
              Générez des notes de crédit à partir d’une facture existante.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchCreditNotes}
              className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
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
            className="w-full pl-4 pr-4 py-2 border rounded-lg text-sm"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement des avoirs...</p>
          </div>
        ) : filteredCreditNotes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Aucun avoir trouvé
            </h3>
            <p className="text-gray-600">
              Créez un avoir en sélectionnant la facture correspondante.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Avoir
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Facture liée
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredCreditNotes.map((note) => (
                    <tr key={note._id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {note.numero}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {note.referenceExterne || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(note.dateDoc)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">
                        {formatPrice(Math.abs(note.totalTTC || 0), note.devise)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            note.statut === 'PAYEE'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {note.statut || 'BROUILLON'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewCreditNote(note)}
                            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                            title="Voir l’avoir"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(note)}
                            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                            title="Télécharger le PDF"
                          >
                            <ArrowDownTrayIcon className="w-4 h-4" />
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

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Créer un avoir
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Saisissez le numéro de facture pour générer un avoir.
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={handleLookupInvoice}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                        disabled={invoiceLookup.status === 'loading'}
                      >
                        {invoiceLookup.status === 'loading' ? 'Recherche...' : 'Rechercher'}
                      </button>
                    </div>
                    {invoiceSearchLoading && (
                      <p className="text-xs text-gray-500 mt-1">Recherche...</p>
                    )}
                    {invoiceSearchError && (
                      <p className="text-xs text-red-600 mt-1">{invoiceSearchError}</p>
                    )}
                    {invoiceDropdownPosition &&
                      invoiceSearchResults.length > 0 &&
                      typeof document !== 'undefined' &&
                      createPortal(
                        <div
                          className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                          style={{
                            position: 'fixed',
                            top: invoiceDropdownPosition.top,
                            left: invoiceDropdownPosition.left,
                            width: invoiceDropdownPosition.width,
                            zIndex: 2000,
                          }}
                        >
                          {invoiceSearchResults.map((invoice) => (
                            <button
                              type="button"
                              key={invoice._id || invoice.numero}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  invoiceNumber: invoice.numero,
                                }));
                                setInvoiceSearchResults([]);
                                setInvoiceSearchError(null);
                                fetchInvoiceDetails(invoice.numero);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50"
                            >
                              <div className="font-semibold text-gray-900">
                                {invoice.numero}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(invoice.dateDoc)} ·{' '}
                                {formatPrice(
                                  invoice.totalTTC || 0,
                                  invoice.devise || 'TND'
                                )}
                              </div>
                            </button>
                          ))}
                        </div>,
                        document.body
                      )}
                  </div>
                  {invoiceLookup.status === 'error' && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <InformationCircleIcon className="w-4 h-4" />
                      {invoiceLookup.error}
                    </p>
                  )}
                </div>

                {invoiceLookup.status === 'success' && invoiceLookup.data && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <h3 className="font-semibold text-blue-900 text-lg mb-2">
                        Facture sélectionnée
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-blue-900">
                        <div>
                          <span className="text-blue-600 block text-xs uppercase">
                            Numéro
                          </span>
                          <span className="font-semibold">
                            {invoiceLookup.data.numero}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600 block text-xs uppercase">
                            Date
                          </span>
                          <span className="font-semibold">
                            {formatDate(invoiceLookup.data.dateDoc)}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-600 block text-xs uppercase">
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

                    <div className="border rounded-xl">
                      <div className="px-4 py-2 border-b bg-gray-50 text-sm font-semibold text-gray-700">
                        Lignes de la facture
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">
                                Désignation
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                                Qté
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                                Prix HT
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">
                                TVA %
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {invoiceLookup.data.lignes?.map((line: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-gray-700">
                                  {line.designation}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600">
                                  {line.quantite}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600">
                                  {formatPrice(line.prixUnitaireHT || 0, invoiceLookup.data.devise || 'TND')}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600">
                                  {line.tvaPct || 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motif (optionnel)
                      </label>
                      <textarea
                        rows={3}
                        value={formData.reason}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, reason: e.target.value }))
                        }
                        placeholder="Ex: Retour partiel, remise commerciale..."
                        className="w-full px-3 py-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex gap-3 flex-col sm:flex-row sm:justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border rounded-lg hover:bg-gray-50"
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
    </DashboardLayout>
  );
}

