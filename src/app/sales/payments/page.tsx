'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, TrashIcon, BanknotesIcon, XMarkIcon, CheckCircleIcon, PhotoIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ImageGallery, { ImageItem } from '@/components/common/ImageGallery';
import ImageUploader, { ImageData } from '@/components/common/ImageUploader';

interface Payment {
  _id: string;
  numero: string;
  datePaiement: string;
  customerId: string;
  customerNom?: string;
  modePaiement: string;
  reference?: string;
  montantTotal: number;
  lignes: Array<{
    factureId?: string;
    numeroFacture?: string;
    referenceExterne?: string;
    montantFacture?: number;
    montantPaye: number;
    soldeRestant?: number;
    isPaymentOnAccount?: boolean;
  }>;
  notes?: string;
  isPaymentOnAccount?: boolean;
  images?: ImageItem[];
}

interface Customer {
  _id: string;
  code?: string;
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
  estPayee: boolean;
  estPartiellementPayee: boolean;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<{ [key: string]: number }>({});
  const [advanceBalance, setAdvanceBalance] = useState(0);
  const [useAdvance, setUseAdvance] = useState(false);
  const [selectedPaymentImages, setSelectedPaymentImages] = useState<{ paymentNumero: string; images: ImageItem[] } | null>(null);
  const [showAddImagesModal, setShowAddImagesModal] = useState(false);
  const [selectedPaymentForImages, setSelectedPaymentForImages] = useState<Payment | null>(null);
  const [newImages, setNewImages] = useState<ImageData[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [formData, setFormData] = useState({
    datePaiement: new Date().toISOString().split('T')[0],
    modePaiement: 'Espèces',
    reference: '',
    notes: '',
  });

  useEffect(() => {
    if (tenantId) {
      fetchPayments();
      fetchCustomers();
    }
  }, [tenantId, q]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchUnpaidInvoices();
      fetchAdvanceBalance();
    } else {
      setUnpaidInvoices([]);
      setSelectedInvoices({});
      setAdvanceBalance(0);
    }
  }, [selectedCustomerId, tenantId]);

  async function fetchPayments() {
    if (!tenantId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/sales/payments?search=${q}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📦 [Sales Payments List] API Response:', data);
        console.log('📦 [Sales Payments List] Payments items:', data.items);
        if (data.items && data.items.length > 0) {
          console.log('📦 [Sales Payments List] First payment:', data.items[0]);
          console.log('📦 [Sales Payments List] First payment images:', data.items[0].images);
        }
        setPayments(data.items || []);
      } else {
        console.error('❌ [Sales Payments List] API Error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ [Sales Payments List] Error fetching payments:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomers() {
    if (!tenantId) return;
    try {
      const response = await fetch('/api/customers', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }

  async function fetchUnpaidInvoices() {
    if (!tenantId || !selectedCustomerId) return;
    try {
      const response = await fetch(`/api/sales/payments/unpaid-invoices?customerId=${selectedCustomerId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const invoices = await response.json();
        setUnpaidInvoices(invoices);
        // Initialize selected invoices with remaining amounts
        const initial: { [key: string]: number } = {};
        invoices.forEach((inv: UnpaidInvoice) => {
          initial[inv._id] = inv.soldeRestant;
        });
        setSelectedInvoices(initial);
      }
    } catch (error) {
      console.error('Error fetching unpaid invoices:', error);
      toast.error('Erreur lors du chargement des factures');
    }
  }

  async function fetchAdvanceBalance() {
    if (!tenantId || !selectedCustomerId) return;
    try {
      const response = await fetch(`/api/customers/${selectedCustomerId}/balance`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setAdvanceBalance(data.netAdvanceBalance || 0);
      }
    } catch (error) {
      console.error('Error fetching advance balance:', error);
    }
  }

  const filteredCustomers = customers.filter(customer => {
    const search = customerSearch.toLowerCase();
    const name = (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`).toLowerCase();
    const code = (customer.code || '').toLowerCase();
    return name.includes(search) || code.includes(search);
  });

  const filtered = payments.filter(payment =>
    payment.numero.toLowerCase().includes(q.toLowerCase()) ||
    (payment.customerNom && payment.customerNom.toLowerCase().includes(q.toLowerCase())) ||
    (payment.reference && payment.reference.toLowerCase().includes(q.toLowerCase()))
  );

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer._id);
    setCustomerSearch(customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim());
    setShowCustomerDropdown(false);
    setSelectedCustomerIndex(-1);
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => 
        prev < filteredCustomers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedCustomerIndex >= 0) {
      e.preventDefault();
      handleSelectCustomer(filteredCustomers[selectedCustomerIndex]);
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
    }
  };

  const totalToPay = Object.values(selectedInvoices).reduce((sum, amount) => sum + amount, 0);

  const handleCreatePayment = async () => {
    if (!tenantId || !selectedCustomerId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    const selectedInvoiceIds = Object.keys(selectedInvoices).filter(id => selectedInvoices[id] > 0);
    if (selectedInvoiceIds.length === 0 && !useAdvance) {
      toast.error('Veuillez sélectionner au moins une facture');
      return;
    }
    
    if (useAdvance && selectedInvoiceIds.length === 0 && advanceBalance <= 0) {
      toast.error('Aucun solde avance disponible');
      return;
    }

    // Validate payment amounts
    for (const invoiceId of selectedInvoiceIds) {
      const invoice = unpaidInvoices.find(inv => inv._id === invoiceId);
      if (invoice) {
        const amount = selectedInvoices[invoiceId];
        if (amount > invoice.soldeRestant + 0.001) {
          toast.error(`Le montant pour la facture ${invoice.numero} ne peut pas dépasser ${invoice.soldeRestant.toFixed(3)}`);
          return;
        }
      }
    }

    // Validate advance usage
    let advanceToUse = 0;
    if (useAdvance) {
      if (advanceBalance <= 0) {
        toast.error('Aucun solde avance disponible');
        return;
      }
      // When using advance, the amount to pay must not exceed the available advance balance
      if (totalToPay > advanceBalance + 0.001) {
        toast.error(`Le montant total (${totalToPay.toFixed(3)}) dépasse le solde avance disponible (${advanceBalance.toFixed(3)})`);
        return;
      }
      advanceToUse = totalToPay; // Use the full amount from advance
    }

    try {
      const lignes = selectedInvoiceIds
        .filter(invoiceId => selectedInvoices[invoiceId] > 0)
        .map(invoiceId => {
          const invoice = unpaidInvoices.find(inv => inv._id === invoiceId);
          return {
            factureId: invoiceId,
            montantPaye: selectedInvoices[invoiceId],
          };
        });

      // If no invoices selected but using advance, create payment on account
      if (lignes.length === 0 && useAdvance) {
        lignes.push({
          montantPaye: advanceBalance,
        } as any);
      }

      const payload: any = {
        customerId: selectedCustomerId,
        datePaiement: formData.datePaiement,
        modePaiement: useAdvance ? 'Avance' : formData.modePaiement,
        reference: formData.reference,
        notes: formData.notes,
        lignes,
        useAdvanceBalance: useAdvance,
        currentAdvanceBalance: advanceBalance,
        advanceUsed: advanceToUse,
      };
      
      // If using advance and amount paid is less than available advance, create payment on account for remaining
      if (useAdvance && advanceBalance > totalToPay && totalToPay > 0) {
        payload.createRemainingAdvance = true;
        payload.remainingAdvance = advanceBalance - totalToPay;
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
        toast.success('Paiement créé avec succès');
        setShowModal(false);
        resetForm();
        fetchPayments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Erreur lors de la création');
    }
  };

  const resetForm = () => {
    setFormData({
      datePaiement: new Date().toISOString().split('T')[0],
      modePaiement: 'Espèces',
      reference: '',
      notes: '',
    });
    setSelectedCustomerId('');
    setCustomerSearch('');
    setUnpaidInvoices([]);
    setSelectedInvoices({});
    setUseAdvance(false);
    setAdvanceBalance(0);
  };

  const handleDelete = async (paymentId: string) => {
    if (!tenantId) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return;

    try {
      const response = await fetch(`/api/sales/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        toast.success('Paiement supprimé');
        fetchPayments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  function handleAddImages(payment: Payment) {
    setSelectedPaymentForImages(payment);
    setNewImages([]);
    setShowAddImagesModal(true);
  }

  async function handleSaveImages() {
    if (!selectedPaymentForImages || !tenantId) return;
    
    if (newImages.length === 0) {
      toast.error('Veuillez ajouter au moins une image');
      return;
    }

    setUploadingImages(true);
    try {
      // Get current payment to merge images
      const currentPayment = payments.find(p => p._id === selectedPaymentForImages._id);
      const existingImages = currentPayment?.images || [];
      const allImages = [...existingImages, ...newImages];

      const response = await fetch(`/api/sales/payments/${selectedPaymentForImages._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          images: allImages,
        }),
      });

      if (response.ok) {
        toast.success(`${newImages.length} image(s) ajoutée(s) avec succès`);
        setShowAddImagesModal(false);
        setSelectedPaymentForImages(null);
        setNewImages([]);
        fetchPayments(); // Refresh the list
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de l\'ajout des images');
      }
    } catch (error) {
      console.error('Error saving images:', error);
      toast.error('Erreur lors de l\'ajout des images');
    } finally {
      setUploadingImages(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Paiements clients</h1>
          <button
            onClick={() => router.push('/sales/payments/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-5 h-5" />
            Nouveau paiement
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro, client, référence..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Images</th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Chargement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    Aucun paiement trouvé
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => {
                  console.log('🖼️ [Sales Payments List] Rendering payment:', payment.numero, 'images:', payment.images);
                  return (
                  <tr key={payment._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {payment.numero}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(payment.datePaiement).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {payment.customerNom || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.modePaiement}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {payment.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(payment.montantTotal)} TND
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {payment.images && payment.images.length > 0 ? (
                        <button
                          onClick={() => setSelectedPaymentImages({ paymentNumero: payment.numero, images: payment.images! })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                          title={`${payment.images.length} image(s) jointe(s)`}
                        >
                          <PhotoIcon className="w-4 h-4" />
                          <span>{payment.images.length}</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => router.push(`/sales/payments/${payment._id}`)}
                          className="p-1.5 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                          title="Voir les détails"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAddImages(payment)}
                          className="p-1.5 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded transition-colors"
                          title="Ajouter des images"
                        >
                          <PlusCircleIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(payment._id)}
                          className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Create Payment Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nouveau paiement</h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                        setSelectedCustomerIndex(-1);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onKeyDown={handleCustomerKeyDown}
                      placeholder="Rechercher un client..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                        {filteredCustomers.map((customer, index) => (
                          <div
                            key={customer._id}
                            onClick={() => handleSelectCustomer(customer)}
                            className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                              index === selectedCustomerIndex ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="font-medium">
                              {customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim()}
                            </div>
                            {customer.code && (
                              <div className="text-sm text-gray-500">{customer.code}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de paiement *
                    </label>
                    <input
                      type="date"
                      value={formData.datePaiement}
                      onChange={(e) => setFormData({ ...formData, datePaiement: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mode de paiement *
                    </label>
                    <select
                      value={formData.modePaiement}
                      onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={useAdvance}
                    >
                      <option value="Espèces">Espèces</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Virement">Virement</option>
                      <option value="Carte">Carte</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Référence
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="N° de chèque, référence virement..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={useAdvance}
                  />
                </div>

                {/* Advance Balance */}
                {selectedCustomerId && advanceBalance > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-green-800">
                          Solde avance disponible
                        </div>
                        <div className="text-lg font-bold text-green-900">
                          {formatCurrency(advanceBalance)} TND
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useAdvance}
                          onChange={(e) => setUseAdvance(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-green-800">
                          Utiliser l'avance
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Unpaid Invoices */}
                {selectedCustomerId && unpaidInvoices.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Factures impayées
                    </label>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">N°</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Payé</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Reste</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Montant à payer</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {unpaidInvoices.map((invoice) => (
                            <tr key={invoice._id}>
                              <td className="px-4 py-2 text-sm">{invoice.numero}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">
                                {new Date(invoice.dateDoc).toLocaleDateString('fr-FR')}
                              </td>
                              <td className="px-4 py-2 text-sm">{formatCurrency(invoice.montantTotal)}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{formatCurrency(invoice.montantPaye)}</td>
                              <td className="px-4 py-2 text-sm font-medium">{formatCurrency(invoice.soldeRestant)}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max={invoice.soldeRestant}
                                  step="0.001"
                                  value={selectedInvoices[invoice._id] || 0}
                                  onChange={(e) => {
                                    const value = Math.min(invoice.soldeRestant, Math.max(0, parseFloat(e.target.value) || 0));
                                    setSelectedInvoices({ ...selectedInvoices, [invoice._id]: value });
                                  }}
                                  className="w-32 px-2 py-1 border rounded text-sm"
                                  disabled={useAdvance}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <div className="text-lg font-bold">
                        Total à payer: {formatCurrency(totalToPay)} TND
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Notes supplémentaires..."
                  />
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreatePayment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Images Modal */}
        {showAddImagesModal && selectedPaymentForImages && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  Ajouter des images - Paiement {selectedPaymentForImages.numero}
                </h2>
                <button
                  onClick={() => {
                    setShowAddImagesModal(false);
                    setSelectedPaymentForImages(null);
                    setNewImages([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <ImageUploader
                  images={newImages}
                  onChange={setNewImages}
                  maxImages={10}
                  maxSizeMB={5}
                  label="Images jointes (Chèque, Virement, etc.)"
                  folder="erp-uploads"
                />
              </div>
              <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setShowAddImagesModal(false);
                    setSelectedPaymentForImages(null);
                    setNewImages([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveImages}
                  disabled={uploadingImages || newImages.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingImages ? 'Enregistrement...' : `Enregistrer ${newImages.length} image(s)`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Images Modal */}
        {selectedPaymentImages && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">
                  Images - Paiement {selectedPaymentImages.paymentNumero}
                </h2>
                <button
                  onClick={() => setSelectedPaymentImages(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <ImageGallery images={selectedPaymentImages.images} title="" />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

