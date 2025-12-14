'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

export default function CreditNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();

  const [creditNote, setCreditNote] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchCreditNote();
    }
  }, [tenantId, params.id]);

  const fetchCreditNote = async () => {
    if (!tenantId || !params.id) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/sales/credit-notes/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Avoir introuvable');
        router.push('/sales/credit-notes');
        return;
      }

      const data = await response.json();
      setCreditNote(data);

      if (data.customerId) {
        fetchCustomer(data.customerId);
      }
    } catch (error) {
      console.error('Error fetching credit note:', error);
      toast.error('Erreur lors du chargement de l’avoir');
      router.push('/sales/credit-notes');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomer = async (customerId: string) => {
    if (!tenantId) return;
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        setCustomer(await response.json());
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  };

  const handleDownloadPdf = async () => {
    if (!creditNote || !tenantId) return;
    try {
      setDownloading(true);
      const response = await fetch(`/api/sales/credit-notes/${creditNote._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Avoir-${creditNote.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Impossible de télécharger le PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Chargement de l’avoir...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!creditNote) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center text-gray-600">
          Avoir introuvable
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/sales/credit-notes')}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm text-gray-500">Avoir</p>
              <h1 className="text-2xl font-bold text-gray-900">{creditNote.numero}</h1>
              <p className="text-sm text-gray-500">Créé le {new Date(creditNote.dateDoc).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Télécharger PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border rounded-2xl p-4 space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-6 h-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Informations</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <p className="text-gray-500">Numéro d’avoir</p>
                <p className="font-medium text-gray-900">{creditNote.numero}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(creditNote.dateDoc).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Statut</p>
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                  creditNote.statut === 'PAYEE'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {creditNote.statut || 'BROUILLON'}
                </span>
              </div>
              {creditNote.referenceExterne && (
                <div>
                  <p className="text-gray-500">Facture liée</p>
                  <p className="font-medium text-blue-600">{creditNote.referenceExterne}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Client</h2>
            {customer ? (
              <div className="text-sm text-gray-600 space-y-2">
                <p className="font-medium text-gray-900">
                  {customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim()}
                </p>
                {customer.adresseFacturation && (
                  <p>
                    {customer.adresseFacturation.ligne1}
                    <br />
                    {customer.adresseFacturation.codePostal} {customer.adresseFacturation.ville}
                  </p>
                )}
                {customer.telephone && <p>Tél: {customer.telephone}</p>}
                {customer.matriculeFiscale && <p>MF: {customer.matriculeFiscale}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Client introuvable</p>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Réf</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qté</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Prix HT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Remise %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">TVA %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total HT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {creditNote.lignes?.map((line: any, idx: number) => {
                  const quantite = Math.abs(line.quantite || 0);
                  const prix = line.prixUnitaireHT || 0;
                  const remise = line.remisePct || 0;
                  const tva = line.tvaPct || 0;
                  const prixApresRemise = prix * (1 - remise / 100);
                  const totalHT = prixApresRemise * quantite;
                  const totalTTC = totalHT * (1 + tva / 100);

                  return (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {line.codeAchat || line.categorieCode || line.designation || `Ligne ${idx + 1}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {line.designation || line.description || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{quantite}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{prix.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{remise}%</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right">{tva}%</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{totalHT.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{totalTTC.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:justify-between gap-6">
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <span className="text-gray-500">Mode paiement: </span>
              <span className="font-medium text-gray-900">
                {creditNote.modePaiement || '—'}
              </span>
            </p>
            {creditNote.notes && (
              <p className="text-gray-500 border-t pt-2">{creditNote.notes}</p>
            )}
            {creditNote.referenceExterne && (
              <p className="text-sm text-blue-600 border-t pt-2">
                Facture d’origine: {creditNote.referenceExterne}
              </p>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-4 w-full sm:w-80 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total HT</span>
              <span className="font-semibold text-gray-900">
                {(Math.abs(creditNote.totalBaseHT || creditNote.totalHT || 0)).toFixed(3)} {creditNote.devise || 'TND'}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total TVA</span>
              <span className="font-semibold text-gray-900">
                {(Math.abs(creditNote.totalTVA || 0)).toFixed(3)} {creditNote.devise || 'TND'}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Timbre fiscal</span>
              <span className="font-semibold text-gray-900">
                {(Math.abs(creditNote.timbreFiscal || 0)).toFixed(3)} {creditNote.devise || 'TND'}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between text-lg font-bold text-blue-600">
              <span>Total TTC</span>
              <span>
                {(Math.abs(creditNote.totalTTC || 0)).toFixed(3)} {creditNote.devise || 'TND'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}














