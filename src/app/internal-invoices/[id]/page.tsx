'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { ArrowLeftIcon, PencilIcon, TrashIcon, ArrowDownTrayIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface InternalInvoice {
  _id: string;
  numero: string;
  dateDoc: string;
  statut?: string;
  customerId?: {
    _id: string;
    raisonSociale?: string;
    nom?: string;
    prenom?: string;
  };
  projetId?: {
    _id: string;
    name: string;
    projectNumber?: string;
  };
  referenceExterne?: string;
  lignes: Array<{
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
    remisePct?: number;
    tvaPct?: number;
    uomCode?: string;
  }>;
  totalBaseHT: number;
  totalTVA: number;
  totalTTC: number;
  timbreFiscal?: number;
  remiseGlobalePct?: number;
  fodec?: {
    enabled: boolean;
    tauxPct: number;
    montant?: number;
  };
  devise: string;
  modePaiement?: string;
  conditionsPaiement?: string;
  notes?: string;
  notesInterne?: string;
  dateEcheance?: string;
  archived?: boolean;
}

const statutColors: { [key: string]: string } = {
  BROUILLON: 'bg-gray-100 text-gray-800',
  VALIDEE: 'bg-green-100 text-green-800',
  PARTIELLEMENT_PAYEE: 'bg-yellow-100 text-yellow-800',
  PAYEE: 'bg-blue-100 text-blue-800',
  ANNULEE: 'bg-red-100 text-red-800',
};

const statutLabels: { [key: string]: string } = {
  BROUILLON: 'Brouillon',
  VALIDEE: 'Validée',
  PARTIELLEMENT_PAYEE: 'Partiellement payée',
  PAYEE: 'Payée',
  ANNULEE: 'Annulée',
};

export default function InternalInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [invoice, setInvoice] = useState<InternalInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConverted, setIsConverted] = useState(false);
  const [convertedInvoiceInfo, setConvertedInvoiceInfo] = useState<{ id: string; numero: string } | null>(null);

  useEffect(() => {
    if (params?.id && tenantId) {
      fetchInvoice();
    }
  }, [params?.id, tenantId]);

  const fetchInvoice = async () => {
    try {
      if (!tenantId || !params?.id) return;
      
      const response = await fetch(`/api/internal-invoices/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });

      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
        
        // Check if invoice has been converted by looking for conversion note or checking for linked official invoice
        const hasConversionNote = data.notesInterne?.includes('Convertie en facture officielle');
        if (hasConversionNote || data.archived) {
          setIsConverted(true);
          // Extract conversion info from notesInterne if available
          const conversionMatch = data.notesInterne?.match(/Convertie en facture officielle (FAC[^\s]+)/);
          if (conversionMatch) {
            // Try to find the converted invoice by number
            try {
              const convertedResponse = await fetch(`/api/sales/invoices?numero=${conversionMatch[1]}`, {
                headers: { 'X-Tenant-Id': tenantId }
              });
              if (convertedResponse.ok) {
                const convertedData = await convertedResponse.json();
                if (convertedData.items && convertedData.items.length > 0) {
                  const converted = convertedData.items[0];
                  setConvertedInvoiceInfo({ id: converted._id, numero: converted.numero });
                }
              }
            } catch (err) {
              console.error('Error fetching converted invoice:', err);
            }
          }
        }
      } else if (response.status === 404) {
        toast.error('Facture interne non trouvée');
        router.push('/internal-invoices');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du chargement de la facture');
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture interne ?')) {
      return;
    }

    try {
      if (!tenantId || !params?.id) return;

      const response = await fetch(`/api/internal-invoices/${params.id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId }
      });

      if (response.ok) {
        toast.success('Facture interne supprimée avec succès');
        router.push('/internal-invoices');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('Error deleting invoice:', err);
      toast.error('Erreur de connexion');
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice || !tenantId) return;

    try {
      // TODO: Implement PDF download endpoint
      toast('Téléchargement PDF en cours de développement...', { icon: 'ℹ️' });
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Erreur lors du téléchargement du PDF');
    }
  };

  const handleConvertToOfficial = async () => {
    if (!invoice || !tenantId) return;

    if (isConverted) {
      if (convertedInvoiceInfo) {
        toast(`Cette facture a déjà été convertie en facture officielle ${convertedInvoiceInfo.numero}`, { icon: 'ℹ️' });
        router.push(`/sales/invoices/${convertedInvoiceInfo.id}`);
      } else {
        toast.error('Cette facture a déjà été convertie');
      }
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir convertir cette facture interne en facture officielle ?\n\nCette action créera une nouvelle facture officielle avec un nouveau numéro.')) {
      return;
    }

    try {
      const response = await fetch(`/api/internal-invoices/${invoice._id}/convert`, {
        method: 'POST',
        headers: { 
          'X-Tenant-Id': tenantId,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Facture officielle ${data.invoice.numero} créée avec succès`);
        // Redirect to the new official invoice
        router.push(`/sales/invoices/${data.invoice._id}`);
      } else {
        const error = await response.json();
        if (error.convertedInvoiceId) {
          setIsConverted(true);
          setConvertedInvoiceInfo({ id: error.convertedInvoiceId, numero: error.convertedInvoiceNumber });
          toast(`Cette facture a déjà été convertie en facture officielle ${error.convertedInvoiceNumber}`, { icon: 'ℹ️' });
          router.push(`/sales/invoices/${error.convertedInvoiceId}`);
        } else {
          toast.error(error.error || 'Erreur lors de la conversion');
        }
      }
    } catch (err) {
      console.error('Error converting invoice:', err);
      toast.error('Erreur de connexion lors de la conversion');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Facture interne non trouvée</p>
            <button
              onClick={() => router.push('/internal-invoices')}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Retour à la liste
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const customerName = invoice.customerId
    ? invoice.customerId.raisonSociale || `${invoice.customerId.nom || ''} ${invoice.customerId.prenom || ''}`.trim()
    : 'Non spécifié';

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/internal-invoices')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Facture interne {invoice.numero}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Créée le {new Date(invoice.dateDoc).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
            {invoice.statut && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statutColors[invoice.statut] || statutColors.BROUILLON}`}>
                {statutLabels[invoice.statut] || invoice.statut}
              </span>
            )}
            {isConverted && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span>✓</span>
                <span>Convertie en facture officielle</span>
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {isConverted ? (
              convertedInvoiceInfo ? (
                <button
                  onClick={() => router.push(`/sales/invoices/${convertedInvoiceInfo.id}`)}
                  className="inline-flex items-center px-4 py-2 border border-emerald-600 rounded-md shadow-sm text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                >
                  <ArrowRightIcon className="h-5 w-5 mr-2" />
                  Voir la facture officielle {convertedInvoiceInfo.numero}
                </button>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
                >
                  <ArrowRightIcon className="h-5 w-5 mr-2" />
                  Déjà convertie
                </button>
              )
            ) : (
              <button
                onClick={handleConvertToOfficial}
                className="inline-flex items-center px-4 py-2 border border-green-600 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50"
              >
                <ArrowRightIcon className="h-5 w-5 mr-2" />
                Convertir en facture officielle
              </button>
            )}
            <button
              onClick={() => {
                router.push(`/internal-invoices?edit=${invoice._id}`);
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <PencilIcon className="h-5 w-5 mr-2" />
              Modifier
            </button>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              PDF
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              Supprimer
            </button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Client</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{customerName}</p>
          </div>
          {invoice.projetId && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">Projet</p>
              <Link
                href={`/projects/${invoice.projetId._id}`}
                className="mt-1 text-lg font-semibold text-blue-600 hover:text-blue-700"
              >
                {invoice.projetId.name}
              </Link>
            </div>
          )}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Total TTC</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {invoice.totalTTC?.toFixed(3)} {invoice.devise || 'TND'}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Détails de la facture</h2>
          </div>
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="mt-1 font-medium text-gray-900">
                  {new Date(invoice.dateDoc).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {invoice.dateEcheance && (
                <div>
                  <p className="text-sm text-gray-600">Date d'échéance</p>
                  <p className="mt-1 font-medium text-gray-900">
                    {new Date(invoice.dateEcheance).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              {invoice.referenceExterne && (
                <div>
                  <p className="text-sm text-gray-600">Référence externe</p>
                  <p className="mt-1 font-medium text-gray-900">{invoice.referenceExterne}</p>
                </div>
              )}
              {invoice.modePaiement && (
                <div>
                  <p className="text-sm text-gray-600">Mode de paiement</p>
                  <p className="mt-1 font-medium text-gray-900">{invoice.modePaiement}</p>
                </div>
              )}
            </div>
            {invoice.conditionsPaiement && (
              <div>
                <p className="text-sm text-gray-600">Conditions de paiement</p>
                <p className="mt-1 font-medium text-gray-900">{invoice.conditionsPaiement}</p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <p className="text-sm text-gray-600">Notes</p>
                <p className="mt-1 font-medium text-gray-900 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Lines */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Lignes de facture</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Désignation
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qté
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix unitaire HT
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remise
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TVA
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total HT
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoice.lignes && invoice.lignes.length > 0 ? (
                  invoice.lignes.map((line, index) => {
                    const remise = line.remisePct || 0;
                    const prixHT = line.prixUnitaireHT * (1 - remise / 100);
                    const montantHT = prixHT * line.quantite;
                    const tvaPct = line.tvaPct || 0;
                    const montantTVA = montantHT * (tvaPct / 100);
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {line.designation}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {line.quantite} {line.uomCode || ''}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {line.prixUnitaireHT.toFixed(3)} {invoice.devise || 'TND'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {remise > 0 ? `${remise}%` : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {tvaPct > 0 ? `${tvaPct}%` : '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {montantHT.toFixed(3)} {invoice.devise || 'TND'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Aucune ligne de facture
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Totaux</h2>
          </div>
          <div className="px-4 sm:px-6 py-4">
            <div className="space-y-2 max-w-md ml-auto">
              {invoice.remiseGlobalePct && invoice.remiseGlobalePct > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remise globale:</span>
                  <span className="font-medium text-gray-900">{invoice.remiseGlobalePct}%</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total HT:</span>
                <span className="font-medium text-gray-900">
                  {invoice.totalBaseHT?.toFixed(3)} {invoice.devise || 'TND'}
                </span>
              </div>
              {invoice.fodec && invoice.fodec.enabled && invoice.fodec.montant && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">FODEC:</span>
                  <span className="font-medium text-gray-900">
                    {invoice.fodec.montant.toFixed(3)} {invoice.devise || 'TND'}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total TVA:</span>
                <span className="font-medium text-gray-900">
                  {invoice.totalTVA?.toFixed(3)} {invoice.devise || 'TND'}
                </span>
              </div>
              {invoice.timbreFiscal && invoice.timbreFiscal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Timbre fiscal:</span>
                  <span className="font-medium text-gray-900">
                    {invoice.timbreFiscal.toFixed(3)} {invoice.devise || 'TND'}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total TTC:</span>
                <span className="font-bold text-blue-600">
                  {invoice.totalTTC?.toFixed(3)} {invoice.devise || 'TND'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

