'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ImageUploader, { ImageData } from '@/components/common/ImageUploader';

interface Supplier {
  _id: string;
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
}

interface UnpaidInvoice {
  _id: string;
  numero: string;
  referenceFournisseur?: string;
  dateFacture: string;
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

export default function NewPurchasePaymentPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);
  const [supplierDropdownPosition, setSupplierDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const [formData, setFormData] = useState({
    datePaiement: new Date().toISOString().split('T')[0],
    fournisseurId: '',
    fournisseurNom: '',
    modePaiement: 'Espèces',
    reference: '',
    notes: '',
  });

  const [paymentType, setPaymentType] = useState<'invoices' | 'onAccount'>('invoices'); // 'invoices' or 'onAccount'
  const [montantOnAccount, setMontantOnAccount] = useState<number>(0);
  const [selectedInvoices, setSelectedInvoices] = useState<{ [key: string]: UnpaidInvoice & { montantPayeInput: number } }>({});
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [images, setImages] = useState<ImageData[]>([]);
  const [availableAvoirs, setAvailableAvoirs] = useState<any[]>([]);
  const [selectedAvoir, setSelectedAvoir] = useState<string>('');

  useEffect(() => {
    if (tenantId) {
      fetchSuppliers();
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && formData.fournisseurId) {
      fetchUnpaidInvoices();
      fetchAvailableAvoirs();
    } else {
      setUnpaidInvoices([]);
      setSelectedInvoices({});
      setAvailableAvoirs([]);
      setSelectedAvoir('');
    }
  }, [tenantId, formData.fournisseurId]);

  // Handle Avoir Selection Auto-fill
  useEffect(() => {
    if (paymentType === 'onAccount' && selectedAvoir) {
      const avoir = availableAvoirs.find(a => a._id === selectedAvoir);
      if (avoir) {
        setMontantOnAccount(avoir.soldeRestant);
        setFormData(prev => ({
          ...prev,
          reference: prev.reference || `Conversion ${avoir.numero}`,
          notes: prev.notes || `Conversion de l'avoir ${avoir.numero} en solde avance`
        }));
      }
    }
  }, [selectedAvoir, paymentType, availableAvoirs]);

  async function fetchSuppliers() {
    if (!tenantId) return;
    try {
      const response = await fetch('/api/suppliers', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.items || data || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }

  async function fetchAvailableAvoirs() {
    if (!tenantId || !formData.fournisseurId) return;
    try {
      const response = await fetch(`/api/purchases/credit-notes/available?supplierId=${formData.fournisseurId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        setAvailableAvoirs(await response.json());
      }
    } catch (error) {
      console.error('Error fetching avoirs:', error);
    }
  }

  async function fetchUnpaidInvoices() {
    if (!tenantId || !formData.fournisseurId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/purchases/payments/unpaid-invoices?fournisseurId=${formData.fournisseurId}`, {
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

  const filteredSuppliers = suppliers.filter((supplier) => {
    const searchLower = supplierSearch.toLowerCase().trim();
    if (!searchLower) return true;
    const name = (supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`).trim().toLowerCase();
    return name.includes(searchLower);
  });

  const calculateSupplierDropdownPosition = () => {
    const input = document.querySelector('input[data-supplier-input="true"]') as HTMLInputElement;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    setSupplierDropdownPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (showSupplierDropdown) {
      calculateSupplierDropdownPosition();
    }
  }, [showSupplierDropdown]);

  useEffect(() => {
    const handleScroll = () => {
      if (showSupplierDropdown) {
        setShowSupplierDropdown(false);
        setSupplierDropdownPosition(null);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const supplierInput = document.querySelector('[data-supplier-input]');
      const dropdown = document.querySelector('[data-supplier-dropdown]');
      if (showSupplierDropdown && supplierInput && dropdown) {
        if (!supplierInput.contains(target) && !dropdown.contains(target)) {
          setShowSupplierDropdown(false);
          setSupplierDropdownPosition(null);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSupplierDropdown]);

  const handleSelectSupplier = (supplier: Supplier) => {
    const name = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
    setFormData(prev => ({
      ...prev,
      fournisseurId: supplier._id,
      fournisseurNom: name,
    }));
    setSupplierSearch(name);
    setShowSupplierDropdown(false);
    setSelectedSupplierIndex(-1);
    setSupplierDropdownPosition(null);
  };

  const handleSupplierKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSupplierIndex((prevIndex) =>
        prevIndex < filteredSuppliers.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSupplierIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSupplierIndex !== -1 && filteredSuppliers[selectedSupplierIndex]) {
        handleSelectSupplier(filteredSuppliers[selectedSupplierIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSupplierDropdown(false);
      setSelectedSupplierIndex(-1);
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

      let newAmount = amount;
      if (maxAmount < 0) {
        // Avoir: Amount should be between maxAmount (e.g. -200) and 0
        newAmount = Math.max(maxAmount, Math.min(0, amount));
      } else {
        // Invoice: Amount between 0 and maxAmount (e.g. 1000)
        newAmount = Math.max(0, Math.min(amount, maxAmount));
      }

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

    if (!formData.fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }

    const total = calculateTotal();
    // Removed strict total > 0 check to allow offsets (total = 0) and refunds (total < 0)

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
        payload.lignes = [];
        if (selectedAvoir) {
          payload.sourceAvoirId = selectedAvoir;
        }
      } else {
        payload.isPaymentOnAccount = false;
        payload.lignes = Object.values(selectedInvoices).map(inv => ({
          factureId: inv._id,
          montantPaye: inv.montantPayeInput,
        }));
      }

      const response = await fetch('/api/purchases/payments', {
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
        router.push(`/purchases/payments/${payment._id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Error saving payment:', error);
      toast.error('Erreur lors de la sauvegarde');
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
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-6">
          <button onClick={() => router.push('/purchases/payments')} className="text-gray-600 hover:text-gray-800 mr-2">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau paiement fournisseur</h1>
        </div>

        <div className="space-y-6">
          {/* Section 1: Informations générales */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Informations générales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fournisseur *
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    data-supplier-input="true"
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setShowSupplierDropdown(true);
                      setSelectedSupplierIndex(-1);
                      calculateSupplierDropdownPosition();
                    }}
                    onFocus={(e) => {
                      setShowSupplierDropdown(true);
                      calculateSupplierDropdownPosition();
                    }}
                    onKeyDown={handleSupplierKeyDown}
                    placeholder="Rechercher un fournisseur..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  {showSupplierDropdown && supplierDropdownPosition && filteredSuppliers.length > 0 && (
                    <div
                      data-supplier-dropdown="true"
                      className="fixed z-[9999] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                      style={{
                        width: `${supplierDropdownPosition.width}px`,
                        top: `${supplierDropdownPosition.top}px`,
                        left: `${supplierDropdownPosition.left}px`,
                      }}
                    >
                      {filteredSuppliers.map((supplier, index) => (
                        <div
                          key={supplier._id}
                          onClick={() => handleSelectSupplier(supplier)}
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white ${index === selectedSupplierIndex ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                            }`}
                        >
                          {supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`}
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:[color-scheme:dark]"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
          {formData.fournisseurId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Type de paiement</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <label className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <input
                    type="radio"
                    name="paymentType"
                    value="invoices"
                    checked={paymentType === 'invoices'}
                    onChange={(e) => setPaymentType(e.target.value as 'invoices' | 'onAccount')}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Paiement sur factures</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Régler des factures spécifiques</div>
                  </div>
                </label>
                <label className="flex items-center p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <input
                    type="radio"
                    name="paymentType"
                    value="onAccount"
                    checked={paymentType === 'onAccount'}
                    onChange={(e) => setPaymentType(e.target.value as 'invoices' | 'onAccount')}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Paiement sur compte</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Payer sans facture spécifique</div>
                  </div>
                </label>
              </div>

              {/* Payment on Account */}
              {paymentType === 'onAccount' && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">

                  {/* Avoir Selection */}
                  {availableAvoirs.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Convertir un Avoir (Optionnel)
                      </label>
                      <select
                        value={selectedAvoir}
                        onChange={(e) => setSelectedAvoir(e.target.value)}
                        className="w-full md:w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      >
                        <option value="">-- Aucun (Paiement standard) --</option>
                        {availableAvoirs.map(avoir => (
                          <option key={avoir._id} value={avoir._id}>
                            {avoir.numero} - Reste: {avoir.soldeRestant.toFixed(3)} DT (Total: {avoir.montantTotal.toFixed(3)})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                        Sélectionnez un avoir pour convertir son solde restant en avance fournisseur.
                      </p>
                    </div>
                  )}

                  <div>
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
                      readOnly={!!selectedAvoir} // Lock amount if converting avoir
                      className={`w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${selectedAvoir ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                      placeholder="0.000"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      {selectedAvoir
                        ? "Le montant correspond au solde restant de l'avoir sélectionné."
                        : "Ce montant sera déduit du solde du fournisseur sans être lié à une facture spécifique."}
                    </p>
                  </div>
                </div>
              )}

              {/* Factures non payées */}
              {paymentType === 'invoices' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Factures non payées</h3>
                  </div>
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
                    </div>
                  ) : unpaidInvoices.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Aucune facture impayée pour ce fournisseur</p>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                      {/* Desktop Table */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sélection</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">N° Facture Fournisseur</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Montant Total</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                <span title="المبلغ المدفوع مسبقاً في دفعات سابقة">Déjà Payé</span>
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Solde Restant</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Montant à Payer</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {unpaidInvoices.map((invoice) => {
                              const isSelected = !!selectedInvoices[invoice._id];
                              const selectedInvoice = selectedInvoices[invoice._id];
                              return (
                                <tr key={invoice._id} className={`${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}>
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleInvoiceSelection(invoice)}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                    {invoice.referenceFournisseur || invoice.numero || '—'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(invoice.dateFacture).toLocaleDateString('fr-FR')}
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
                                        min={invoice.soldeRestant < 0 ? invoice.soldeRestant : 0}
                                        max={invoice.soldeRestant < 0 ? 0 : invoice.soldeRestant}
                                        step="0.001"
                                        value={selectedInvoice.montantPayeInput || 0}
                                        onChange={(e) => updatePaymentAmount(invoice._id, parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gray-50 dark:bg-gray-700">
                            {(() => {
                              const totalPositive = Object.values(selectedInvoices)
                                .reduce((sum, inv) => sum + Math.max(0, inv.montantPayeInput || 0), 0);
                              const totalNegative = Object.values(selectedInvoices)
                                .reduce((sum, inv) => sum + Math.min(0, inv.montantPayeInput || 0), 0);

                              return (
                                <>
                                  {totalNegative < 0 && (
                                    <>
                                      <tr>
                                        <td colSpan={6} className="px-4 py-1 text-right text-xs text-gray-500 dark:text-gray-400 border-none">
                                          Total Factures:
                                        </td>
                                        <td className="px-4 py-1 text-right text-xs font-medium text-gray-900 dark:text-white border-none">
                                          {totalPositive.toFixed(3)} DT
                                        </td>
                                      </tr>
                                      <tr>
                                        <td colSpan={6} className="px-4 py-1 text-right text-xs text-gray-500 dark:text-gray-400 border-none">
                                          Total Avoirs déduits:
                                        </td>
                                        <td className="px-4 py-1 text-right text-xs font-medium text-red-600 dark:text-red-400 border-none">
                                          {totalNegative.toFixed(3)} DT
                                        </td>
                                      </tr>
                                    </>
                                  )}
                                  <tr>
                                    <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-600">
                                      {totalNegative < 0 ? 'Net à payer (Total):' : 'Total du paiement:'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-blue-600 dark:text-blue-400 border-t border-gray-200 dark:border-gray-600">
                                      {total.toFixed(3)} DT
                                    </td>
                                  </tr>
                                </>
                              );
                            })()}
                          </tfoot>
                        </table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="lg:hidden space-y-4 p-4">
                        {unpaidInvoices.map((invoice) => {
                          const isSelected = !!selectedInvoices[invoice._id];
                          const selectedInvoice = selectedInvoices[invoice._id];
                          return (
                            <div key={invoice._id} className={`p-4 border rounded-lg shadow-sm space-y-3 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleInvoiceSelection(invoice)}
                                  className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                                />
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <h3 className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                      {invoice.referenceFournisseur || invoice.numero || '—'}
                                    </h3>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">
                                      {new Date(invoice.dateFacture).toLocaleDateString('fr-FR')}
                                    </span>
                                  </div>

                                  <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-500 dark:text-gray-400">Total</span>
                                      <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{invoice.montantTotal.toFixed(3)} DT</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-500 dark:text-gray-400">Déjà payé</span>
                                      <span className="text-gray-900 dark:text-white whitespace-nowrap">{invoice.montantPaye.toFixed(3)} DT</span>
                                    </div>
                                  </div>

                                  <div className="mt-3 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-transparent dark:border-gray-700 gap-4">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Reste à payer</span>
                                    <span className="text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">{invoice.soldeRestant.toFixed(3)} DT</span>
                                  </div>

                                  {isSelected && (
                                    <div className="mt-3">
                                      <label className="block text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Montant à payer</label>
                                      <input
                                        type="number"
                                        min={invoice.soldeRestant < 0 ? invoice.soldeRestant : 0}
                                        max={invoice.soldeRestant < 0 ? 0 : invoice.soldeRestant}
                                        step="0.001"
                                        value={selectedInvoice.montantPayeInput || 0}
                                        onChange={(e) => updatePaymentAmount(invoice._id, parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg text-right font-medium focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Mobile Total */}
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex justify-between items-center border border-gray-200 dark:border-gray-700 shadow-sm">
                          <span className="font-bold text-gray-700 dark:text-gray-200">Total sélectionné:</span>
                          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{total.toFixed(3)} DT</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => router.push('/purchases/payments')}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (paymentType === 'onAccount' ? total <= 0 : Object.keys(selectedInvoices).length === 0)}
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

