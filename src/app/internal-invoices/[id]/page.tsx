'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { ArrowLeftIcon, PencilIcon, TrashIcon, ArrowDownTrayIcon, ArrowRightIcon, BanknotesIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [montantRestant, setMontantRestant] = useState<number>(0);
  const [soldeRestantActuel, setSoldeRestantActuel] = useState<number>(0);
  const [paymentData, setPaymentData] = useState({
    datePaiement: new Date().toISOString().split('T')[0],
    modePaiement: 'Espèces',
    reference: '',
    notes: '',
    montantPaye: 0,
    useAdvance: false,
    advanceAmount: 0,
  });

  useEffect(() => {
    if (params?.id && tenantId) {
      fetchInvoice();
    }
  }, [params?.id, tenantId]);

  // Calculate remaining amount when invoice is loaded
  useEffect(() => {
    if (invoice && tenantId && invoice.customerId) {
      calculateRemainingAmount().then(remaining => {
        // Store the current remaining balance
        const roundedRemaining = Math.max(0, Math.round(remaining * 1000) / 1000);
        setSoldeRestantActuel(roundedRemaining);
        setMontantRestant(roundedRemaining);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, tenantId]);

  // When payment modal opens, fetch advance balance and set payment amount
  // BUT: If invoice is converted, prevent opening the modal
  useEffect(() => {
    if (showPaymentModal && invoice && isConverted) {
      // Invoice is converted, close the modal and show message
      setShowPaymentModal(false);
      toast('Cette facture a été convertie en facture officielle. Les paiements doivent être ajoutés via la facture officielle.', { icon: 'ℹ️' });
      return;
    }
    if (showPaymentModal && invoice && tenantId && invoice.customerId && soldeRestantActuel > 0 && !isConverted) {
      fetchAdvanceBalance();
      // Set payment amount to remaining balance
      setPaymentData(prev => ({
        ...prev,
        montantPaye: soldeRestantActuel
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaymentModal, isConverted]);

  // Update montantPaye when useAdvance or advanceBalance changes
  useEffect(() => {
    if (showPaymentModal && invoice && paymentData.useAdvance && advanceBalance > 0 && soldeRestantActuel > 0) {
      const advanceToUse = Math.min(advanceBalance, soldeRestantActuel);
      const roundedAdvance = Math.round(advanceToUse * 1000) / 1000;
      setPaymentData(prev => {
        if (prev.useAdvance && Math.abs(prev.montantPaye - roundedAdvance) > 0.001) {
          return { ...prev, montantPaye: roundedAdvance };
        }
        return prev;
      });
    }
  }, [showPaymentModal, paymentData.useAdvance, advanceBalance, soldeRestantActuel]);

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
      toast.loading('Génération du PDF en cours...', { id: 'pdf-download' });
      
      const response = await fetch(`/api/internal-invoices/${invoice._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture-Interne-${invoice.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF téléchargé avec succès', { id: 'pdf-download' });
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Erreur lors du téléchargement du PDF', { id: 'pdf-download' });
    }
  };

  async function fetchAdvanceBalance() {
    if (!invoice || !tenantId || !invoice.customerId) return;
    setLoadingBalance(true);
    try {
      const customerId = typeof invoice.customerId === 'object' ? invoice.customerId._id : invoice.customerId;
      const response = await fetch(`/api/customers/${customerId}/balance`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        const netAdvanceBalance = data.netAdvanceBalance || 0;
        if (netAdvanceBalance > 0) {
          setAdvanceBalance(netAdvanceBalance);
        } else {
          setAdvanceBalance(0);
        }
      } else {
        setAdvanceBalance(0);
      }
    } catch (error) {
      console.error('Error fetching advance balance:', error);
      setAdvanceBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  }

  async function calculateRemainingAmount(): Promise<number> {
    if (!invoice || !tenantId || !invoice.customerId) return 0;
    try {
      const customerId = typeof invoice.customerId === 'object' ? invoice.customerId._id : invoice.customerId;
      const response = await fetch(`/api/sales/payments/unpaid-invoices?customerId=${customerId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const invoices = await response.json();
        const invoiceData = invoices.find((inv: any) => inv._id === invoice._id);
        if (invoiceData) {
          // Return the remaining balance, ensuring it's not negative
          const remaining = Math.max(0, invoiceData.soldeRestant || 0);
          console.log(`Invoice ${invoice.numero} remaining balance: ${remaining}`);
          return remaining;
        } else {
          // Invoice not in unpaid list means it's fully paid
          console.log(`Invoice ${invoice.numero} is fully paid (not in unpaid list)`);
          return 0;
        }
      }
    } catch (error) {
      console.error('Error calculating remaining amount:', error);
    }
    // Fallback: assume invoice is unpaid and return totalTTC
    // But this should not happen if API is working correctly
    console.warn(`Could not calculate remaining amount for invoice ${invoice.numero}, using totalTTC as fallback`);
    return invoice.totalTTC || 0;
  }

  async function handleSavePayment() {
    if (!invoice || !tenantId || !invoice.customerId) return;

    const remaining = await calculateRemainingAmount();
    const totalToPay = paymentData.montantPaye;
    
    if (totalToPay <= 0) {
      toast.error('Le montant payé doit être supérieur à zéro');
      return;
    }

    // Allow payment if amount is equal to or less than remaining balance
    const roundedTotalToPay = Math.round(totalToPay * 1000) / 1000;
    const roundedRemaining = Math.round(remaining * 1000) / 1000;
    
    if (roundedTotalToPay > roundedRemaining) {
      toast.error(`Le montant payé (${roundedTotalToPay.toFixed(3)}) ne peut pas être supérieur au solde restant (${roundedRemaining.toFixed(3)})`);
      return;
    }

    // Validate and calculate advance usage
    let advanceToUse = 0;
    if (paymentData.useAdvance) {
      advanceToUse = Math.min(advanceBalance, remaining);
      if (advanceToUse <= 0) {
        toast.error('Le solde avance disponible est insuffisant');
        return;
      }
      if (roundedTotalToPay > roundedRemaining) {
        toast.error(`Le montant payé (${roundedTotalToPay.toFixed(3)}) ne peut pas être supérieur au solde restant (${roundedRemaining.toFixed(3)})`);
        return;
      }
      if (Math.abs(roundedTotalToPay - advanceToUse) > 0.001) {
        toast.error(`Le montant à payer (${roundedTotalToPay.toFixed(3)}) doit correspondre au montant disponible (${advanceToUse.toFixed(3)})`);
        return;
      }
    }

    setSavingPayment(true);
    try {
      const customerId = typeof invoice.customerId === 'object' ? invoice.customerId._id : invoice.customerId;
      const paymentAmount = paymentData.useAdvance ? advanceToUse : totalToPay;
      
      const paymentPayload: any = {
        customerId: customerId,
        datePaiement: paymentData.datePaiement,
        modePaiement: paymentData.useAdvance ? 'Avance' : paymentData.modePaiement,
        reference: paymentData.reference,
        notes: paymentData.notes + (paymentData.useAdvance ? ` (Utilisation avance: ${advanceToUse.toFixed(3)} ${invoice.devise})` : ''),
        lignes: [{
          factureId: invoice._id,
          numeroFacture: invoice.numero,
          referenceExterne: invoice.referenceExterne || invoice.numero,
          montantFacture: invoice.totalTTC,
          montantPayeAvant: invoice.totalTTC - remaining,
          montantPaye: paymentAmount,
          soldeRestant: remaining - paymentAmount,
          isPaymentOnAccount: false,
        }],
        useAdvanceBalance: paymentData.useAdvance,
        advanceAmount: advanceToUse,
        currentAdvanceBalance: advanceBalance,
      };

      const response = await fetch('/api/sales/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(paymentPayload),
      });

      if (response.ok) {
        if (paymentData.useAdvance && advanceToUse > 0) {
          const remainingAdvance = advanceBalance - advanceToUse;
          if (remainingAdvance > 0.001) {
            toast.success(
              `Paiement de ${advanceToUse.toFixed(3)} ${invoice.devise} enregistré depuis l'avance disponible. ` +
              `Reste ${remainingAdvance.toFixed(3)} ${invoice.devise} en avance sur compte.`
            );
          } else {
            toast.success(`Paiement de ${advanceToUse.toFixed(3)} ${invoice.devise} enregistré depuis l'avance disponible`);
          }
        } else {
          toast.success('Paiement ajouté avec succès');
        }
        
        setShowPaymentModal(false);
        await fetchInvoice();
        // Refresh advance balance after payment
        await fetchAdvanceBalance();
        setPaymentData({
          datePaiement: new Date().toISOString().split('T')[0],
          modePaiement: 'Espèces',
          reference: '',
          notes: '',
          montantPaye: 0,
          useAdvance: false,
          advanceAmount: 0,
        });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de l\'ajout du paiement');
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error('Erreur lors de l\'ajout du paiement');
    } finally {
      setSavingPayment(false);
    }
  }

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
        <div className="space-y-4">
          {/* Title Section */}
          <div className="flex items-start gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/internal-invoices')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
              aria-label="Retour"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">
                Facture interne {invoice.numero}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Créée le {new Date(invoice.dateDoc).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Status Badges Row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {invoice.statut && (
              <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${statutColors[invoice.statut] || statutColors.BROUILLON}`}>
                {statutLabels[invoice.statut] || invoice.statut}
              </span>
            )}
            {isConverted && (
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                <span className="text-base">✓</span>
                <span className="hidden sm:inline">Convertie en facture officielle</span>
                <span className="sm:hidden">Convertie</span>
              </span>
            )}
          </div>

          {/* Conversion Info Banner */}
          {isConverted && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <BanknotesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-medium text-amber-900">
                    Facture convertie - Paiement via facture officielle
                  </p>
                  {convertedInvoiceInfo && (
                    <p className="text-xs sm:text-sm text-amber-700 mt-1">
                      Les paiements doivent être ajoutés via la facture officielle <span className="font-semibold">{convertedInvoiceInfo.numero}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions Section */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2 border-t border-gray-200">
            {/* Payment Button (Left) */}
            {invoice.customerId && !isConverted && (
              <div className="flex-shrink-0">
                {soldeRestantActuel > 0.001 ? (
                  <button
                    onClick={() => {
                      if (soldeRestantActuel > 0.001) {
                        setShowPaymentModal(true);
                      } else {
                        toast('Cette facture est déjà payée en totalité', { icon: 'ℹ️' });
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base font-medium shadow-sm w-full sm:w-auto"
                  >
                    <BanknotesIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Ajouter paiement</span>
                    <span className="sm:hidden">Ajouter paiement</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm sm:text-base text-gray-600">
                    <BanknotesIcon className="w-5 h-5 text-gray-400" />
                    <span>Facture payée</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons Group (Right) */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {isConverted && convertedInvoiceInfo && (
                <button
                  onClick={() => router.push(`/sales/invoices/${convertedInvoiceInfo.id}`)}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm sm:text-base font-medium shadow-sm flex-1 sm:flex-initial min-w-[140px] sm:min-w-[180px]"
                >
                  <ArrowRightIcon className="w-5 h-5" />
                  <span className="hidden lg:inline">Voir la facture officielle</span>
                  <span className="hidden sm:inline lg:hidden">Voir facture officielle</span>
                  <span className="sm:hidden">Voir</span>
                  <span className="hidden xl:inline ml-1 text-xs">({convertedInvoiceInfo.numero})</span>
                </button>
              )}
              
              {!isConverted && (
                <button
                  onClick={handleConvertToOfficial}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border-2 border-green-600 text-green-700 bg-white hover:bg-green-50 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[140px]"
                >
                  <ArrowRightIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Convertir en facture officielle</span>
                  <span className="sm:hidden">Convertir</span>
                </button>
              )}
              
              <button
                onClick={() => router.push(`/internal-invoices?edit=${invoice._id}`)}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[110px]"
              >
                <PencilIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Modifier</span>
                <span className="sm:hidden">Modifier</span>
              </button>
              
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[100px]"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                <span>PDF</span>
              </button>
              
              <button
                onClick={handleDelete}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[110px]"
              >
                <TrashIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Supprimer</span>
                <span className="sm:hidden">Supprimer</span>
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-500 font-medium">Client</p>
            <p className="mt-2 text-base sm:text-lg font-semibold text-gray-900 break-words">{customerName}</p>
          </div>
          {invoice.projetId && (
            <div className="bg-white p-4 sm:p-5 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-500 font-medium">Projet</p>
              <Link
                href={`/projects/${invoice.projetId._id}`}
                className="mt-2 text-base sm:text-lg font-semibold text-blue-600 hover:text-blue-700 break-words inline-block"
              >
                {invoice.projetId.name}
              </Link>
            </div>
          )}
          <div className="bg-white p-4 sm:p-5 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-500 font-medium">Total TTC</p>
            <p className="mt-2 text-base sm:text-lg font-semibold text-gray-900">
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Lignes de facture</h2>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Désignation
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Qté
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix unitaire HT
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remise
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TVA
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                          {line.designation}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {line.quantite} {line.uomCode || ''}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {line.prixUnitaireHT.toFixed(3)} {invoice.devise || 'TND'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {remise > 0 ? `${remise}%` : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {tvaPct > 0 ? `${tvaPct}%` : '-'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                          {montantHT.toFixed(3)} {invoice.devise || 'TND'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                      Aucune ligne de facture
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-200">
            {invoice.lignes && invoice.lignes.length > 0 ? (
              invoice.lignes.map((line, index) => {
                const remise = line.remisePct || 0;
                const prixHT = line.prixUnitaireHT * (1 - remise / 100);
                const montantHT = prixHT * line.quantite;
                const tvaPct = line.tvaPct || 0;
                
                return (
                  <div key={index} className="px-4 py-4 space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{line.designation}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500">Quantité</p>
                        <p className="font-medium text-gray-900">{line.quantite} {line.uomCode || ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">Prix unitaire HT</p>
                        <p className="font-medium text-gray-900">{line.prixUnitaireHT.toFixed(3)} {invoice.devise || 'TND'}</p>
                      </div>
                      {remise > 0 && (
                        <div>
                          <p className="text-gray-500">Remise</p>
                          <p className="font-medium text-gray-900">{remise}%</p>
                        </div>
                      )}
                      {tvaPct > 0 && (
                        <div className="text-right">
                          <p className="text-gray-500">TVA</p>
                          <p className="font-medium text-gray-900">{tvaPct}%</p>
                        </div>
                      )}
                      <div className="col-span-2 pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-500">Total HT</p>
                          <p className="text-base font-semibold text-gray-900">
                            {montantHT.toFixed(3)} {invoice.devise || 'TND'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                Aucune ligne de facture
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Totaux</h2>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-5">
            <div className="space-y-2.5 sm:space-y-3 max-w-md ml-auto">
              {invoice.remiseGlobalePct && invoice.remiseGlobalePct > 0 && (
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="text-gray-600">Remise globale:</span>
                  <span className="font-medium text-gray-900">{invoice.remiseGlobalePct}%</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-600">Total HT:</span>
                <span className="font-medium text-gray-900">
                  {invoice.totalBaseHT?.toFixed(3)} {invoice.devise || 'TND'}
                </span>
              </div>
              {invoice.fodec && invoice.fodec.enabled && invoice.fodec.montant && (
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="text-gray-600">FODEC:</span>
                  <span className="font-medium text-gray-900">
                    {invoice.fodec.montant.toFixed(3)} {invoice.devise || 'TND'}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm sm:text-base">
                <span className="text-gray-600">Total TVA:</span>
                <span className="font-medium text-gray-900">
                  {invoice.totalTVA?.toFixed(3)} {invoice.devise || 'TND'}
                </span>
              </div>
              {invoice.timbreFiscal && invoice.timbreFiscal > 0 && (
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="text-gray-600">Timbre fiscal:</span>
                  <span className="font-medium text-gray-900">
                    {invoice.timbreFiscal.toFixed(3)} {invoice.devise || 'TND'}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-base sm:text-lg pt-3 border-t-2 border-gray-300 mt-3">
                <span className="font-bold text-gray-900">Total TTC:</span>
                <span className="font-bold text-blue-600">
                  {invoice.totalTTC?.toFixed(3)} {invoice.devise || 'TND'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && invoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold">Ajouter un paiement</h2>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentData({
                      datePaiement: new Date().toISOString().split('T')[0],
                      modePaiement: 'Espèces',
                      reference: '',
                      notes: '',
                      montantPaye: 0,
                      useAdvance: false,
                      advanceAmount: 0,
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Advance Balance Info */}
                {advanceBalance > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">
                        Solde avance disponible:
                      </span>
                      <span className="text-lg font-bold text-green-700">
                        {advanceBalance.toFixed(3)} {invoice.devise}
                      </span>
                    </div>
                  </div>
                )}

                {/* Use Advance Checkbox */}
                {advanceBalance > 0 && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="useAdvance"
                      checked={paymentData.useAdvance}
                      onChange={(e) => {
                        const useAdvance = e.target.checked;
                        setPaymentData(prev => {
                          if (useAdvance) {
                            const advanceToUse = Math.min(advanceBalance, soldeRestantActuel);
                            return { ...prev, useAdvance: true, montantPaye: advanceToUse };
                          } else {
                            return { ...prev, useAdvance: false, montantPaye: soldeRestantActuel };
                          }
                        });
                      }}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="useAdvance" className="ml-2 text-sm text-gray-700">
                      Utiliser l'avance disponible
                    </label>
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de paiement *
                  </label>
                  <input
                    type="date"
                    value={paymentData.datePaiement}
                    onChange={(e) => setPaymentData({ ...paymentData, datePaiement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                {/* Payment Method */}
                {!paymentData.useAdvance && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mode de paiement *
                    </label>
                    <select
                      value={paymentData.modePaiement}
                      onChange={(e) => setPaymentData({ ...paymentData, modePaiement: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="Espèces">Espèces</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Virement">Virement</option>
                      <option value="Carte">Carte</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                )}

                {/* Reference */}
                {!paymentData.useAdvance && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Référence
                    </label>
                    <input
                      type="text"
                      value={paymentData.reference}
                      onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                      placeholder="N° de chèque, référence virement, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Amount to Pay */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Montant à payer *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max={soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totalTTC}
                    value={paymentData.montantPaye > 0 ? paymentData.montantPaye.toFixed(3) : ''}
                    onChange={(e) => {
                      if (paymentData.useAdvance) {
                        return;
                      }
                      const inputValue = e.target.value;
                      if (inputValue === '') {
                        setPaymentData({ ...paymentData, montantPaye: 0 });
                        return;
                      }
                      const value = parseFloat(inputValue) || 0;
                      const remaining = soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totalTTC;
                      const roundedValue = Math.round(value * 1000) / 1000;
                      setPaymentData({ ...paymentData, montantPaye: Math.min(Math.max(0, roundedValue), remaining) });
                    }}
                    onBlur={(e) => {
                      if (paymentData.useAdvance && advanceBalance > 0 && soldeRestantActuel > 0) {
                        const advanceToUse = Math.min(advanceBalance, soldeRestantActuel);
                        const roundedAdvance = Math.round(advanceToUse * 1000) / 1000;
                        setPaymentData({ ...paymentData, montantPaye: roundedAdvance });
                        return;
                      }
                      const value = parseFloat(e.target.value) || 0;
                      const rounded = Math.round(value * 1000) / 1000;
                      const remaining = soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totalTTC;
                      setPaymentData({ ...paymentData, montantPaye: Math.min(rounded, remaining) });
                    }}
                    disabled={paymentData.useAdvance}
                    readOnly={paymentData.useAdvance}
                    placeholder="0.000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  />
                  {paymentData.useAdvance && (
                    <p className="mt-1 text-sm text-gray-500">
                      Le montant est automatiquement défini depuis l'avance disponible
                    </p>
                  )}
                  <div className="mt-1 text-sm text-gray-600">
                    Solde restant: <span className="font-medium">{soldeRestantActuel.toFixed(3)} {invoice.devise}</span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Notes supplémentaires..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentData({
                      datePaiement: new Date().toISOString().split('T')[0],
                      modePaiement: 'Espèces',
                      reference: '',
                      notes: '',
                      montantPaye: 0,
                      useAdvance: false,
                      advanceAmount: 0,
                    });
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSavePayment}
                  disabled={savingPayment || paymentData.montantPaye <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPayment ? 'Enregistrement...' : 'Enregistrer le paiement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

