'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  PlusIcon,
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import ProductSearchModal from '@/components/common/ProductSearchModal';
import toast from 'react-hot-toast';

interface Order {
  _id: string;
  numero: string;
  dateDoc: string;
  customerId?: any;
  statut: string;
  totalTTC: number;
  devise?: string;
  dateLivraisonPrevue?: string;
}

interface Customer {
  _id: string;
  code?: string;
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  matriculeFiscale?: string;
  adresseFacturation?: {
    ligne1?: string;
    ville?: string;
    codePostal?: string;
  };
}

interface Product {
  _id: string;
  nom: string;
  sku?: string;
  referenceClient?: string;
  prixVenteHT?: number;
  taxCode?: string;
  tvaPct?: number;
  uomVenteCode?: string;
}

export default function OrdersPage() {
  const { tenantId } = useTenantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modesReglement, setModesReglement] = useState<string[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);

  // Autocomplete
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

  // Product Search Modal
  const [productSearches, setProductSearches] = useState<{ [key: number]: string }>({});
  const [showProductModal, setShowProductModal] = useState<{ [key: number]: boolean }>({});
  const [currentProductLineIndex, setCurrentProductLineIndex] = useState<number | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    customerId: '',
    dateDoc: new Date().toISOString().split('T')[0],
    dateLivraisonPrevue: '',
    referenceExterne: '',
    devise: 'TND',
    modePaiement: 'Espèces',
    notes: '',
    remiseGlobalePct: 0,
    timbreActif: false,
    fodec: { enabled: false, tauxPct: 1, montant: 0 }
  });

  const [lines, setLines] = useState<Array<{
    productId: string;
    codeAchat?: string;
    designation: string;
    quantite: number;
    uomCode: string;
    prixUnitaireHT: number;
    tvaPct: number;
    remisePct?: number;
    totalLine: number;
  }>>([]);

  useEffect(() => {
    if (tenantId) fetchOrders();
  }, [tenantId]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-autocomplete')) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      if (!tenantId) return;
      const response = await fetch('/api/sales/orders', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error('Erreur lors du chargement des commandes');
    } finally {
      setLoading(false);
    }
  };

  const loadDependencies = async () => {
    if (!tenantId) return;
    setLoadingData(true);
    try {
      const [custRes, prodRes, setRes, taxRes] = await Promise.all([
        fetch('/api/customers', { headers: { 'X-Tenant-Id': tenantId } }),
        fetch('/api/products', { headers: { 'X-Tenant-Id': tenantId } }),
        fetch('/api/settings', { headers: { 'X-Tenant-Id': tenantId } }),
        fetch('/api/tva/rates?actif=true', { headers: { 'X-Tenant-Id': tenantId } })
      ]);

      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data.items || data || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.items || data || []);
      }
      if (setRes.ok) {
        const data = await setRes.json();
        setModesReglement(data.achats?.modesReglement || ['Espèces', 'Chèque', 'Virement']);
      }
      if (taxRes.ok) {
        const data = await taxRes.json();
        setTaxRates(Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error loading dependencies:', err);
      toast.error('Erreur de chargement des données');
    } finally {
      setLoadingData(false);
    }
  };

  const handleOpenNewOrderModal = () => {
    setEditingOrderId(null);
    setLines([]);
    setFormData({
      customerId: '',
      dateDoc: new Date().toISOString().split('T')[0],
      dateLivraisonPrevue: '',
      referenceExterne: '',
      devise: 'TND',
      modePaiement: 'Espèces',
      notes: '',
      remiseGlobalePct: 0,
      timbreActif: false,
      fodec: { enabled: false, tauxPct: 1, montant: 0 }
    });
    setCustomerSearch('');
    loadDependencies();
    setShowModal(true);
  };

  // --- Filtering & Totals ---

  const filteredOrders = orders.filter(order =>
    order.numero.toLowerCase().includes(q.toLowerCase()) ||
    order.statut.toLowerCase().includes(q.toLowerCase())
  );

  const calculateTotals = () => {
    let totalHTBeforeDiscount = 0;
    let totalHTAfterLineDiscount = 0;

    lines.forEach(line => {
      const lineHT = line.quantite * line.prixUnitaireHT;
      totalHTBeforeDiscount += lineHT;
      totalHTAfterLineDiscount += lineHT * (1 - ((line.remisePct || 0) / 100));
    });

    const remiseGlobalePct = formData.remiseGlobalePct || 0;
    const totalHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));

    const remiseLignes = totalHTBeforeDiscount - totalHTAfterLineDiscount;
    const remiseGlobale = totalHTAfterLineDiscount - totalHT;

    // Fodec calculation
    const fodecAmount = formData.fodec.enabled ? totalHT * (formData.fodec.tauxPct / 100) : 0;

    // Total TVA calculation
    const totalTVA = lines.reduce((sum, line) => {
      const lineBaseHT = (line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100));
      const lineBaseAfterGlobal = lineBaseHT * (1 - (remiseGlobalePct / 100));
      const lineFodec = formData.fodec.enabled ? lineBaseAfterGlobal * (formData.fodec.tauxPct / 100) : 0;
      return sum + ((lineBaseAfterGlobal + lineFodec) * (line.tvaPct / 100));
    }, 0);

    const timbre = formData.timbreActif ? 1.000 : 0; // Fixed value for now or fetch settings

    return {
      totalHTBeforeDiscount,
      totalHT,
      remiseLignes,
      remiseGlobale,
      fodecAmount,
      totalTVA,
      timbre,
      totalTTC: totalHT + fodecAmount + totalTVA + timbre
    };
  };

  const totals = calculateTotals();

  // --- Actions ---

  const handleCreateOrder = async () => {
    if (!formData.customerId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }
    if (lines.length === 0) {
      toast.error('Veuillez ajouter au moins un produit');
      return;
    }

    try {
      if (!tenantId) return;

      const payload = {
        customerId: formData.customerId,
        dateDoc: formData.dateDoc,
        dateLivraisonPrevue: formData.dateLivraisonPrevue || undefined,
        referenceExterne: formData.referenceExterne,
        devise: formData.devise,
        modePaiement: formData.modePaiement,
        notes: formData.notes,
        remiseGlobalePct: formData.remiseGlobalePct,
        timbreFiscal: totals.timbre,
        fodec: formData.fodec.enabled ? {
          enabled: true,
          tauxPct: formData.fodec.tauxPct,
          montant: totals.fodecAmount
        } : undefined,
        lignes: lines.map(l => ({
          productId: l.productId,
          designation: l.designation,
          quantite: l.quantite,
          uomCode: l.uomCode,
          prixUnitaireHT: l.prixUnitaireHT,
          remisePct: l.remisePct || 0,
          tvaPct: l.tvaPct
        }))
      };

      const url = editingOrderId
        ? `/api/sales/orders/${editingOrderId}`
        : '/api/sales/orders';

      const method = editingOrderId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(editingOrderId ? 'Commande modifiée avec succès' : 'Commande créée avec succès');
        setShowModal(false);
        fetchOrders();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Erreur lors de l\'enregistrement');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erreur survenue');
    }
  };

  const handleEditOrder = async (order: Order) => {
    loadDependencies(); // Ensure we have products/customers loaded
    setEditingOrderId(order._id);

    // In strict mode, we might want to fetch the full object again, 
    // but here we can map heavily from the list object, assuming list has enough data.
    // However, list 'lignes' might be missing if aggregation doesn't project them?
    // The previous aggregation DOES project everything by default unless restricted.
    // But let's check if 'lignes' are present in the interface. They are not in the Interface 'Order' at top.
    // We need to fetch the single order details first to get the lines.

    try {
      const res = await fetch(`/api/sales/orders/${order._id}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (res.ok) {
        const fullOrder = await res.json();

        // Mapping
        setFormData({
          customerId: fullOrder.customerId || '',
          dateDoc: new Date(fullOrder.dateDoc).toISOString().split('T')[0],
          dateLivraisonPrevue: fullOrder.dateLivraisonPrevue ? new Date(fullOrder.dateLivraisonPrevue).toISOString().split('T')[0] : '',
          referenceExterne: fullOrder.referenceExterne || '',
          devise: fullOrder.devise || 'TND',
          modePaiement: fullOrder.modePaiement || 'Espèces',
          notes: fullOrder.notes || '',
          remiseGlobalePct: fullOrder.remiseGlobalePct || 0,
          timbreActif: !!(fullOrder.timbreFiscal && fullOrder.timbreFiscal > 0),
          fodec: fullOrder.fodec || { enabled: false, tauxPct: 1, montant: 0 }
        });

        // If customer data is populated in list, utilize it to set search text?
        // Actually fullOrder usually returns raw ID for customerId.
        // We need to find the customer name. 
        // If we called GET /api/sales/orders/:id it returns raw customerId usually if not aggregated.
        // We can find name in our 'customers' list if loaded.
        const foundCustomer = customers.find(c => c._id === fullOrder.customerId);
        if (foundCustomer) {
          setCustomerSearch(foundCustomer.raisonSociale || `${foundCustomer.nom || ''} ${foundCustomer.prenom || ''}`.trim());
        } else {
          // Fallback if not loaded yet (might be async race), try to set it from the list object 'order' passed in
          if (order.customerId && order.customerId.raisonSociale) {
            setCustomerSearch(order.customerId.raisonSociale);
            // Also ensure formData has the ID
            setFormData(prev => ({ ...prev, customerId: order.customerId._id }));
          } else {
            setCustomerSearch('');
          }
          // If we have the full object but customer list isn't ready, we rely on dependency load.
        }

        setLines(fullOrder.lignes?.map((l: any) => ({
          productId: l.productId,
          designation: l.designation,
          quantite: l.quantite,
          uomCode: l.uomCode,
          prixUnitaireHT: l.prixUnitaireHT,
          tvaPct: l.tvaPct,
          remisePct: l.remisePct,
          totalLine: 0
        })) || []);

        setShowModal(true);
      } else {
        toast.error('Impossible de charger la commande');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors du chargement');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) return;

    try {
      const res = await fetch(`/api/sales/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (res.ok) {
        toast.success('Commande supprimée');
        fetchOrders();
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erreur système');
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (!confirm(`Changer le statut en "${newStatus}" ?`)) return;

    try {
      const res = await fetch(`/api/sales/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({ statut: newStatus })
      });

      if (res.ok) {
        toast.success(`Statut mis à jour`);
        fetchOrders();
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erreur serveur');
    }
  };

  // --- Autocomplete Helpers ---
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 50);
    const lower = customerSearch.toLowerCase();
    return customers.filter(c =>
      (c.raisonSociale || '').toLowerCase().includes(lower) ||
      (c.nom || '').toLowerCase().includes(lower) ||
      (c.code || '').toLowerCase().includes(lower)
    ).slice(0, 50);
  }, [customers, customerSearch]);

  const handleSelectCustomer = (c: Customer) => {
    setFormData(prev => ({ ...prev, customerId: c._id }));
    setCustomerSearch(c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim());
    setShowCustomerDropdown(false);
  };

  const addLine = () => {
    setLines([...lines, {
      productId: '',
      designation: '',
      quantite: 1,
      uomCode: 'U',
      prixUnitaireHT: 0,
      tvaPct: 19,
      remisePct: 0,
      totalLine: 0
    }]);
  };

  const updateLine = (idx: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], [field]: value };
    setLines(newLines);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <ShoppingCartIcon className="w-8 h-8" /> Commandes
          </h1>
          <button
            onClick={handleOpenNewOrderModal}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <PlusIcon className="w-5 h-5" /> Nouvelle commande
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une commande..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* --- List View --- */}
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Aucune commande trouvée
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Numéro</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total TTC</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredOrders.map(order => (
                    <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 text-sm font-medium text-blue-600 dark:text-blue-400">{order.numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{new Date(order.dateDoc).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {order.customerId?.raisonSociale || `${order.customerId?.nom || ''} ${order.customerId?.prenom || ''}`}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.statut}
                          onChange={(e) => handleStatusChange(order._id, e.target.value)}
                          className={`appearance-none cursor-pointer outline-none border-none py-1 pl-3 pr-8 rounded-full text-xs font-bold uppercase tracking-wider
                            ${order.statut === 'VALIDEE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              order.statut === 'LIVREE' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' :
                                order.statut === 'ANNULEE' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}
                          `}
                          style={{ backgroundImage: 'none' }} // Hide default arrow if desired, or keep it
                        >
                          <option value="BROUILLON" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Brouillon</option>
                          <option value="VALIDEE" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Validée</option>
                          <option value="LIVREE" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Livrée</option>
                          <option value="ANNULEE" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Annulée</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-gray-900 dark:text-white">
                        {order.totalTTC.toFixed(3)} {order.devise}
                      </td>
                      <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                        <a href={`/sales/orders/${order._id}`} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors">
                          <EyeIcon className="w-5 h-5" />
                        </a>
                        <button onClick={() => handleEditOrder(order)} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors">
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDeleteOrder(order._id)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {filteredOrders.map(order => (
                <div key={order._id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-blue-600 dark:text-blue-400">{order.numero}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{new Date(order.dateDoc).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-1">
                      <a href={`/sales/orders/${order._id}`} className="p-1 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <EyeIcon className="w-4 h-4" />
                      </a>
                      <button onClick={() => handleEditOrder(order)} className="p-1 text-green-600 bg-green-50 dark:bg-green-900/20 rounded">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteOrder(order._id)} className="p-1 text-red-600 bg-red-50 dark:bg-red-900/20 rounded">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <select
                      value={order.statut}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                      className={`appearance-none cursor-pointer outline-none border-none py-1 pl-3 pr-2 rounded-full text-xs font-bold uppercase tracking-wider text-center
                            ${order.statut === 'VALIDEE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                          order.statut === 'LIVREE' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' :
                            order.statut === 'ANNULEE' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}
                          `}
                    >
                      <option value="BROUILLON" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Brouillon</option>
                      <option value="VALIDEE" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Validée</option>
                      <option value="LIVREE" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Livrée</option>
                      <option value="ANNULEE" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">Annulée</option>
                    </select>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    {order.customerId?.raisonSociale || `${order.customerId?.nom || ''} ${order.customerId?.prenom || ''}`}
                  </div>
                  <div className="flex justify-between items-end border-t dark:border-gray-700 pt-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total TTC</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{order.totalTTC.toFixed(3)} {order.devise}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Create/Edit Modal --- */}
        {showModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col">
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingOrderId ? 'Modifier Commande' : 'Nouvelle Commande'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Customer & Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Search */}
                  <div className="relative customer-autocomplete">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client *</label>
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Rechercher un client..."
                      />
                    </div>
                    {showCustomerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.map(c => (
                          <div
                            key={c._id}
                            onClick={() => handleSelectCustomer(c)}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-900 dark:text-white"
                          >
                            {c.raisonSociale || `${c.nom} ${c.prenom}`}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={formData.dateDoc}
                        onChange={(e) => setFormData({ ...formData, dateDoc: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Livraison Prévue</label>
                      <input
                        type="date"
                        value={formData.dateLivraisonPrevue}
                        onChange={(e) => setFormData({ ...formData, dateLivraisonPrevue: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Extra Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Référence Externe</label>
                    <input
                      type="text"
                      value={formData.referenceExterne}
                      onChange={(e) => setFormData({ ...formData, referenceExterne: e.target.value })}
                      placeholder="Ex: BC-12345"
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mode de Paiement</label>
                    <select
                      value={formData.modePaiement}
                      onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      {modesReglement.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Devise</label>
                    <select
                      value={formData.devise}
                      onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="TND">TND (Dinar Tunisien)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="USD">USD (Dollar)</option>
                    </select>
                  </div>
                </div>

                {/* Lines Table Section */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lignes de commande</h3>
                    <button onClick={addLine} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">+ Ajouter produit</button>
                  </div>

                  <div className="overflow-x-auto border dark:border-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">Qté</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">Prix HT</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">Rem %</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">TVA %</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total HT</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                        {lines.length === 0 && (
                          <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Aucun produit ajouté</td></tr>
                        )}
                        {lines.map((line, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">
                              <div
                                onClick={() => {
                                  setCurrentProductLineIndex(idx);
                                  setShowProductModal({ ...showProductModal, [idx]: true });
                                }}
                                className="w-full min-w-[180px] px-3 py-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 cursor-pointer text-sm text-gray-900 dark:text-white truncate"
                              >
                                {line.designation || 'Sélectionner un produit...'}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" value={line.quantite}
                                onChange={(e) => updateLine(idx, 'quantite', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="0.001" value={line.prixUnitaireHT}
                                onChange={(e) => updateLine(idx, 'prixUnitaireHT', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" max="100" value={line.remisePct}
                                onChange={(e) => updateLine(idx, 'remisePct', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select value={line.tvaPct} onChange={(e) => updateLine(idx, 'tvaPct', parseFloat(e.target.value))}
                                className="w-full px-1 py-1 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                              >
                                {Array.isArray(taxRates) && taxRates.map(t => <option key={t.code} value={t.tauxPct}>{t.tauxPct}%</option>)}
                                <option value={0}>0%</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-white font-medium">
                              {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Totals */}
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 flex flex-col items-end gap-2">
                  <div className="flex justify-between w-full md:w-1/3 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total HT</span>
                    <span className="font-medium text-gray-900 dark:text-white">{totals.totalHT.toFixed(3)} {formData.devise}</span>
                  </div>
                  <div className="flex justify-between w-full md:w-1/3 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total TVA</span>
                    <span className="font-medium text-gray-900 dark:text-white">{totals.totalTVA.toFixed(3)} {formData.devise}</span>
                  </div>
                  <div className="flex justify-between w-full md:w-1/3 text-sm border-t dark:border-gray-600 pt-2 mt-1">
                    <span className="text-base font-bold text-gray-900 dark:text-white">Total TTC</span>
                    <span className="text-base font-bold text-blue-600 dark:text-blue-400">{totals.totalTTC.toFixed(3)} {formData.devise}</span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-5 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3 rounded-b-xl">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">
                  Annuler
                </button>
                <button onClick={handleCreateOrder} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Selection Modal */}
        {currentProductLineIndex !== null && showProductModal[currentProductLineIndex] && (
          <ProductSearchModal
            isOpen={true}
            onClose={() => {
              setCurrentProductLineIndex(null);
            }}
            onSelect={(product) => {
              const newLines = [...lines];
              newLines[currentProductLineIndex] = {
                ...newLines[currentProductLineIndex],
                productId: product._id,
                designation: product.nom,
                prixUnitaireHT: product.prixVenteHT || 0,
                tvaPct: product.tvaPct || 19,
                uomCode: product.uomVenteCode || 'U'
              };
              setLines(newLines);
              setCurrentProductLineIndex(null);
            }}
            products={products}
            tenantId={tenantId || ''}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
