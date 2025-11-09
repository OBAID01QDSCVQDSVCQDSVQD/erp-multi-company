'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    if (tenantId) {
      fetchSuppliers();
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId && formData.fournisseurId) {
      fetchUnpaidInvoices();
    } else {
      setUnpaidInvoices([]);
      setSelectedInvoices({});
    }
  }, [tenantId, formData.fournisseurId]);

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

    if (!formData.fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur');
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
      };

      if (paymentType === 'onAccount') {
        payload.isPaymentOnAccount = true;
        payload.montantOnAccount = montantOnAccount;
        payload.lignes = [];
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
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  {showSupplierDropdown && supplierDropdownPosition && filteredSuppliers.length > 0 && (
                    <div
                      data-supplier-dropdown="true"
                      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
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
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                            index === selectedSupplierIndex ? 'bg-blue-50' : ''
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
                <label htmlFor="datePaiement" className="block text-sm font-medium text-gray-700 mb-1">
                  Date de paiement *
                </label>
                <input
                  type="date"
                  id="datePaiement"
                  value={formData.datePaiement}
                  onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="modePaiement" className="block text-sm font-medium text-gray-700 mb-1">
                  Mode de paiement *
                </label>
                <select
                  id="modePaiement"
                  value={formData.modePaiement}
                  onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Carte">Carte</option>
                  <option value="Traite">Traite</option>
                </select>
              </div>

              <div>
                <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1">
                  Référence
                </label>
                <input
                  type="text"
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="N° chèque, référence virement, etc."
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Notes additionnelles..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Type de paiement */}
          {formData.fournisseurId && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Type de paiement</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="paymentType"
                    value="invoices"
                    checked={paymentType === 'invoices'}
                    onChange={(e) => setPaymentType(e.target.value as 'invoices' | 'onAccount')}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Paiement sur factures</div>
                    <div className="text-sm text-gray-500">Régler des factures spécifiques</div>
                  </div>
                </label>
                <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="paymentType"
                    value="onAccount"
                    checked={paymentType === 'onAccount'}
                    onChange={(e) => setPaymentType(e.target.value as 'invoices' | 'onAccount')}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Paiement sur compte</div>
                    <div className="text-sm text-gray-500">Payer sans facture spécifique</div>
                  </div>
                </label>
              </div>

              {/* Payment on Account */}
              {paymentType === 'onAccount' && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <label htmlFor="montantOnAccount" className="block text-sm font-medium text-gray-700 mb-2">
                    Montant du paiement sur compte *
                  </label>
                  <input
                    type="number"
                    id="montantOnAccount"
                    min="0"
                    step="0.001"
                    value={montantOnAccount || ''}
                    onChange={(e) => setMontantOnAccount(parseFloat(e.target.value) || 0)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="0.000"
                    required
                  />
                  <p className="mt-2 text-xs text-gray-600">
                    Ce montant sera déduit du solde du fournisseur sans être lié à une facture spécifique.
                  </p>
                </div>
              )}

              {/* Factures non payées */}
              {paymentType === 'invoices' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Factures non payées</h3>
                    <div className="text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded-lg">
                      <strong>💡 Explication:</strong> "Déjà Payé" = المبلغ المدفوع مسبقاً في دفعات سابقة لهذه الفاتورة
                    </div>
                  </div>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : unpaidInvoices.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucune facture impayée pour ce fournisseur</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sélection</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° Facture Fournisseur</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant Total</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <span title="المبلغ المدفوع مسبقاً في دفعات سابقة">Déjà Payé</span>
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Solde Restant</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant à Payer</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {unpaidInvoices.map((invoice) => {
                        const isSelected = !!selectedInvoices[invoice._id];
                        const selectedInvoice = selectedInvoices[invoice._id];
                        return (
                          <tr key={invoice._id} className={isSelected ? 'bg-blue-50' : ''}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleInvoiceSelection(invoice)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {invoice.referenceFournisseur || invoice.numero || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(invoice.dateFacture).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {invoice.montantTotal.toFixed(3)} DT
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-500">
                              {invoice.montantPaye.toFixed(3)} DT
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
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
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Total du paiement:
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                          {total.toFixed(3)} DT
                        </td>
                      </tr>
                    </tfoot>
                  </table>
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
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
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

