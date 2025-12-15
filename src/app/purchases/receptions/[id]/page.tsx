'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowDownTrayIcon, PencilIcon, TrashIcon, CheckIcon, XMarkIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Reception {
  _id: string;
  numero: string;
  dateDoc: string;
  purchaseOrderId?: string;
  fournisseurId: string;
  fournisseurNom: string;
  statut: 'BROUILLON' | 'VALIDE' | 'ANNULE';
  lignes: Array<{
    productId?: string;
    reference?: string;
    designation?: string;
    uom?: string;
    qteCommandee?: number;
    qteRecue: number;
    prixUnitaireHT?: number;
    remisePct?: number;
    tvaPct?: number;
    totalLigneHT?: number;
  }>;
  totaux: {
    totalHT: number;
    fodec?: number;
    totalTVA: number;
    timbre?: number;
    totalTTC: number;
  };
  fodecActif?: boolean;
  tauxFodec?: number;
  timbreActif?: boolean;
  montantTimbre?: number;
  remiseGlobalePct?: number;
  notes?: string;
}

export default function ReceptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [reception, setReception] = useState<Reception | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [receptionId, setReceptionId] = useState<string>('');
  const [purchaseOrderNumero, setPurchaseOrderNumero] = useState<string>('');

  useEffect(() => {
    async function loadId() {
      const resolvedParams = await params;
      setReceptionId(resolvedParams.id);
    }
    loadId();
  }, [params]);

  useEffect(() => {
    if (tenantId && receptionId) {
      fetchReception();
    }
  }, [tenantId, receptionId]);

  async function fetchReception() {
    if (!tenantId || !receptionId) {
      console.log('fetchReception skipped - tenantId:', tenantId, 'receptionId:', receptionId);
      return;
    }
    try {
      setLoading(true);
      console.log('Fetching reception:', receptionId);
      const response = await fetch(`/api/purchases/receptions/${receptionId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Reception data:', data);
        console.log('Reception _id:', data._id);
        console.log('Reception lignes:', data.lignes);
        if (data.lignes && data.lignes.length > 0) {
          console.log('First line remisePct:', data.lignes[0].remisePct);
        }
        setReception(data);
        
        // Fetch Purchase Order number if purchaseOrderId exists
        if (data.purchaseOrderId) {
          try {
            const poResponse = await fetch(`/api/purchases/orders/${data.purchaseOrderId}`, {
              headers: { 'X-Tenant-Id': tenantId },
            });
            if (poResponse.ok) {
              const poData = await poResponse.json();
              setPurchaseOrderNumero(poData.numero || '');
            }
          } catch (error) {
            console.error('Error fetching purchase order:', error);
          }
        }
      } else {
        toast.error('Bon de réception non trouvé');
        router.push('/purchases/receptions');
      }
    } catch (error) {
      console.error('Error fetching reception:', error);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    if (!tenantId || !receptionId) return;
    
    if (!confirm('Êtes-vous sûr de vouloir valider ce bon de réception ? Cela créera des mouvements de stock.')) {
      return;
    }
    
    try {
      setValidating(true);
      const response = await fetch(`/api/purchases/receptions/${receptionId}/valider`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        toast.success('Bon de réception validé avec succès');
        await fetchReception();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la validation');
      }
    } catch (error) {
      console.error('Error validating reception:', error);
      toast.error('Erreur de connexion');
    } finally {
      setValidating(false);
    }
  }

  async function handleCancel() {
    if (!tenantId || !receptionId) return;
    
    if (!confirm('Êtes-vous sûr de vouloir annuler ce bon de réception ?')) {
      return;
    }
    
    try {
      setCancelling(true);
      const response = await fetch(`/api/purchases/receptions/${receptionId}/annuler`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        toast.success('Bon de réception annulé');
        await fetchReception();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de l\'annulation');
      }
    } catch (error) {
      console.error('Error cancelling reception:', error);
      toast.error('Erreur de connexion');
    } finally {
      setCancelling(false);
    }
  }

  async function handleDelete() {
    if (!tenantId || !receptionId) return;
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bon de réception ?')) {
      return;
    }
    
    try {
      setDeleting(true);
      const response = await fetch(`/api/purchases/receptions/${receptionId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        toast.success('Bon de réception supprimé');
        router.push('/purchases/receptions');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting reception:', error);
      toast.error('Erreur de connexion');
    } finally {
      setDeleting(false);
    }
  }

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'VALIDE':
        return 'bg-green-100 text-green-800';
      case 'ANNULE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'VALIDE':
        return 'Validé';
      case 'ANNULE':
        return 'Annulé';
      default:
        return 'Brouillon';
    }
  };

  if (!tenantId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!reception) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6">
          <div className="text-center py-12">
            <p className="text-gray-500">Bon de réception non trouvé</p>
            <button
              onClick={() => router.push('/purchases/receptions')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Retour"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{reception.numero}</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Date: {new Date(reception.dateDoc).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatutColor(reception.statut)}`}>
              {getStatutLabel(reception.statut)}
            </span>
            <button
              onClick={() => router.push(`/purchases/receptions/${receptionId}/edit`)}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <PencilIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
            <button
              onClick={async () => {
                if (!reception || !tenantId) {
                  toast.error('Données manquantes pour le téléchargement');
                  return;
                }

                try {
                  toast.loading('Génération du PDF en cours...', { id: 'pdf-download' });
                  
                  const response = await fetch(`/api/purchases/receptions/${reception._id}/pdf`, {
                    headers: { 'X-Tenant-Id': tenantId },
                  });

                  // Check content type first
                  const contentType = response.headers.get('content-type');
                  
                  // If it's a PDF, proceed even if status is not 200
                  if (contentType?.includes('application/pdf')) {
                    // It's a PDF, continue with download (same as internal invoices)
                  } else if (!response.ok) {
                    // Not a PDF and response is not ok, try to get error message
                    try {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Erreur lors de la génération du PDF');
                    } catch (jsonError) {
                      throw new Error('Erreur lors de la génération du PDF');
                    }
                  } else if (contentType && !contentType.includes('application/pdf')) {
                    // Response is ok but not a PDF
                    try {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Le serveur n\'a pas retourné un PDF valide');
                    } catch (jsonError) {
                      throw new Error('Le serveur n\'a pas retourné un PDF valide');
                    }
                  }

                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Reception-${reception.numero}${reception.fournisseurNom ? '-' + reception.fournisseurNom.replace(/[^a-zA-Z0-9]/g, '_') : ''}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                  
                  toast.success('PDF téléchargé avec succès', { id: 'pdf-download' });
                } catch (err: any) {
                  console.error('Error downloading PDF:', err);
                  toast.error(err.message || 'Erreur lors du téléchargement du PDF', { id: 'pdf-download' });
                }
              }}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Fournisseur</label>
              <p className="text-sm font-medium text-gray-900">{reception.fournisseurNom}</p>
            </div>
            {reception.purchaseOrderId && (
              <div>
                <label className="text-xs text-gray-500">Bon de commande</label>
                <p className="text-sm font-medium text-gray-900">
                  {purchaseOrderNumero ? (
                    <button
                      onClick={() => router.push(`/purchases/orders/${reception.purchaseOrderId}`)}
                      className="text-blue-600 hover:underline"
                    >
                      {purchaseOrderNumero}
                    </button>
                  ) : (
                    <span className="text-gray-400">Chargement...</span>
                  )}
                </p>
              </div>
            )}
          </div>

              {/* FODEC and TVA Info */}
              {((reception.fodecActif !== undefined || reception.timbreActif !== undefined) || (reception.lignes && reception.lignes.length > 0)) && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* FODEC - Only show if active */}
                    {reception.fodecActif && (
                      <div>
                        <label className="text-xs text-gray-500">FODEC</label>
                        <p className="text-sm font-medium text-gray-900">
                          {reception.tauxFodec || 1}%
                          <span className="text-green-600 ml-2">(activé)</span>
                          {(reception.totaux?.fodec !== undefined) && (
                            <span className="text-gray-600 ml-2">- {reception.totaux.fodec.toFixed(3)} DT</span>
                          )}
                        </p>
                      </div>
                    )}
                    
                    {/* TIMBRE - Always show if field exists */}
                    {(reception.timbreActif !== undefined || reception.totaux?.timbre !== undefined) && (
                      <div>
                        <label className="text-xs text-gray-500">Timbre fiscal</label>
                        <p className="text-sm font-medium text-gray-900">
                          {reception.montantTimbre || 1.000} DT
                          {reception.timbreActif ? (
                            <span className="text-green-600 ml-2">(activé)</span>
                          ) : (
                            <span className="text-gray-500 ml-2">(non activé)</span>
                          )}
                          {(reception.totaux?.timbre !== undefined) && (
                            <span className="text-gray-600 ml-2">- {reception.totaux.timbre.toFixed(3)} DT</span>
                          )}
                        </p>
                      </div>
                    )}
                    
                    {/* TVA Rates */}
                    {reception.lignes && reception.lignes.length > 0 && (() => {
                      const tvaRates = Array.from(new Set(
                        reception.lignes
                          .filter((l: any) => l && l.tvaPct !== undefined && l.tvaPct !== null && l.tvaPct > 0)
                          .map((l: any) => l.tvaPct)
                          .filter((rate: any): rate is number => typeof rate === 'number' && rate > 0)
                      )).sort((a, b) => a - b);
                      
                      if (tvaRates.length > 0) {
                        return (
                          <div>
                            <label className="text-xs text-gray-500">Taux TVA appliqués</label>
                            <p className="text-sm font-medium text-gray-900">
                              {tvaRates.map((rate, idx) => (
                                <span key={idx}>
                                  {rate}%{idx < tvaRates.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}
          
          {reception.notes && (
            <div className="mt-4 pt-4 border-t">
              <label className="text-xs text-gray-500">Notes</label>
              <p className="text-sm text-gray-900 mt-1">{reception.notes}</p>
            </div>
          )}
        </div>

        {/* Lines Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-50 border-b-2 border-blue-200">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800 whitespace-nowrap">Réf</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Désignation</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Qté commandée</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Qté reçue</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-sm font-bold text-gray-800 whitespace-nowrap">Unité</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Prix HT</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Remise %</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">TVA %</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Total HT</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reception.lignes.map((line, index) => (
                  <tr key={index}>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{line.reference || '—'}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{line.designation || '—'}</td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">{line.qteCommandee || '—'}</td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">{line.qteRecue}</td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-center text-gray-900">{line.uom || 'PCE'}</td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">{line.prixUnitaireHT ? line.prixUnitaireHT.toFixed(3) : '—'}</td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {(line.remisePct !== undefined && line.remisePct !== null && line.remisePct > 0) 
                        ? `${Number(line.remisePct).toFixed(2)} %` 
                        : '—'}
                    </td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">{line.tvaPct ? `${line.tvaPct} %` : '—'}</td>
                    <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">{line.totalLigneHT ? line.totalLigneHT.toFixed(3) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                {(() => {
                  // Calculate remise amounts for display (same logic as backend)
                  let totalHTBeforeDiscount = 0;
                  let totalHTAfterLineDiscount = 0;
                  
                  reception.lignes.forEach((line) => {
                    if (line.prixUnitaireHT && line.qteRecue > 0) {
                      // Calculate before discount
                      const lineHTBeforeDiscount = line.prixUnitaireHT * line.qteRecue;
                      totalHTBeforeDiscount += lineHTBeforeDiscount;
                      
                      // Apply line remise if exists
                      let prixAvecRemise = line.prixUnitaireHT;
                      const remisePct = line.remisePct || 0;
                      if (remisePct > 0) {
                        prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
                      }
                      const ligneHT = prixAvecRemise * line.qteRecue;
                      totalHTAfterLineDiscount += ligneHT;
                    } else if (line.totalLigneHT !== undefined && line.totalLigneHT !== null) {
                      // Use stored totalLigneHT if available, but recalculate before discount
                      const lineHTBeforeDiscount = (line.prixUnitaireHT || 0) * (line.qteRecue || 0);
                      totalHTBeforeDiscount += lineHTBeforeDiscount;
                      totalHTAfterLineDiscount += line.totalLigneHT;
                    }
                  });
                  
                  const remiseFromLines = totalHTBeforeDiscount - totalHTAfterLineDiscount;
                  const remiseGlobalePct = reception.remiseGlobalePct || 0;
                  const remiseGlobale = remiseGlobalePct > 0 
                    ? totalHTAfterLineDiscount * (remiseGlobalePct / 100)
                    : 0;
                  
                  // Verify: totalHT should equal totalHTAfterLineDiscount - remiseGlobale
                  const calculatedTotalHT = totalHTAfterLineDiscount - remiseGlobale;
                  const actualTotalHT = reception.totaux.totalHT;
                  
                  // Use calculated values, but ensure they match totaux
                  const finalRemiseFromLines = Math.abs(remiseFromLines) > 0.001 ? remiseFromLines : 0;
                  const finalRemiseGlobale = Math.abs(remiseGlobale) > 0.001 ? remiseGlobale : 0;
                  
                  return (
                    <>
                      {finalRemiseFromLines > 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                            Remise lignes:
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-right text-sm font-bold text-red-600">
                            -{finalRemiseFromLines.toFixed(3)} DT
                          </td>
                        </tr>
                      )}
                      {finalRemiseGlobale > 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                            Remise globale ({remiseGlobalePct}%):
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-right text-sm font-bold text-red-600">
                            -{finalRemiseGlobale.toFixed(3)} DT
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
                <tr>
                  <td colSpan={9} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Total HT:
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {reception.totaux.totalHT.toFixed(3)} DT
                  </td>
                </tr>
                {/* Only show FODEC if active */}
                {reception.fodecActif && (
                  <tr>
                    <td colSpan={9} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                      FODEC ({reception.tauxFodec || 1}%):
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                      {(reception.totaux?.fodec || 0).toFixed(3)} DT
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={9} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                    Total TVA:
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                    {reception.totaux.totalTVA.toFixed(3)} DT
                  </td>
                </tr>
                {/* Always show TIMBRE if field exists */}
                {(reception.timbreActif !== undefined || reception.totaux?.timbre !== undefined) && (
                  <tr>
                    <td colSpan={9} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                      Timbre fiscal{reception.timbreActif ? '' : ' (non activé)'}:
                    </td>
                    <td className="px-2 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                      {(reception.totaux?.timbre || 0).toFixed(3)} DT
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={9} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-blue-600">
                    Total TTC:
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right text-sm font-bold text-blue-600">
                    {reception.totaux.totalTTC.toFixed(3)} DT
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-200">
            {reception.lignes.map((line, index) => (
              <div key={index} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {line.designation || '—'}
                    </div>
                    {line.reference && (
                      <div className="text-xs text-gray-500 mt-1">
                        Réf: {line.reference}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 text-right">
                    {line.qteRecue} {line.uom || 'PCE'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <div className="text-gray-500">Qté commandée</div>
                    <div className="font-medium">
                      {line.qteCommandee ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Prix HT</div>
                    <div className="font-medium">
                      {line.prixUnitaireHT
                        ? `${line.prixUnitaireHT.toFixed(3)} DT`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Remise %</div>
                    <div className="font-medium">
                      {line.remisePct && line.remisePct > 0
                        ? `${Number(line.remisePct).toFixed(2)} %`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">TVA %</div>
                    <div className="font-medium">
                      {line.tvaPct ? `${line.tvaPct} %` : '—'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500">Total HT</div>
                    <div className="font-semibold text-gray-900">
                      {line.totalLigneHT
                        ? `${line.totalLigneHT.toFixed(3)} DT`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {reception.statut === 'BROUILLON' && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push(`/purchases/receptions/${receptionId}/edit`)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
            >
              <PencilIcon className="w-5 h-5" />
              Modifier
            </button>
            <button
              onClick={handleValidate}
              disabled={validating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              <CheckIcon className="w-5 h-5" />
              {validating ? 'Validation...' : 'Valider'}
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
            >
              <XMarkIcon className="w-5 h-5" />
              {cancelling ? 'Annulation...' : 'Annuler'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm"
            >
              <TrashIcon className="w-5 h-5" />
              {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

