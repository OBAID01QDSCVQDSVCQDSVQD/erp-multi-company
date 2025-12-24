'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { DocumentTextIcon, ArrowLeftIcon, ArrowDownTrayIcon, BanknotesIcon, XMarkIcon, ChatBubbleLeftEllipsisIcon, MagnifyingGlassIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Invoice {
  _id: string;
  numero: string;
  referenceExterne?: string;
  dateDoc: string;
  customerId?: string;
  dateEcheance?: string;
  modePaiement?: string;
  conditionsPaiement?: string;
  totalTTC: number;
  totalBaseHT?: number;
  totalHT?: number;
  totalTVA: number;
  timbreFiscal?: number;
  fodec?: {
    enabled?: boolean;
    tauxPct?: number;
    montant?: number;
  };
  remiseGlobalePct?: number;
  devise?: string;
  lignes?: any[];
  linkedDocuments?: string[]; // Array of linked document IDs (e.g., internal invoice ID)
}

export default function ViewInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [montantRestant, setMontantRestant] = useState<number>(0);
  const [soldeRestantActuel, setSoldeRestantActuel] = useState<number>(0);
  const [isConvertedFromPaidInternal, setIsConvertedFromPaidInternal] = useState(false);
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
    if (tenantId && params.id) {
      fetchInvoice();
      fetchCompanySettings();
    }
  }, [tenantId, params.id]);

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
  useEffect(() => {
    if (showPaymentModal && invoice && tenantId && invoice.customerId && soldeRestantActuel > 0) {
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
  }, [showPaymentModal, soldeRestantActuel]);

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
      setPaymentAmountInput(roundedAdvance.toFixed(3));
    }
  }, [showPaymentModal, paymentData.useAdvance, advanceBalance, soldeRestantActuel]);

  // Search clients for WhatsApp modal
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!clientSearchQuery || clientSearchQuery.length < 2) {
        setClientSearchResults([]);
        return;
      }

      setSearchingClients(true);
      try {
        // Use the existing search API
        const response = await fetch(`/api/search?q=${encodeURIComponent(clientSearchQuery)}&limit=5`, {
          headers: { 'X-Tenant-Id': tenantId || '' }
        });
        if (response.ok) {
          const data = await response.json();
          // Filter to only show Clients
          const clients = data.filter((item: any) => item.type === 'Client');
          setClientSearchResults(clients);
        }
      } catch (error) {
        console.error('Error searching clients:', error);
      } finally {
        setSearchingClients(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearchQuery, tenantId]);

  const fetchInvoice = async () => {
    try {
      if (!tenantId) {
        console.error('No tenantId found');
        return;
      }
      setLoading(true);
      const response = await fetch(`/api/sales/invoices/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);

        // Fetch customer if customerId exists
        if (data.customerId) {
          fetchCustomer(data.customerId);

          // Calculate remaining amount to pay
          try {
            const unpaidResponse = await fetch(`/api/sales/payments/unpaid-invoices?customerId=${data.customerId}`, {
              headers: { 'X-Tenant-Id': tenantId },
            });
            if (unpaidResponse.ok) {
              const unpaidInvoices = await unpaidResponse.json();
              const invoiceData = unpaidInvoices.find((inv: any) => inv._id === params.id);
              const remaining = invoiceData ? (invoiceData.soldeRestant || 0) : 0;
              const roundedRemaining = Math.max(0, Math.round(remaining * 1000) / 1000);
              setMontantRestant(roundedRemaining);
              setSoldeRestantActuel(roundedRemaining);

              // If invoice is not in unpaid list, it means it's fully paid
              // Check if it was converted from an internal invoice
              if (!invoiceData && data.linkedDocuments && data.linkedDocuments.length > 0) {
                setIsConvertedFromPaidInternal(true);
              }
            }
          } catch (error) {
            console.error('Error fetching remaining amount:', error);
            // Default to total TTC if we can't fetch the remaining amount
            setMontantRestant(data.totalTTC || 0);
          }
        }
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast.error('Erreur lors du chargement de la facture: ' + (errorData.error || 'Unknown'));
        router.push('/sales/invoices');
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      toast.error('Erreur lors du chargement de la facture');
      router.push('/sales/invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomer = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomer(data);
      }
    } catch (err) {
      console.error('Error fetching customer:', err);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const settings = await response.json();
        setCompanySettings(settings);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;

    try {
      setGeneratingPDF(true);

      const response = await fetch(`/api/sales/invoices/${invoice._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture-${invoice.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF téléchargé avec succès');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Erreur lors du téléchargement du PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  async function fetchAdvanceBalance() {
    if (!invoice || !tenantId || !invoice.customerId) return;
    setLoadingBalance(true);
    try {
      const response = await fetch(`/api/customers/${invoice.customerId}/balance`, {
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
      const response = await fetch(`/api/sales/payments/unpaid-invoices?customerId=${invoice.customerId}`, {
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
      const paymentAmount = paymentData.useAdvance ? advanceToUse : totalToPay;

      const paymentPayload: any = {
        customerId: invoice.customerId,
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
        setPaymentAmountInput('');
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

  const handleWhatsAppShare = () => {
    if (!invoice || !customer) return;

    let initialNumber = '';
    if (customer.mobile) initialNumber = customer.mobile;
    else if (customer.telephone) initialNumber = customer.telephone;

    // Clean number
    let clean = initialNumber.replace(/\D/g, '');
    if (clean.length === 8) clean = '216' + clean;

    setWhatsAppNumber(clean);
    setClientSearchQuery('');
    setClientSearchResults([]);
    setShowWhatsAppModal(true);
  };

  const confirmWhatsAppSend = async () => {
    if (!invoice || !customer || !whatsAppNumber) return;

    let numberToSend = whatsAppNumber.replace(/\D/g, '');

    // Auto-fix if user entered 8 digits without prefix
    if (numberToSend.length === 8) {
      numberToSend = '216' + numberToSend;
    }

    // Generate public link
    let publicLink = '';
    try {
      const res = await fetch(`/api/sales/invoices/${invoice._id}/share`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        // Use window.location.origin to get correct domain (localhost or production)
        publicLink = `${window.location.origin}/api/public/invoices/${data.token}`;
      }
    } catch (e) {
      console.error("Error generating public link", e);
    }

    const customerName = customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'Cher Client';
    const companyName = companySettings?.societe?.nom || 'notre société';
    let message = `Bonjour ${customerName}, de la part de ${companyName} : Voici votre facture ${invoice.numero} du ${new Date(invoice.dateDoc).toLocaleDateString('fr-FR')} pour un montant de ${invoice.totalTTC.toFixed(3)} ${invoice.devise || 'TND'}. Merci de votre confiance.`;

    if (publicLink) {
      message += `\n\n📄 Télécharger votre facture ici : ${publicLink}`;
    }

    const url = `https://api.whatsapp.com/send?phone=${numberToSend}&text=${encodeURIComponent(message)}`;
    console.log("Opening WhatsApp URL:", url);
    window.open(url, '_blank');
    setShowWhatsAppModal(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
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
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Facture introuvable</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => router.push('/sales/invoices')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                <span className="break-words">Facture {invoice.numero}</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Créée le {new Date(invoice.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {soldeRestantActuel > 0.001 ? (
              <button
                onClick={() => {
                  if (soldeRestantActuel > 0.001) {
                    setShowPaymentModal(true);
                  } else {
                    toast('Cette facture est déjà payée en totalité', { icon: 'ℹ️' });
                  }
                }}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
              >
                <BanknotesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Ajouter paiement</span>
                <span className="sm:hidden">Paiement</span>
              </button>
            ) : (
              <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base ${isConvertedFromPaidInternal
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                <BanknotesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>
                  {isConvertedFromPaidInternal
                    ? 'Facture payée (convertie depuis facture interne)'
                    : 'Facture payée'}
                </span>
              </div>
            )}
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm sm:text-base"
              title="Envoyer par WhatsApp"
            >
              <ChatBubbleLeftEllipsisIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={generatingPDF}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              <ArrowDownTrayIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{generatingPDF ? 'Génération...' : 'Télécharger PDF'}</span>
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        </div>

        {/* Company Header Info */}
        {companySettings?.societe && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
              {/* Logo */}
              {companySettings.societe.logoUrl && (
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  <img
                    src={companySettings.societe.logoUrl}
                    alt="Company Logo"
                    className="h-16 w-16 sm:h-24 sm:w-24 object-contain"
                  />
                </div>
              )}

              {/* Company Info */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{companySettings.societe.nom}</h2>
                {companySettings.societe.enTete?.slogan && (
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 italic mt-1">{companySettings.societe.enTete.slogan}</p>
                )}
                <div className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <p>{companySettings.societe.adresse.rue}, {companySettings.societe.adresse.ville} {companySettings.societe.adresse.codePostal}</p>
                  <p>{companySettings.societe.adresse.pays}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="text-center sm:text-right text-xs sm:text-sm text-gray-600 dark:text-gray-400 w-full sm:w-auto">
                {companySettings.societe.enTete?.telephone && (
                  <p>Tél: {companySettings.societe.enTete.telephone}</p>
                )}
                {companySettings.societe.enTete?.email && (
                  <p className="break-all">Email: {companySettings.societe.enTete.email}</p>
                )}
                {companySettings.societe.enTete?.siteWeb && (
                  <p className="break-all">Web: {companySettings.societe.enTete.siteWeb}</p>
                )}
                {companySettings.societe.enTete?.matriculeFiscal && (
                  <p>Matricule: {companySettings.societe.enTete.matriculeFiscal}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invoice Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-3 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Numéro de facture</label>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{invoice.numero}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Date</label>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{new Date(invoice.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
            {invoice.dateEcheance && (
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Date échéance</label>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {new Date(invoice.dateEcheance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
              </div>
            )}
            {invoice.conditionsPaiement && (
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Conditions de paiement</label>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{invoice.conditionsPaiement}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Client</label>
              {customer ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-lg p-4 space-y-1">
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'N/A'}
                  </p>
                  {customer.matriculeFiscale && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Matricule fiscal:</span> {customer.matriculeFiscale}
                    </p>
                  )}
                  {customer.adresseFacturation && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Adresse:</span> {[
                        customer.adresseFacturation.ligne1,
                        customer.adresseFacturation.ligne2,
                        customer.adresseFacturation.codePostal,
                        customer.adresseFacturation.ville
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {customer.code && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Code:</span> {customer.code}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-lg font-medium text-gray-900 dark:text-white">Chargement...</p>
              )}
            </div>
          </div>

          {/* Lines Table */}
          {invoice.lignes && invoice.lignes.length > 0 && (
            <div className="mt-4 sm:mt-6">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Produit</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Qté</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Prix HT</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Remise %</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">TVA</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Total HT</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoice.lignes.map((line: any, index: number) => {
                      // If it's a service (estStocke = false), show description
                      const displayText = line.estStocke === false && line.descriptionProduit
                        ? line.descriptionProduit
                        : line.designation;

                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-pink-50 dark:bg-pink-900/10'}>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {displayText ? (
                              <div dangerouslySetInnerHTML={{ __html: displayText }} />
                            ) : (
                              line.designation
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900 dark:text-white">{line.quantite}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900 dark:text-white">{line.prixUnitaireHT?.toFixed(3)} {invoice.devise}</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900 dark:text-white">{line.remisePct || 0}%</td>
                          <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900 dark:text-white">{line.tvaPct || 0}%</td>
                          <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white">
                            {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {invoice.devise}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {(((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {invoice.devise}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {invoice.lignes.map((line: any, index: number) => {
                  const displayText = line.estStocke === false && line.descriptionProduit
                    ? line.descriptionProduit
                    : line.designation;

                  return (
                    <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {displayText ? (
                            <div dangerouslySetInnerHTML={{ __html: displayText }} />
                          ) : (
                            line.designation
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 mb-3">
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Qté</span>
                          <span className="font-medium text-gray-900 dark:text-white">{line.quantite}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Prix Unitaire</span>
                          <span className="font-medium text-gray-900 dark:text-white">{line.prixUnitaireHT?.toFixed(3)} {invoice.devise}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Remise</span>
                          <span className="font-medium text-gray-900 dark:text-white">{line.remisePct || 0}%</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">TVA</span>
                          <span className="font-medium text-gray-900 dark:text-white">{line.tvaPct || 0}%</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total TTC</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {(((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {invoice.devise}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="mt-4 sm:mt-6 flex justify-end">
            <div className="w-full sm:w-80 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
              {(() => {
                // Calculate remise lignes (line discounts)
                const remiseLignes = invoice.lignes?.reduce((sum: number, line: any) => {
                  const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
                  const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
                  return sum + (lineHTBeforeDiscount - lineHT);
                }, 0) || 0;

                // Calculate remise globale (global discount)
                const totalHTAfterLineDiscount = (invoice.totalBaseHT || invoice.totalHT || 0) - remiseLignes;
                const remiseGlobalePct = invoice.remiseGlobalePct || 0;
                const remiseGlobale = totalHTAfterLineDiscount * (remiseGlobalePct / 100);

                // Calculate total HT after all discounts
                const totalHTAfterDiscount = totalHTAfterLineDiscount - remiseGlobale;

                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Sous-total HT</span>
                      <span className="font-medium text-gray-900 dark:text-white">{(invoice.totalBaseHT || invoice.totalHT || 0).toFixed(3)} {invoice.devise}</span>
                    </div>
                    {remiseLignes > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Remise lignes</span>
                        <span className="font-medium text-red-600 dark:text-red-400">-{remiseLignes.toFixed(3)} {invoice.devise}</span>
                      </div>
                    )}
                    {remiseGlobale > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Remise globale{remiseGlobalePct > 0 ? ` (${remiseGlobalePct}%)` : ''}</span>
                        <span className="font-medium text-red-600 dark:text-red-400">-{remiseGlobale.toFixed(3)} {invoice.devise}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-700 dark:text-gray-300">Total HT</span>
                      <span className="font-bold text-gray-900 dark:text-white">{totalHTAfterDiscount.toFixed(3)} {invoice.devise}</span>
                    </div>
                    {invoice.fodec?.montant && invoice.fodec.montant > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">FODEC{invoice.fodec.tauxPct ? ` (${invoice.fodec.tauxPct}%)` : ''}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{invoice.fodec.montant.toFixed(3)} {invoice.devise}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Total TVA</span>
                      <span className="font-medium text-gray-900 dark:text-white">{invoice.totalTVA?.toFixed(3) || 0} {invoice.devise}</span>
                    </div>
                    {invoice.timbreFiscal && invoice.timbreFiscal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 dark:text-gray-300">Timbre fiscal</span>
                        <span className="font-medium text-gray-900 dark:text-white">{invoice.timbreFiscal.toFixed(3)} {invoice.devise}</span>
                      </div>
                    )}
                    <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between text-lg font-bold">
                      <span className="text-gray-900 dark:text-white">Total TTC</span>
                      <span className="text-blue-600 dark:text-blue-400">{invoice.totalTTC?.toFixed(3)} {invoice.devise}</span>
                    </div>
                    <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Montant à payer</span>
                      <span className="font-medium text-red-600 dark:text-red-400">{montantRestant.toFixed(3)} {invoice.devise}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Mode de paiement at bottom left */}
          {invoice.modePaiement && (
            <div className="mt-4 text-left">
              <p className="text-xs text-red-600 font-medium">
                Mode de paiement: {invoice.modePaiement}
              </p>
            </div>
          )}
        </div>

        {/* Company Footer Info */}
        {companySettings?.societe && (
          <div className="border-t border-gray-300 dark:border-gray-700 pt-6 mt-6">
            {/* Footer content */}
            {(() => {
              const footerItems: string[] = [];

              // Adresse
              const addressParts = [
                companySettings.societe.adresse?.rue,
                companySettings.societe.adresse?.ville,
                companySettings.societe.adresse?.codePostal,
                companySettings.societe.adresse?.pays
              ].filter(Boolean);
              if (addressParts.length > 0) {
                footerItems.push(addressParts.join(', '));
              }

              // Téléphone
              if (companySettings.societe.enTete?.telephone) {
                footerItems.push(`Tél : ${companySettings.societe.enTete.telephone}`);
              }

              // Capital social
              if (companySettings.societe.enTete?.capitalSocial) {
                footerItems.push(`Capital social : ${companySettings.societe.enTete.capitalSocial}`);
              }

              // Banque + RIB (sur une même ligne)
              const banc = companySettings.societe.piedPage?.coordonneesBancaires;
              if (banc?.banque || banc?.rib) {
                const banquePart = banc.banque ? banc.banque : '';
                const ribPart = banc.rib ? `RIB : ${banc.rib}` : '';
                if (banquePart && ribPart) {
                  footerItems.push(`${banquePart}, ${ribPart}`);
                } else if (banquePart) {
                  footerItems.push(banquePart);
                } else if (ribPart) {
                  footerItems.push(ribPart);
                }
              }

              return footerItems.length > 0 ? (
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {footerItems.join(' - ')}
                </div>
              ) : null;
            })()}
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && invoice && (

          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
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
                    setPaymentAmountInput('');
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
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="useAdvance" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed dark:placeholder-gray-400"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400"
                    placeholder="Notes supplémentaires..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
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
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
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
                {/* Manual Number Input */}
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

                {/* Search Client */}
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

                  {/* Search Results Dropdown */}
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
      )}
    </DashboardLayout>
  );
}

