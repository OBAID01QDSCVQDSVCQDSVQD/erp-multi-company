'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface InvoiceItem {
  _id: string;
  numero: string;
  dateDoc?: string;
  totalTTC?: number;
  devise?: string;
}

export default function EditCreditNotePage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numero, setNumero] = useState<string>('');
  const [referenceExterne, setReferenceExterne] = useState<string>('');

  const [searchResults, setSearchResults] = useState<InvoiceItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [usedCreditNotes, setUsedCreditNotes] = useState<
    { id: string; referenceExterne?: string }[]
  >([]);

  useEffect(() => {
    const fetchCreditNote = async () => {
      if (!tenantId || !params?.id) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/sales/credit-notes/${params.id}`, {
          headers: { 'X-Tenant-Id': tenantId },
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || 'Avoir introuvable');
          router.push('/sales/credit-notes');
          return;
        }

        const data = await res.json();
        setNumero(data.numero);
        setReferenceExterne(data.referenceExterne || '');
      } catch (error) {
        console.error('Error loading credit note:', error);
        toast.error("Erreur lors du chargement de l'avoir");
        router.push('/sales/credit-notes');
      } finally {
        setLoading(false);
      }
    };

    const fetchUsedCreditNotes = async () => {
      if (!tenantId) return;
      try {
        const res = await fetch('/api/sales/credit-notes', {
          headers: { 'X-Tenant-Id': tenantId },
        });
        if (res.ok) {
          const data = await res.json();
          setUsedCreditNotes(
            (data.items || []).map((n: any) => ({
              id: n._id?.toString?.() || n._id,
              referenceExterne: n.referenceExterne,
            }))
          );
        }
      } catch (error) {
        console.error('Error loading credit notes list:', error);
      }
    };

    if (tenantId && params?.id) {
      fetchCreditNote();
      fetchUsedCreditNotes();
    }
  }, [tenantId, params, router]);

  // Recherche des factures pour le dropdown
  useEffect(() => {
    if (!tenantId) return;
    const query = referenceExterne.trim();

    // إذا لا يوجد بحث، نعرض آخر الفواتير
    if (query.length < 2) {
      setSearchLoading(true);
      setSearchError(null);

      const controller = new AbortController();
      const timeout = setTimeout(async () => {
        try {
          const res = await fetch(`/api/sales/invoices/by-number`, {
            headers: { 'X-Tenant-Id': tenantId },
            signal: controller.signal,
          });

          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.items || []);
          } else {
            const err = await res.json();
            setSearchError(err.error || 'Erreur lors de la recherche');
            setSearchResults([]);
          }
        } catch (error) {
          if ((error as any).name === 'AbortError') return;
          console.error('Error searching invoices:', error);
          setSearchError('Erreur lors de la recherche');
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 200);

      return () => {
        clearTimeout(timeout);
        controller.abort();
      };
    }

    setSearchLoading(true);
    setSearchError(null);

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/sales/invoices/by-number?q=${encodeURIComponent(query)}`,
          {
            headers: { 'X-Tenant-Id': tenantId },
            signal: controller.signal,
          }
        );

        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        } else {
          const err = await res.json();
          setSearchError(err.error || 'Erreur lors de la recherche');
          setSearchResults([]);
        }
      } catch (error) {
        if ((error as any).name === 'AbortError') return;
        console.error('Error searching invoices:', error);
        setSearchError('Erreur lors de la recherche');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [referenceExterne, tenantId]);

  const handleSelectInvoice = (invoice: InvoiceItem) => {
    setReferenceExterne(invoice.numero);
    setSearchResults([]);
  };

  const handleSave = async () => {
    if (!tenantId || !params?.id) return;
    if (!referenceExterne.trim()) {
      toast.error('Veuillez saisir le numéro de la facture liée');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/sales/credit-notes/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({ referenceExterne: referenceExterne.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de la sauvegarde');
        return;
      }

      toast.success('Facture liée mise à jour');
      router.push('/sales/credit-notes');
    } catch (error) {
      console.error('Error updating credit note:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Chargement de l’avoir...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Modifier l’avoir {numero}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sélectionnez la facture liée à partir de la liste.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Facture liée (numéro)
            </label>
            <input
              type="text"
              value={referenceExterne}
              onChange={(e) => setReferenceExterne(e.target.value)}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Rechercher par numéro de facture..."
            />
          </div>

          {searchLoading && (
            <p className="text-xs text-gray-500">Recherche des factures...</p>
          )}

          {searchError && (
            <p className="text-xs text-red-500">{searchError}</p>
          )}

          {searchResults.length > 0 && (
            <div className="border dark:border-gray-700 rounded-lg max-h-56 overflow-y-auto text-sm">
              {searchResults.map((inv) => {
                const currentId = (params?.id as string) || '';
                const alreadyUsed = usedCreditNotes.some(
                  (n) =>
                    n.referenceExterne === inv.numero &&
                    n.id !== currentId
                );

                return (
                  <button
                    key={inv._id}
                    type="button"
                    disabled={alreadyUsed}
                    onClick={() => {
                      if (alreadyUsed) return;
                      handleSelectInvoice(inv);
                    }}
                    className={`w-full flex justify-between items-center px-3 py-2 border-b dark:border-gray-700 last:border-b-0 text-left ${alreadyUsed
                        ? 'bg-gray-50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                  >
                    <span className="font-medium text-gray-900 dark:text-white">
                      {inv.numero}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {typeof inv.totalTTC === 'number' &&
                        `${Math.abs(inv.totalTTC).toFixed(3)} ${inv.devise || 'TND'
                        }`}
                      {alreadyUsed && ' (déjà utilisé dans un avoir)'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/sales/credit-notes')}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}


