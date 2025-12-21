'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ImageUploader, { ImageData } from '@/components/common/ImageUploader';

interface Customer {
  _id: string;
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
}

interface UnpaidInvoice {
  _id: string;
  numero: string;
  dateDoc: string;
  referenceExterne?: string;
  montantTotal: number;
  montantPaye: number;
  soldeRestant: number;
  statut: string;
  estPayee: boolean;
  estPartiellementPayee: boolean;
}

interface PaymentLine {
  factureId: string;
  numeroFacture: string;
  montantFacture: number;
  montantPayeAvant: number;
  montantPaye: number;
  soldeRestant: number;
}

export default function NewCustomerPaymentPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  const [customerDropdownPosition, setCustomerDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const [formData, setFormData] = useState({
    datePaiement: new Date().toISOString().split('T')[0],
    customerId: '',
    customerNom: '',
    modePaiement: 'Espèces',
    reference: '',
    notes: '',
  });

  const [paymentType, setPaymentType] = useState<'invoices' | 'onAccount'>('invoices'); // 'invoices' or 'onAccount'
  const [montantOnAccount, setMontantOnAccount] = useState<number>(0);
  const [selectedInvoices, setSelectedInvoices] = useState<{ [key: string]: UnpaidInvoice & { montantPayeInput: number } }>({});
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [images, setImages] = useState<ImageData[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchCustomers();
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && formData.customerId) {
      fetchUnpaidInvoices();
    } else {
      setUnpaidInvoices([]);
      setSelectedInvoices({});
    }
  }, [tenantId, formData.customerId]);

  async function fetchCustomers() {
    if (!tenantId) return;
    try {
      const response = await fetch('/api/customers', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.items || data || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }

  async function fetchUnpaidInvoices() {
    if (!tenantId || !formData.customerId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/sales/payments/unpaid-invoices?customerId=${formData.customerId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const invoices = await response.json();
        setUnpaidInvoices(invoices);
      }
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
      toast.error('Erreur lors du chargement des factures');
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter((customer) => {
    const searchLower = customerSearch.toLowerCase().trim();
    if (!searchLower) return true;
    const name = (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`).trim().toLowerCase();
    return name.includes(searchLower);
  });

  const calculateCustomerDropdownPosition = () => {
    const input = document.querySelector('input[data-customer-input="true"]') as HTMLInputElement;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    setCustomerDropdownPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (showCustomerDropdown) {
      calculateCustomerDropdownPosition();
    }
  }, [showCustomerDropdown]);

  useEffect(() => {
    const handleScroll = () => {
      if (showCustomerDropdown) {
        setShowCustomerDropdown(false);
        setCustomerDropdownPosition(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const customerInput = document.querySelector('[data-customer-input]');
      const dropdown = document.querySelector('[data-customer-dropdown]');
      if (showCustomerDropdown && customerInput && dropdown) {
        if (!customerInput.contains(target) && !dropdown.contains(target)) {
          setShowCustomerDropdown(false);
          setCustomerDropdownPosition(null);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown]);

  const handleSelectCustomer = (customer: Customer) => {
    const name = customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim();
    setFormData(prev => ({
      ...prev,
      customerId: customer._id,
      customerNom: name,
    }));
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
    setSelectedCustomerIndex(-1);
    setCustomerDropdownPosition(null);
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIndex((prevIndex) =>
        prevIndex < filteredCustomers.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomerIndex !== -1 && filteredCustomers[selectedCustomerIndex]) {
        handleSelectCustomer(filteredCustomers[selectedCustomerIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
      setSelectedCustomerIndex(-1);
    }
  };

  function toggleInvoiceSelection(invoice: UnpaidInvoice) {
    setSelectedInvoices(prev => {
      const newSelected = { ...prev };
      if (newSelected[invoice._id]) {
        delete newSelected[invoice._id];
      } else {
        newSelected[invoice._id] = {
          ...invoice,
          montantPayeInput: invoice.soldeRestant, // Default to full remaining amount
        };
      }
      return newSelected;
    });
  }

  function updatePaymentAmount(invoiceId: string, amount: number) {
    setSelectedInvoices(prev => {
      if (!prev[invoiceId]) return prev;
      const invoice = prev[invoiceId];
      const maxAmount = invoice.soldeRestant;
      const newAmount = Math.max(0, Math.min(amount, maxAmount));
      return {
        ...prev,
        [invoiceId]: {
          ...invoice,
          montantPayeInput: newAmount,
        },
      };
    });
  }

  function calculateTotal() {
    if (paymentType === 'onAccount') {
      return montantOnAccount;
    }
    return Object.values(selectedInvoices).reduce((sum, inv) => sum + (inv.montantPayeInput || 0), 0);
  }

  async function handleSave() {
    if (!tenantId) return;

    if (!formData.customerId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    const total = calculateTotal();
    if (total <= 0) {
      toast.error('Le montant total doit être supérieur à zéro');
      return;
    }

    if (paymentType === 'invoices' && Object.keys(selectedInvoices).length === 0) {
      toast.error('Veuillez sélectionner au moins une facture');
      return;
    }

    if (paymentType === 'onAccount' && montantOnAccount <= 0) {
      toast.error('Veuillez saisir un montant pour le paiement sur compte');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        ...formData,
        images: images,
      };

      if (paymentType === 'onAccount') {
        payload.isPaymentOnAccount = true;
        payload.montantOnAccount = montantOnAccount;
        payload.lignes = [{
          montantPaye: montantOnAccount,
        }];
      } else {
        payload.isPaymentOnAccount = false;
        payload.lignes = Object.values(selectedInvoices).map(inv => ({
          factureId: inv._id,
          montantPaye: inv.montantPayeInput,
        }));
      }

      const response = await fetch('/api/sales/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const payment = await response.json();
        toast.success('Paiement créé avec succès');
        router.push(`/sales/payments/${payment._id}`);
      } else {
        const errorData = await response.json();
        // Display the actual error message from the server
        const errorMessage = errorData.error || errorData.message || 'Erreur lors de la création du paiement';
        toast.error(errorMessage, {
          duration: 5000, // Show for 5 seconds
        });
        console.error('Payment creation error:', errorData);
      }
    } catch (error: any) {
      console.error('Error saving payment:', error);
      const errorMessage = error?.message || 'Erreur de connexion lors de la sauvegarde';
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  }

  if (!tenantId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const total = calculateTotal();

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/sales/payments')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau paiement client</h1>
        </div>

        <div className="space-y-6">
          {/* Section 1: Informations générales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informations générales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Client *
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    data-customer-input="true"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                      setSelectedCustomerIndex(-1);
                      calculateCustomerDropdownPosition();
                    }}
                    onFocus={(e) => {
                      setShowCustomerDropdown(true);
                      calculateCustomerDropdownPosition();
                    }}
                    onKeyDown={handleCustomerKeyDown}
                    placeholder="Rechercher un client..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  {showCustomerDropdown && customerDropdownPosition && filteredCustomers.length > 0 && (
                    <div
                      data-customer-dropdown="true"
                      className="fixed z-[9999] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                      style={{
                        width: `${customerDropdownPosition.width}px`,
                        top: `${customerDropdownPosition.top}px`,
                        left: `${customerDropdownPosition.left}px`,
                      }}
                    >
                      {filteredCustomers.map((customer, index) => (
                        <div
                          key={customer._id}
                          onClick={() => handleSelectCustomer(customer)}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white ${index === selectedCustomerIndex ? 'bg-blue-50 dark:bg-gray-600' : ''
                            }`}
                        >
                          {customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="datePaiement" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date de paiement *
                </label>
                <input
                  type="date"
                  id="datePaiement"
                  value={formData.datePaiement}
                  onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="modePaiement" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mode de paiement *
                </label>
                <select
                  id="modePaiement"
                  value={formData.modePaiement}
                  onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Carte">Carte</option>
                  <option value="Traite">Traite</option>
                </select>
              </div>

              <div>
                <label htmlFor="reference" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Référence
                </label>
                <input
                  type="text"
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="N° chèque, référence virement, etc."
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Notes additionnelles..."
                />
              </div>

              <div className="md:col-span-2">
                <ImageUploader
                  images={images}
                  onChange={setImages}
                  maxImages={10}
                  maxSizeMB={5}
                  label="Images jointes"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Type de paiement */}
          {formData.customerId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Type de paiement</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentType === 'invoices'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="invoices"
                    checked={paymentType === 'invoices'}
                    onChange={(e) => setPaymentType(e.target.value as 'invoices' | 'onAccount')}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Paiement sur factures</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Régler des factures spécifiques</div>
                  </div>
                </label>
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentType === 'onAccount'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="onAccount"
                    checked={paymentType === 'onAccount'}
                    onChange={(e) => setPaymentType(e.target.value as 'invoices' | 'onAccount')}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Paiement sur compte</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Payer sans facture spécifique</div>
                  </div>
                </label>
              </div>

              {/* Payment on Account */}
              {paymentType === 'onAccount' && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <label htmlFor="montantOnAccount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Montant du paiement sur compte *
                  </label>
                  <input
                    type="number"
                    id="montantOnAccount"
                    min="0"
                    step="0.001"
                    value={montantOnAccount || ''}
                    onChange={(e) => setMontantOnAccount(parseFloat(e.target.value) || 0)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="0.000"
                    required
                  />
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Ce montant sera crédité au compte du client sans être lié à une facture spécifique.
                  </p>
                </div>
              )}

              {/* Factures non payées */}
              {paymentType === 'invoices' && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Factures non payées</h3>
                    <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                      <strong>💡 Explication:</strong> "Déjà Payé" = المبلغ المدفوع مسبقاً في دفعات سابقة لهذه الفاتورة
                    </div>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : unpaidInvoices.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Aucune facture impayée pour ce client</p>
                  ) : (
                    <>
                      {/* Mobile View (Cards) */}
                      <div className="md:hidden space-y-4">
                        {unpaidInvoices.map((invoice) => {
                          const isSelected = !!selectedInvoices[invoice._id];
                          const selectedInvoice = selectedInvoices[invoice._id];
                          return (
                            <div
                              key={invoice._id}
                              className={`p-4 rounded-lg border ${isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                } transition-colors`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleInvoiceSelection(invoice)}
                                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                      {invoice.referenceExterne || invoice.numero || '—'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {new Date(invoice.dateDoc).toLocaleDateString('fr-FR')}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-gray-900 dark:text-white">{invoice.soldeRestant.toFixed(3)} DT</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">Solde restant</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 dark:text-gray-400 mb-3 border-t dark:border-gray-700 pt-2">
                                <div>
                                  <span className="block text-gray-500">Montant Total:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{invoice.montantTotal.toFixed(3)} DT</span>
                                </div>
                                <div>
                                  <span className="block text-gray-500">Déjà Payé:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{invoice.montantPaye.toFixed(3)} DT</span>
                                </div>
                              </div>

                              <div className="mt-3">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Montant à Payer
                                </label>
                                {isSelected ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max={invoice.soldeRestant}
                                    step="0.001"
                                    value={selectedInvoice.montantPayeInput || 0}
                                    onChange={(e) => updatePaymentAmount(invoice._id, parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    disabled
                                    value="—"
                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-center bg-gray-50 dark:bg-gray-800 text-gray-400"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total du paiement:</span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{total.toFixed(3)} DT</span>
                        </div>
                      </div>

                      {/* Desktop View (Table) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sélection</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">N° Facture</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montant Total</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                <span title="المبلغ المدفوع مسبقاً في دفعات سابقة">Déjà Payé</span>
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Solde Restant</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montant à Payer</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {unpaidInvoices.map((invoice) => {
                              const isSelected = !!selectedInvoices[invoice._id];
                              const selectedInvoice = selectedInvoices[invoice._id];
                              return (
                                <tr key={invoice._id} className={isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}>
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleInvoiceSelection(invoice)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                    {invoice.referenceExterne || invoice.numero || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(invoice.dateDoc).toLocaleDateString('fr-FR')}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                                    {invoice.montantTotal.toFixed(3)} DT
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                                    {invoice.montantPaye.toFixed(3)} DT
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                                    {invoice.soldeRestant.toFixed(3)} DT
                                  </td>
                                  <td className="px-4 py-3">
                                    {isSelected ? (
                                      <input
                                        type="number"
                                        min="0"
                                        max={invoice.soldeRestant}
                                        step="0.001"
                                        value={selectedInvoice.montantPayeInput || 0}
                                        onChange={(e) => updatePaymentAmount(invoice._id, parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Total du paiement:
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-blue-600 dark:text-blue-400">
                                {total.toFixed(3)} DT
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => router.push('/sales/payments')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || total <= 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer le paiement'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

