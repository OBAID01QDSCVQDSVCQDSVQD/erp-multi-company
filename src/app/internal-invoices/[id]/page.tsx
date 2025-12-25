'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { ArrowLeftIcon, PencilIcon, TrashIcon, ArrowDownTrayIcon, ArrowRightIcon, BanknotesIcon, XMarkIcon, ChatBubbleLeftEllipsisIcon, PhoneIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
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
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);

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
        setPaymentData(prev => ({ ...prev, montantPaye: roundedRemaining }));
        setPaymentAmountInput(
          roundedRemaining > 0 ? roundedRemaining.toFixed(3) : ''
        );
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
      setPaymentAmountInput(
        soldeRestantActuel > 0 ? soldeRestantActuel.toFixed(3) : ''
      );
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

  // WhatsApp Logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (clientSearchQuery.trim()) {
        setSearchingClients(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(clientSearchQuery)}&type=client`, {
            headers: { 'X-Tenant-Id': tenantId || '' }
          });
          if (res.ok) {
            const data = await res.json();
            setClientSearchResults(data.results || []);
          }
        } catch (error) {
          console.error("Error searching clients", error);
        } finally {
          setSearchingClients(false);
        }
      } else {
        setClientSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearchQuery, tenantId]);

  const handleOpenWhatsAppModal = async () => {
    if (!invoice) return;
    setWhatsAppNumber('');

    // Check if we have customer loaded
    // Invoice customerId can be object or string in this component
    let custId = '';
    let customerData = null;

    if (invoice.customerId) {
      if (typeof invoice.customerId === 'object' && invoice.customerId !== null) {
        // Already an object, but might not have phone. We might need to fetch full details if not present.
        // Based on previous code, it only populates basic fields. So let's fetch full details using ID.
        custId = (invoice.customerId as any)._id;
        customerData = invoice.customerId;
      } else if (typeof invoice.customerId === 'string') {
        custId = invoice.customerId;
      }
    }

    if (custId && tenantId) {
      try {
        const res = await fetch(`/api/customers/${custId}`, {
          headers: { 'X-Tenant-Id': tenantId }
        });
        if (res.ok) {
          const data = await res.json();
          let phone = data.mobile || data.telephone || '';
          let clean = phone.replace(/\D/g, '');
          if (clean.length === 8) clean = '216' + clean;
          setWhatsAppNumber(clean);
        }
      } catch (e) {
        console.error("Error fetching customer for whatsapp", e);
      }
    }

    setClientSearchQuery('');
    setClientSearchResults([]);
    setShowWhatsAppModal(true);
  };

  const confirmWhatsAppSend = async () => {
    if (!invoice || !whatsAppNumber) return;

    let numberToSend = whatsAppNumber.replace(/\D/g, '');
    if (numberToSend.length === 8) numberToSend = '216' + numberToSend;

    // Generate public link
    let publicLink = '';
    const toastId = toast.loading('Génération du lien...');

    try {
      const res = await fetch(`/api/internal-invoices/${invoice._id}/share`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        publicLink = `${window.location.origin}/i/${data.token}`;
      }
    } catch (e) {
      console.error("Error generating public link", e);
      toast.error("Erreur génération lien", { id: toastId });
    }

    // Determine customer name
    let customerName = 'Cher Client';
    if (invoice.customerId && typeof invoice.customerId === 'object') {
      const c = invoice.customerId as any;
      customerName = c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim() || 'Cher Client';
    }

    const companyName = 'notre société'; // We don't have company settings loaded here in this component? 
    // Actually we don't fetch company settings in this component currently.

    let message = `Bonjour ${customerName}, de la part de ${companyName} : Voici votre facture ${invoice.numero} du ${new Date(invoice.dateDoc).toLocaleDateString('fr-FR')} pour un montant de ${invoice.totalTTC.toFixed(3)} ${invoice.devise || 'TND'}.`;

    if (publicLink) {
      message += `\n\n📄 Télécharger votre document ici : ${publicLink}`;
    }

    const url = `https://api.whatsapp.com/send?phone=${numberToSend}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    toast.dismiss(toastId);
    setShowWhatsAppModal(false);
  };

  const fetchInvoice = async () => {
    try {
      if (!tenantId || !params?.id) return;

      const response = await fetch(`/api/internal-invoices/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });

      if (response.ok) {
        const data = await response.json();

        console.log('[Invoice Detail] Invoice data:', {
          customerId: data.customerId,
          customerIdType: typeof data.customerId,
          customerIdIsObject: typeof data.customerId === 'object' && data.customerId !== null
        });

        // If customerId is a string (not populated), fetch customer data
        if (data.customerId) {
          if (typeof data.customerId === 'string') {
            // customerId is a string, need to fetch customer data
            try {
              const customerResponse = await fetch(`/api/customers/${data.customerId}`, {
                headers: { 'X-Tenant-Id': tenantId }
              });
              if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                console.log('[Invoice Detail] Fetched customer data:', customerData);
                data.customerId = {
                  _id: customerData._id,
                  raisonSociale: customerData.raisonSociale,
                  nom: customerData.nom,
                  prenom: customerData.prenom
                };
              } else {
                console.warn('[Invoice Detail] Failed to fetch customer:', customerResponse.status);
              }
            } catch (customerError) {
              console.error('[Invoice Detail] Error fetching customer:', customerError);
            }
          } else if (typeof data.customerId === 'object' && data.customerId !== null) {
            // customerId is already populated
            console.log('[Invoice Detail] Customer already populated:', data.customerId);
          }
        } else {
          console.warn('[Invoice Detail] No customerId found in invoice');
        }

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

      // Check content type first
      const contentType = response.headers.get('content-type');

      // If it's a PDF, proceed even if status is not 200
      if (contentType?.includes('application/pdf')) {
        // It's a PDF, continue with download
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

  // Get customer name - handle both populated and non-populated customerId
  const customerName = (() => {
    if (!invoice?.customerId) {
      return 'Non spécifié';
    }

    // If customerId is an object (populated)
    if (typeof invoice.customerId === 'object' && invoice.customerId !== null) {
      const customer = invoice.customerId as { raisonSociale?: string; nom?: string; prenom?: string };
      if (customer.raisonSociale) {
        return customer.raisonSociale;
      }
      const fullName = `${customer.nom || ''} ${customer.prenom || ''}`.trim();
      return fullName || 'Non spécifié';
    }

    // If customerId is a string (not populated), we need to fetch it
    // For now, return a placeholder
    return 'Non spécifié';
  })();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          {/* Title Section */}
          <div className="flex items-start gap-3 sm:gap-4">
            <button
              onClick={() => router.push('/internal-invoices')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
              aria-label="Retour"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white break-words">
                Facture interne {invoice.numero}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
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
              <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="text-base">✓</span>
                <span className="hidden sm:inline">Convertie en facture officielle</span>
                <span className="sm:hidden">Convertie</span>
              </span>
            )}
          </div>

          {/* Conversion Info Banner */}
          {isConverted && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <BanknotesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base font-medium text-amber-900 dark:text-amber-300">
                    Facture convertie - Paiement via facture officielle
                  </p>
                  {convertedInvoiceInfo && (
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 mt-1">
                      Les paiements doivent être ajoutés via la facture officielle <span className="font-semibold">{convertedInvoiceInfo.numero}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions Section */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
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
                  <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    <BanknotesIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
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
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border-2 border-green-600 text-green-700 dark:text-green-400 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[140px]"
                >
                  <ArrowRightIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Convertir en facture officielle</span>
                  <span className="sm:hidden">Convertir</span>
                </button>
              )}

              <button
                onClick={handleOpenWhatsAppModal}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[120px]"
              >
                <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
                <span className="hidden sm:inline">WhatsApp</span>
                <span className="sm:hidden">WhatsApp</span>
              </button>

              <button
                onClick={() => router.push(`/internal-invoices?edit=${invoice._id}`)}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[110px]"
              >
                <PencilIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Modifier</span>
                <span className="sm:hidden">Modifier</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[100px]"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                <span>PDF</span>
              </button>

              <button
                onClick={handleDelete}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm sm:text-base font-medium flex-1 sm:flex-initial min-w-[110px]"
              >
                <TrashIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Supprimer</span>
                <span className="sm:hidden">Supprimer</span>
              </button>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Client</p>
              <p className="mt-2 text-base sm:text-lg font-semibold text-gray-900 dark:text-white break-words">{customerName}</p>
            </div>
            {invoice.projetId && (
              <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Projet</p>
                <Link
                  href={`/projects/${invoice.projetId._id}`}
                  className="mt-2 text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 break-words inline-block"
                >
                  {invoice.projetId.name}
                </Link>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">Total TTC</p>
              <p className="mt-2 text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {invoice.totalTTC?.toFixed(3)} {invoice.devise || 'TND'}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Détails de la facture</h2>
            </div>
            <div className="px-4 sm:px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">
                    {new Date(invoice.dateDoc).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                {invoice.dateEcheance && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Date d'échéance</p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">
                      {new Date(invoice.dateEcheance).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                )}
                {invoice.referenceExterne && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Référence externe</p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">{invoice.referenceExterne}</p>
                  </div>
                )}
                {invoice.modePaiement && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Mode de paiement</p>
                    <p className="mt-1 font-medium text-gray-900 dark:text-white">{invoice.modePaiement}</p>
                  </div>
                )}
              </div>
              {invoice.conditionsPaiement && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Conditions de paiement</p>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Lignes de facture</h2>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Désignation
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Qté
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Prix unitaire HT
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Remise
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      TVA
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total HT
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {invoice.lignes && invoice.lignes.length > 0 ? (
                    invoice.lignes.map((line, index) => {
                      const remise = line.remisePct || 0;
                      const prixHT = line.prixUnitaireHT * (1 - remise / 100);
                      const montantHT = prixHT * line.quantite;
                      const tvaPct = line.tvaPct || 0;

                      return (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                            {line.designation}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">
                            {line.quantite} {line.uomCode || ''}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">
                            {line.prixUnitaireHT.toFixed(3)} {invoice.devise || 'TND'}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">
                            {remise > 0 ? `${remise}%` : '-'}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 text-right">
                            {tvaPct > 0 ? `${tvaPct}%` : '-'}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                            {montantHT.toFixed(3)} {invoice.devise || 'TND'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        Aucune ligne de facture
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {invoice.lignes && invoice.lignes.length > 0 ? (
                invoice.lignes.map((line, index) => {
                  const remise = line.remisePct || 0;
                  const prixHT = line.prixUnitaireHT * (1 - remise / 100);
                  const montantHT = prixHT * line.quantite;
                  const tvaPct = line.tvaPct || 0;

                  return (
                    <div key={index} className="px-4 py-4 space-y-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{line.designation}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Quantité</p>
                          <p className="font-medium text-gray-900 dark:text-white">{line.quantite} {line.uomCode || ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-500 dark:text-gray-400">Prix unitaire HT</p>
                          <p className="font-medium text-gray-900 dark:text-white">{line.prixUnitaireHT.toFixed(3)} {invoice.devise || 'TND'}</p>
                        </div>
                        {remise > 0 && (
                          <div>
                            <p className="text-gray-500 dark:text-gray-400">Remise</p>
                            <p className="font-medium text-gray-900 dark:text-white">{remise}%</p>
                          </div>
                        )}
                        {tvaPct > 0 && (
                          <div className="text-right">
                            <p className="text-gray-500 dark:text-gray-400">TVA</p>
                            <p className="font-medium text-gray-900 dark:text-white">{tvaPct}%</p>
                          </div>
                        )}
                        <div className="col-span-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total HT</p>
                            <p className="text-base font-semibold text-gray-900 dark:text-white">
                              {montantHT.toFixed(3)} {invoice.devise || 'TND'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucune ligne de facture
                </div>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Totaux</h2>
            </div>
            <div className="px-4 sm:px-6 py-4 sm:py-5">
              <div className="space-y-2.5 sm:space-y-3 max-w-md ml-auto">
                {invoice.remiseGlobalePct && invoice.remiseGlobalePct > 0 && (
                  <div className="flex justify-between items-center text-sm sm:text-base">
                    <span className="text-gray-600 dark:text-gray-400">Remise globale:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{invoice.remiseGlobalePct}%</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="text-gray-600 dark:text-gray-400">Total HT:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {invoice.totalBaseHT?.toFixed(3)} {invoice.devise || 'TND'}
                  </span>
                </div>
                {invoice.fodec && invoice.fodec.enabled && invoice.fodec.montant && (
                  <div className="flex justify-between items-center text-sm sm:text-base">
                    <span className="text-gray-600 dark:text-gray-400">FODEC:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {invoice.fodec.montant.toFixed(3)} {invoice.devise || 'TND'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm sm:text-base">
                  <span className="text-gray-600 dark:text-gray-400">Total TVA:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {invoice.totalTVA?.toFixed(3)} {invoice.devise || 'TND'}
                  </span>
                </div>
                {invoice.timbreFiscal && invoice.timbreFiscal > 0 && (
                  <div className="flex justify-between items-center text-sm sm:text-base">
                    <span className="text-gray-600 dark:text-gray-400">Timbre fiscal:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {invoice.timbreFiscal.toFixed(3)} {invoice.devise || 'TND'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-base sm:text-lg pt-3 border-t-2 border-gray-300 dark:border-gray-600 mt-3">
                  <span className="font-bold text-gray-900 dark:text-white">Total TTC:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {invoice.totalTTC?.toFixed(3)} {invoice.devise || 'TND'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Modal */}
          {showPaymentModal && invoice && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ajouter un paiement</h2>
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
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">
                          Solde avance disponible:
                        </span>
                        <span className="text-lg font-bold text-green-700 dark:text-green-400">
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
                              setPaymentAmountInput(advanceToUse.toFixed(3));
                              return { ...prev, useAdvance: true, montantPaye: advanceToUse };
                            } else {
                              setPaymentAmountInput(
                                soldeRestantActuel > 0
                                  ? soldeRestantActuel.toFixed(3)
                                  : ''
                              );
                              return { ...prev, useAdvance: false, montantPaye: soldeRestantActuel };
                            }
                          });
                        }}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                      />
                      <label htmlFor="useAdvance" className="ml-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        Utiliser l'avance disponible
                      </label>
                    </div>
                  )}

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date de paiement *
                    </label>
                    <input
                      type="date"
                      value={paymentData.datePaiement}
                      onChange={(e) => setPaymentData({ ...paymentData, datePaiement: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* Payment Method */}
                  {!paymentData.useAdvance && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mode de paiement *
                      </label>
                      <select
                        value={paymentData.modePaiement}
                        onChange={(e) => setPaymentData({ ...paymentData, modePaiement: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Référence
                      </label>
                      <input
                        type="text"
                        value={paymentData.reference}
                        onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                        placeholder="N° de chèque, référence virement, etc."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                  )}

                  {/* Amount to Pay */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Montant à payer *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentAmountInput}
                      onChange={(e) => {
                        if (paymentData.useAdvance) {
                          return;
                        }
                        const raw = e.target.value;
                        setPaymentAmountInput(raw);
                        if (raw.trim() === '') {
                          setPaymentData({ ...paymentData, montantPaye: 0 });
                          return;
                        }
                        // نقبل فاصلة أو نقطة كفاصل عشري
                        const normalized = raw.replace(',', '.');
                        const parsed = Number(normalized);
                        if (isNaN(parsed)) {
                          // لا نحدّث القيمة العددية إذا النص غير صالح، لكن نتركه يكتب
                          return;
                        }
                        const remaining =
                          soldeRestantActuel > 0
                            ? soldeRestantActuel
                            : invoice.totalTTC;
                        const roundedValue =
                          Math.round(parsed * 1000) / 1000;
                        const clamped = Math.min(
                          Math.max(0, roundedValue),
                          remaining
                        );
                        setPaymentData({
                          ...paymentData,
                          montantPaye: clamped,
                        });
                      }}
                      onBlur={(e) => {
                        if (
                          paymentData.useAdvance &&
                          advanceBalance > 0 &&
                          soldeRestantActuel > 0
                        ) {
                          const advanceToUse = Math.min(
                            advanceBalance,
                            soldeRestantActuel
                          );
                          const roundedAdvance =
                            Math.round(advanceToUse * 1000) / 1000;
                          setPaymentData({
                            ...paymentData,
                            montantPaye: roundedAdvance,
                          });
                          setPaymentAmountInput(roundedAdvance.toFixed(3));
                          return;
                        }
                        const normalized = e.target.value.replace(',', '.');
                        const parsed = Number(normalized) || 0;
                        const rounded =
                          Math.round(parsed * 1000) / 1000;
                        const remaining =
                          soldeRestantActuel > 0
                            ? soldeRestantActuel
                            : invoice.totalTTC;
                        const clamped = Math.min(rounded, remaining);
                        setPaymentData({
                          ...paymentData,
                          montantPaye: clamped,
                        });
                        setPaymentAmountInput(
                          clamped > 0 ? clamped.toFixed(3) : ''
                        );
                      }}
                      disabled={paymentData.useAdvance}
                      readOnly={paymentData.useAdvance}
                      placeholder="0.000"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed placeholder-gray-400 dark:placeholder-gray-500"
                      required
                    />
                    {paymentData.useAdvance && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Le montant est automatiquement défini depuis l'avance disponible
                      </p>
                    )}
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Solde restant: <span className="font-medium text-gray-900 dark:text-white">{soldeRestantActuel.toFixed(3)} {invoice.devise}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={paymentData.notes}
                      onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder="Notes supplémentaires..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
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
                      setPaymentAmountInput('');
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
      </div>

      {/* WhatsApp Modal */}
      {
        showWhatsAppModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowWhatsAppModal(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={() => setShowWhatsAppModal(false)}
                  >
                    <span className="sr-only">Fermer</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                    <ChatBubbleLeftEllipsisIcon className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                      Envoyer par WhatsApp
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Confirmez le numéro ou recherchez un autre client.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="wa-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Numéro de téléphone
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <PhoneIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </div>
                      <input
                        type="text"
                        name="wa-number"
                        id="wa-number"
                        className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                        placeholder="216..."
                        value={whatsAppNumber}
                        onChange={(e) => setWhatsAppNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OU RECHERCHER UN CLIENT</span>
                    <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                  </div>

                  <div className="relative">
                    <label htmlFor="search-client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Rechercher un autre client
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                      </div>
                      <input
                        type="text"
                        id="search-client"
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                        placeholder="Nom du client..."
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        autoComplete="off"
                      />
                      {searchingClients && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                        </div>
                      )}
                    </div>

                    {clientSearchResults.length > 0 && (
                      <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                        {clientSearchResults.map((client) => (
                          <li
                            key={client._id}
                            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                const res = await fetch(`/api/customers/${client._id}`, { headers: { 'X-Tenant-Id': tenantId || '' } });
                                if (res.ok) {
                                  const data = await res.json();
                                  const phone = data.mobile || data.telephone || '';
                                  let clean = phone.replace(/\D/g, '');
                                  if (clean.length === 8) clean = '216' + clean;

                                  if (clean) {
                                    setWhatsAppNumber(clean);
                                    setClientSearchQuery('');
                                    setClientSearchResults([]);
                                  } else {
                                    toast.error(`Aucun numéro trouvé pour ${client.title}`);
                                  }
                                }
                              } catch (err) {
                                console.error(err);
                                toast.error("Erreur lors de la récupération du numéro");
                              }
                            }}
                          >
                            <div className="flex items-center">
                              <span className="font-medium block truncate text-gray-900 dark:text-white">
                                {client.title}
                              </span>
                            </div>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                              {client.subtitle}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                    onClick={confirmWhatsAppSend}
                  >
                    Envoyer
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    onClick={() => setShowWhatsAppModal(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </DashboardLayout >
  );
}

