'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, PencilIcon, TrashIcon, ArrowDownTrayIcon, CheckCircleIcon, ChevronDownIcon, BanknotesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface PurchaseInvoice {
  _id: string;
  numero: string;
  dateFacture: string;
  referenceFournisseur?: string;
  fournisseurId: string;
  fournisseurNom: string;
  devise: string;
  conditionsPaiement?: string;
  statut: 'BROUILLON' | 'VALIDEE' | 'PARTIELLEMENT_PAYEE' | 'PAYEE' | 'ANNULEE';
  lignes: Array<{
    produitId?: string;
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
    remisePct?: number;
    tvaPct?: number;
    fodecPct?: number;
    totalLigneHT?: number;
  }>;
  fodec: {
    enabled: boolean;
    tauxPct?: number;
    montant?: number;
  };
  timbre: {
    enabled: boolean;
    montant?: number;
  };
  totaux: {
    totalHT: number;
    totalRemise?: number;
    totalFodec?: number;
    totalTVA: number;
    totalTimbre?: number;
    totalTTC: number;
  };
  bonsReceptionIds?: string[];
  notes?: string;
}

export default function PurchaseInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleting, setDeleting] = useState(false);
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
    if (tenantId && params.id) {
      fetchInvoice();
    }
  }, [tenantId, params.id]);

  useEffect(() => {
    if (showPaymentModal && invoice && tenantId) {
      fetchAdvanceBalance();
      // Calculate remaining amount
      calculateRemainingAmount().then(remaining => {
        // Store the current remaining balance
        const roundedRemaining = Math.round(remaining * 1000) / 1000;
        setSoldeRestantActuel(roundedRemaining);
        
        setPaymentData(prev => {
          // If using advance, set amount to min of advance balance and remaining
          if (prev.useAdvance && advanceBalance > 0) {
            const advanceToUse = Math.min(advanceBalance, roundedRemaining);
            return { ...prev, montantPaye: advanceToUse };
          }
          // Round to 3 decimal places to avoid floating point issues
          return { ...prev, montantPaye: roundedRemaining };
        });
      });
    }
  }, [showPaymentModal, invoice, tenantId]);

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

  async function fetchAdvanceBalance() {
    if (!invoice || !tenantId) return;
    setLoadingBalance(true);
    try {
      // Get balance API to get net advance balance
      const response = await fetch(`/api/suppliers/${invoice.fournisseurId}/balance`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        // netAdvanceBalance is the available advance (payments on account - advance used)
        // If negative, it means we have an advance balance available
        const netAdvanceBalance = data.netAdvanceBalance || 0;
        if (netAdvanceBalance > 0) {
          setAdvanceBalance(netAdvanceBalance);
        } else {
          setAdvanceBalance(0);
        }
      } else {
        // Fallback: calculate from transactions
        const transactionsResponse = await fetch(`/api/suppliers/${invoice.fournisseurId}/transactions?type=all&page=1&limit=1`, {
          headers: { 'X-Tenant-Id': tenantId },
        });
        if (transactionsResponse.ok) {
          const transactionsData = await transactionsResponse.json();
          // Calculate advance: payments on account - advance used
          // This is done by checking if soldeActuel calculation shows negative (meaning we have advance)
          // Actually, we need to calculate it from payments
          setAdvanceBalance(0);
        }
      }
    } catch (error) {
      console.error('Error fetching advance balance:', error);
      setAdvanceBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  }

  async function calculateRemainingAmount(): Promise<number> {
    if (!invoice || !tenantId) return 0;
    try {
      const response = await fetch(`/api/purchases/payments/unpaid-invoices?fournisseurId=${invoice.fournisseurId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const invoices = await response.json();
        const invoiceData = invoices.find((inv: any) => inv._id === invoice._id);
        if (invoiceData) {
          return invoiceData.soldeRestant || 0;
        }
      }
    } catch (error) {
      console.error('Error calculating remaining amount:', error);
    }
    return invoice.totaux.totalTTC;
  }

  async function handleSavePayment() {
    if (!invoice || !tenantId) return;

    const remaining = await calculateRemainingAmount();
    const totalToPay = paymentData.montantPaye;
    
    if (totalToPay <= 0) {
      toast.error('Le montant payé doit être supérieur à zéro');
      return;
    }

    // Allow payment if amount is equal to or less than remaining balance
    // Round both values to 3 decimal places for comparison to avoid floating point issues
    const roundedTotalToPay = Math.round(totalToPay * 1000) / 1000;
    const roundedRemaining = Math.round(remaining * 1000) / 1000;
    
    if (roundedTotalToPay > roundedRemaining) {
      toast.error(`Le montant payé (${roundedTotalToPay.toFixed(3)}) ne peut pas être supérieur au solde restant (${roundedRemaining.toFixed(3)})`);
      return;
    }

    // Validate and calculate advance usage
    let advanceToUse = 0;
    if (paymentData.useAdvance) {
      // When using advance, the amount to pay should be the minimum of advance balance and remaining balance
      advanceToUse = Math.min(advanceBalance, remaining);
      if (advanceToUse <= 0) {
        toast.error('Le solde avance disponible est insuffisant');
        return;
      }
      // When using advance, the payment amount must not exceed the remaining balance
      // and should match the available advance (or remaining if less)
      if (roundedTotalToPay > roundedRemaining) {
        toast.error(`Le montant payé (${roundedTotalToPay.toFixed(3)}) ne peut pas être supérieur au solde restant (${roundedRemaining.toFixed(3)})`);
        return;
      }
      // Ensure montantPaye matches the calculated advance amount (min of advance and remaining)
      if (Math.abs(roundedTotalToPay - advanceToUse) > 0.001) {
        toast.error(`Le montant à payer (${roundedTotalToPay.toFixed(3)}) doit correspondre au montant disponible (${advanceToUse.toFixed(3)})`);
        return;
      }
    }

    setSavingPayment(true);
    try {
      // Calculate cash payment (0 if using advance, otherwise totalToPay)
      const cashPayment = paymentData.useAdvance ? 0 : totalToPay;

      // If using advance, first we need to "consume" it by creating a payment on account with negative amount
      // Actually, a simpler approach: create payment for invoice with the total amount
      // The advance balance will be automatically reduced when calculating soldeActuel
      // But we need to track which part came from advance

      // For now, we'll create the payment normally
      // The advance balance reduction will be handled by the balance calculation
      // In the future, we might need to add a field to track advance usage

      // When using advance, the payment amount should be the advance amount
      const paymentAmount = paymentData.useAdvance ? advanceToUse : totalToPay;
      
      const paymentPayload: any = {
        fournisseurId: invoice.fournisseurId,
        datePaiement: paymentData.datePaiement,
        modePaiement: paymentData.useAdvance ? 'Avance' : paymentData.modePaiement,
        reference: paymentData.reference,
        notes: paymentData.notes + (paymentData.useAdvance ? ` (Utilisation avance: ${advanceToUse.toFixed(3)} ${invoice.devise})` : ''),
        lignes: [{
          factureId: invoice._id,
          numeroFacture: invoice.numero,
          referenceFournisseur: invoice.referenceFournisseur || '',
          montantFacture: invoice.totaux.totalTTC,
          montantPayeAvant: invoice.totaux.totalTTC - remaining,
          montantPaye: paymentAmount, // Amount paid (advance amount if using advance, otherwise totalToPay)
          soldeRestant: remaining - paymentAmount,
          isPaymentOnAccount: false,
        }],
        // Include advance usage information
        useAdvanceBalance: paymentData.useAdvance,
        advanceAmount: advanceToUse,
        currentAdvanceBalance: advanceBalance, // Send current available advance balance
      };

      const response = await fetch('/api/purchases/payments', {
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
        // Refresh invoice data to update montantRestant
        await fetchInvoice();
        // Refresh advance balance after payment
        await fetchAdvanceBalance();
        // Reset payment data
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

  async function fetchInvoice() {
    if (!tenantId || !params.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/purchases/invoices/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
        
        // Calculate remaining amount to pay
        if (data.fournisseurId) {
          try {
            const unpaidResponse = await fetch(`/api/purchases/payments/unpaid-invoices?fournisseurId=${data.fournisseurId}`, {
              headers: { 'X-Tenant-Id': tenantId },
            });
            if (unpaidResponse.ok) {
              const unpaidInvoices = await unpaidResponse.json();
              const invoiceData = unpaidInvoices.find((inv: any) => inv._id === params.id);
              if (invoiceData) {
                setMontantRestant(invoiceData.soldeRestant || 0);
              } else {
                // If invoice is fully paid or not in unpaid list, set to 0
                setMontantRestant(0);
              }
            }
          } catch (error) {
            console.error('Error fetching remaining amount:', error);
            // Default to total TTC if we can't fetch the remaining amount
            setMontantRestant(data.totaux?.totalTTC || 0);
          }
        }
      } else {
        toast.error('Facture non trouvée');
        router.push('/purchases/invoices');
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!tenantId || !invoice) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/purchases/invoices/${invoice._id}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        toast.success('Facture supprimée');
        router.push('/purchases/invoices');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  }

  async function handleValidate() {
    if (!tenantId || !invoice) return;
    try {
      const response = await fetch(`/api/purchases/invoices/${invoice._id}/valider`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        toast.success('Facture validée');
        fetchInvoice();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la validation');
      }
    } catch (error) {
      console.error('Error validating invoice:', error);
      toast.error('Erreur lors de la validation');
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!tenantId || !invoice) return;
    
    try {
      // Validate status transition
      if (invoice.statut === 'VALIDEE' && newStatus === 'BROUILLON') {
        toast.error('Impossible de revenir à l\'état Brouillon après validation');
        return;
      }

      if (invoice.statut === 'PAYEE' && newStatus !== 'PAYEE') {
        toast.error('Impossible de modifier une facture payée');
        return;
      }

      if (invoice.statut === 'ANNULEE' && newStatus !== 'ANNULEE') {
        toast.error('Impossible de modifier une facture annulée');
        return;
      }

      const response = await fetch(`/api/purchases/invoices/${invoice._id}`, {
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
        fetchInvoice();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du changement de statut');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Erreur lors du changement de statut');
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
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${styles[statut] || styles.BROUILLON}`}>
        {labels[statut] || statut}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <div className="p-4 sm:p-6">
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Facture non trouvée</p>
            <button
              onClick={() => router.push('/purchases/invoices')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm">Retour</span>
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Facture d'achat</h1>
              <span className="text-lg sm:text-xl font-bold text-blue-600">{invoice.numero}</span>
              {getStatusBadge(invoice.statut)}
              <div className="relative inline-block">
                <select
                  value={invoice.statut}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
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
                <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {invoice.statut === 'BROUILLON' && (
                <>
                  <button
                    onClick={handleValidate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    Valider
                  </button>
                  <button
                    onClick={() => router.push(`/purchases/invoices/${invoice._id}/edit`)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                  >
                    <PencilIcon className="w-5 h-5" />
                    Modifier
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <TrashIcon className="w-5 h-5" />
                    Supprimer
                  </button>
                </>
              )}
              {(invoice.statut === 'VALIDEE' || invoice.statut === 'PARTIELLEMENT_PAYEE') && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <BanknotesIcon className="w-5 h-5" />
                  Ajouter paiement
                </button>
              )}
              <button
                onClick={() => window.open(`/api/purchases/invoices/${invoice._id}/pdf`, '_blank')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Télécharger PDF
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Informations générales */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500">Date de facture</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {new Date(invoice.dateFacture).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">N° facture fournisseur</label>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {invoice.referenceFournisseur || '—'}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Fournisseur</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{invoice.fournisseurNom}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Devise</label>
                <p className="text-sm font-medium text-gray-900 mt-1">{invoice.devise}</p>
              </div>
              {invoice.conditionsPaiement && (
                <div>
                  <label className="text-xs text-gray-500">Conditions de paiement</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">{invoice.conditionsPaiement}</p>
                </div>
              )}
              {invoice.fodec.enabled && (
                <div>
                  <label className="text-xs text-gray-500">FODEC</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {invoice.fodec.tauxPct}% - {invoice.fodec.montant?.toFixed(3) || 0} DT
                  </p>
                </div>
              )}
              {invoice.timbre.enabled && (
                <div>
                  <label className="text-xs text-gray-500">Timbre fiscal</label>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {invoice.timbre.montant?.toFixed(3) || 1.000} DT
                  </p>
                </div>
              )}
            </div>
            {invoice.notes && (
              <div className="mt-4 pt-4 border-t">
                <label className="text-xs text-gray-500">Notes</label>
                <p className="text-sm text-gray-900 mt-1">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Lignes */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50 border-b-2 border-blue-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-sm font-bold text-gray-800">Désignation</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Quantité</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Prix HT</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Remise %</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">TVA %</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Total HT</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.lignes.map((line, index) => (
                    <tr key={index}>
                      <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">{line.designation}</td>
                      <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">{line.quantite}</td>
                      <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {line.prixUnitaireHT.toFixed(3)} DT
                      </td>
                      <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {line.remisePct ? `${line.remisePct} %` : '—'}
                      </td>
                      <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {line.tvaPct ? `${line.tvaPct} %` : '—'}
                      </td>
                      <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {line.totalLigneHT?.toFixed(3) || '0.000'} DT
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  {invoice.totaux.totalRemise && invoice.totaux.totalRemise > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        Total Remise:
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-red-600">
                        -{invoice.totaux.totalRemise.toFixed(3)} DT
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                      Total HT:
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                      {invoice.totaux.totalHT.toFixed(3)} DT
                    </td>
                  </tr>
                  {invoice.fodec.enabled && (
                    <tr>
                      <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        FODEC ({invoice.fodec.tauxPct}%):
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                        {(invoice.totaux.totalFodec || 0).toFixed(3)} DT
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                      Total TVA:
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                      {invoice.totaux.totalTVA.toFixed(3)} DT
                    </td>
                  </tr>
                  {invoice.timbre.enabled && (
                    <tr>
                      <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        Timbre fiscal:
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-gray-900">
                        {(invoice.totaux.totalTimbre || 0).toFixed(3)} DT
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-blue-600">
                      Total TTC:
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-blue-600">
                      {invoice.totaux.totalTTC.toFixed(3)} DT
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-3 text-right text-sm font-semibold text-orange-600">
                      Montant à payer:
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-right text-sm font-bold text-orange-600">
                      {montantRestant.toFixed(3)} DT
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && invoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Ajouter un paiement</h2>
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

              <div className="p-6 space-y-6">
                {/* Invoice Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Informations de la facture</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Facture:</span>
                      <span className="ml-2 font-medium text-gray-900">{invoice.numero}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Montant total:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {invoice.totaux.totalTTC.toFixed(3)} {invoice.devise}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Advance Balance Info */}
                {loadingBalance ? (
                  <div className="text-center py-4">Chargement du solde...</div>
                ) : advanceBalance > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-green-800">Solde avance disponible</h3>
                        <p className="text-2xl font-bold text-green-700 mt-1">
                          {advanceBalance.toFixed(3)} {invoice.devise}
                        </p>
                      </div>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paymentData.useAdvance}
                          onChange={(e) => {
                            const useAdvance = e.target.checked;
                            setPaymentData(prev => {
                              if (useAdvance) {
                                // When using advance, set montantPaye to min of advance balance and remaining
                                const remaining = soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totaux.totalTTC;
                                const advanceToUse = Math.min(advanceBalance, remaining);
                                // Round to 3 decimal places
                                const roundedAdvance = Math.round(advanceToUse * 1000) / 1000;
                                return {
                                  ...prev,
                                  useAdvance: true,
                                  montantPaye: roundedAdvance,
                                  advanceAmount: roundedAdvance,
                                };
                              } else {
                                // When not using advance, reset to remaining amount
                                const remaining = soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totaux.totalTTC;
                                const roundedRemaining = Math.round(remaining * 1000) / 1000;
                                return {
                                  ...prev,
                                  useAdvance: false,
                                  montantPaye: roundedRemaining,
                                  advanceAmount: 0,
                                };
                              }
                            });
                          }}
                          className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="ml-2 text-sm font-medium text-green-800">Utiliser l'avance</span>
                      </label>
                    </div>
                    {paymentData.useAdvance && (
                      <div className="mt-4 p-3 bg-green-100 rounded-lg">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">Montant à payer</span> sera défini automatiquement à {Math.min(advanceBalance, invoice.totaux.totalTTC).toFixed(3)} {invoice.devise}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de paiement <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentData.datePaiement}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, datePaiement: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mode de paiement <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentData.modePaiement}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, modePaiement: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="Espèces">Espèces</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Virement">Virement</option>
                      <option value="Carte">Carte</option>
                      <option value="Traite">Traite</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Référence
                    </label>
                    <input
                      type="text"
                      value={paymentData.reference}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, reference: e.target.value }))}
                      placeholder="N° chèque, référence virement..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant à payer <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max={soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totaux.totalTTC}
                      value={paymentData.montantPaye > 0 ? parseFloat(paymentData.montantPaye.toFixed(3)) : ''}
                      onChange={(e) => {
                        // If using advance, don't allow manual editing
                        if (paymentData.useAdvance) {
                          return;
                        }
                        const inputValue = e.target.value;
                        if (inputValue === '') {
                          setPaymentData(prev => ({
                            ...prev,
                            montantPaye: 0,
                          }));
                          return;
                        }
                        const value = parseFloat(inputValue) || 0;
                        const remaining = soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totaux.totalTTC;
                        // Round to 3 decimal places and limit to remaining amount
                        const roundedValue = Math.round(value * 1000) / 1000;
                        setPaymentData(prev => ({
                          ...prev,
                          montantPaye: Math.min(Math.max(0, roundedValue), remaining),
                        }));
                      }}
                      onBlur={(e) => {
                        // If using advance, reset to correct value
                        if (paymentData.useAdvance && advanceBalance > 0 && soldeRestantActuel > 0) {
                          const advanceToUse = Math.min(advanceBalance, soldeRestantActuel);
                          const roundedAdvance = Math.round(advanceToUse * 1000) / 1000;
                          setPaymentData(prev => ({
                            ...prev,
                            montantPaye: roundedAdvance,
                          }));
                          return;
                        }
                        // Round value on blur to avoid floating point issues
                        const value = parseFloat(e.target.value) || 0;
                        const rounded = Math.round(value * 1000) / 1000;
                        const remaining = soldeRestantActuel > 0 ? soldeRestantActuel : invoice.totaux.totalTTC;
                        setPaymentData(prev => ({
                          ...prev,
                          montantPaye: Math.min(rounded, remaining),
                        }));
                      }}
                      disabled={paymentData.useAdvance}
                      readOnly={paymentData.useAdvance}
                      className={`w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        paymentData.useAdvance ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
                      }`}
                      placeholder="0.000"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Solde restant: {soldeRestantActuel.toFixed(3)} {invoice.devise}
                    </p>
                    {paymentData.useAdvance && (
                      <p className="mt-1 text-xs text-green-600 font-medium">
                        Le montant provient de l'avance disponible
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={paymentData.notes}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Notes additionnelles..."
                    />
                  </div>
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
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSavePayment}
                  disabled={savingPayment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

