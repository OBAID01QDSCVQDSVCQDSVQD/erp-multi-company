'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, DocumentTextIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, ArrowDownTrayIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ProductSearchModal from '@/components/common/ProductSearchModal';

interface Delivery {
  _id: string;
  numero: string;
  dateDoc: string;
  // Peut être soit un ObjectId (string) soit un objet client déjà peuplé
  customerId?: string | {
    _id?: string;
    raisonSociale?: string;
    nom?: string;
    prenom?: string;
  };
  customerName?: string;
  totalBaseHT?: number;
  totalRemise?: number;
  totalTVA?: number;
  timbreFiscal?: number;
  totalTTC: number;
  devise?: string;
}

interface Customer {
  _id: string;
  code?: string;
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  matriculeFiscale?: string;
}

interface Product {
  _id: string;
  nom: string;
  sku?: string;
  referenceClient?: string;
  categorieCode?: string;
  prixVenteHT?: number;
  taxCode?: string;
  uomVenteCode?: string;
  tvaPct?: number;
}

export default function DeliveriesPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [taxRates, setTaxRates] = useState<Array<{ code: string; tauxPct: number }>>([]);
  const [tvaSettings, setTvaSettings] = useState<any>(null);
  const [modesReglement, setModesReglement] = useState<string[]>([]);
  
  // Autocomplete state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);
  
  // Product autocomplete state per line
  const [productSearches, setProductSearches] = useState<{ [key: number]: string }>({});
  const [showProductModal, setShowProductModal] = useState<{ [key: number]: boolean }>({});
  const [currentProductLineIndex, setCurrentProductLineIndex] = useState<number | null>(null);
  const [productStocks, setProductStocks] = useState<{ [productId: string]: number }>({});
  const [saving, setSaving] = useState(false);
  
  // Calculate default delivery date (today)
  const getDefaultDeliveryDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    dateDoc: new Date().toISOString().split('T')[0],
    referenceExterne: '',
    devise: 'TND',
    modePaiement: 'Espèces',
    dateLivraisonPrevue: getDefaultDeliveryDate(),
    dateLivraisonReelle: getDefaultDeliveryDate(),
    lieuLivraison: '',
    moyenTransport: '',
    notes: ''
  });
  
  const [lines, setLines] = useState<Array<{
    productId: string;
    codeAchat?: string;
    categorieCode?: string;
    designation: string;
    quantite: number;
    uomCode: string;
    prixUnitaireHT: number;
    taxCode: string;
    tvaPct: number;
    remisePct?: number;
    totalLine: number;
  }>>([]);

  useEffect(() => {
    if (tenantId) fetchDeliveries();
  }, [tenantId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-autocomplete')) {
        setShowCustomerDropdown(false);
      }
      // Product modal is handled by its own close button
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) => {
    const searchLower = customerSearch.toLowerCase().trim();
    if (!searchLower) return true;
    
    const name = (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim()).toLowerCase();
    const code = (customer.code || '').toLowerCase();
    
    // If single letter, use startsWith
    if (searchLower.length === 1) {
      return name.startsWith(searchLower) || code.startsWith(searchLower);
    }
    
    // If more than one letter, use contains
    return name.includes(searchLower) || code.includes(searchLower);
  });

  // Handle customer selection
  const handleSelectCustomer = (customer: Customer) => {
    setFormData({ ...formData, customerId: customer._id });
    setCustomerSearch(customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim());
    setShowCustomerDropdown(false);
    setSelectedCustomerIndex(-1);
  };

  // Handle keyboard navigation
  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (!showCustomerDropdown) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => 
        prev < filteredCustomers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCustomerIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedCustomerIndex >= 0 && filteredCustomers[selectedCustomerIndex]) {
        handleSelectCustomer(filteredCustomers[selectedCustomerIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowCustomerDropdown(false);
      setSelectedCustomerIndex(-1);
    }
  };

  // Handle alphabet filter click
  const handleAlphabetClick = (letter: string) => {
    setCustomerSearch(letter);
    setShowCustomerDropdown(true);
    setSelectedCustomerIndex(0);
  };

  // Filter products based on search (for a specific line)

  // Handle product selection for a specific line
  // Fetch stock for a product
  const fetchProductStock = async (productId: string) => {
    if (!tenantId || !productId) return;
    try {
      const response = await fetch(`/api/stock/product/${productId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setProductStocks((prev) => ({
          ...prev,
          [productId]: data.stockActuel || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching product stock:', error);
    }
  };

  const handleSelectProduct = (product: Product) => {
    if (currentProductLineIndex === null) return;
    const lineIndex = currentProductLineIndex;
    const newLines = [...lines];
    newLines[lineIndex].productId = product._id;
    newLines[lineIndex].designation = product.nom;
    newLines[lineIndex].codeAchat = product.referenceClient || product.sku || '';
    newLines[lineIndex].categorieCode = (product as any).categorieCode || '';
    newLines[lineIndex].prixUnitaireHT = product.prixVenteHT || 0;
    newLines[lineIndex].taxCode = product.taxCode || '';
    newLines[lineIndex].uomCode = product.uomVenteCode || '';
    
    // Use tvaPct from product if available
    if (product.tvaPct !== undefined && product.tvaPct !== null) {
      newLines[lineIndex].tvaPct = product.tvaPct;
    } else if (Array.isArray(taxRates) && taxRates.length > 0 && product.taxCode) {
      const taxRate = taxRates.find(t => t.code === product.taxCode);
      newLines[lineIndex].tvaPct = taxRate ? taxRate.tauxPct : 0;
    } else {
      newLines[lineIndex].tvaPct = 0;
    }
    
    setLines(newLines);
    
    // Fetch stock for the selected product
    fetchProductStock(product._id);
    
    // Update search state
    setProductSearches({ ...productSearches, [lineIndex]: product.nom });
    setShowProductModal({ ...showProductModal, [lineIndex]: false });
    setCurrentProductLineIndex(null);
  };

  const handleOpenProductModal = (lineIndex: number) => {
    setCurrentProductLineIndex(lineIndex);
    setShowProductModal({ ...showProductModal, [lineIndex]: true });
  };

  const handleCloseProductModal = () => {
    if (currentProductLineIndex !== null) {
      setShowProductModal({ ...showProductModal, [currentProductLineIndex]: false });
    }
    setCurrentProductLineIndex(null);
  };

  // Handle alphabet filter click for products

  const fetchCustomers = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/customers', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.items || data || []);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/products', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.items || data || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchTaxRates = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/tva/rates?actif=false', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        const rates = data.items || data || [];
        setTaxRates(rates);
      }
    } catch (err) {
      console.error('Error fetching tax rates:', err);
    }
  };

  const fetchTvaSettings = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setTvaSettings(data.tva);
      }
    } catch (err) {
      console.error('Error fetching TVA settings:', err);
    }
  };

  const fetchModesReglement = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Settings data:', data);
        console.log('achats.modesReglement:', data.achats?.modesReglement);
        setModesReglement(data.achats?.modesReglement || []);
      }
    } catch (err) {
      console.error('Error fetching modes de règlement:', err);
    }
  };

  useEffect(() => {
    if (showModal && tenantId) {
      setLoadingData(true);
      Promise.all([fetchCustomers(), fetchProducts(), fetchTaxRates(), fetchTvaSettings(), fetchModesReglement()]).finally(() => {
        setLoadingData(false);
      });
    }
  }, [showModal, tenantId]);

  // Update product searches when products are loaded to use product names instead of designation
  // This runs after products are loaded to improve product search display
  useEffect(() => {
    if (editingDeliveryId && products.length > 0 && lines.length > 0 && !loadingData) {
      const searches: { [key: number]: string } = { ...productSearches };
      let updated = false;
      
      lines.forEach((line: any, idx: number) => {
        if (line.productId) {
          // Try to find product by ID and update search with product name
          const product = products.find(p => p._id === line.productId);
          if (product && product.nom && searches[idx] !== product.nom) {
            searches[idx] = product.nom;
            updated = true;
          }
        }
      });
      
      if (updated) {
        setProductSearches(searches);
      }
    }
  }, [products, editingDeliveryId, loadingData]);

  const addLine = () => {
    setLines([...lines, {
      productId: '',
      codeAchat: '',
      categorieCode: '',
      designation: '',
      quantite: 1,
      uomCode: '',
      prixUnitaireHT: 0,
      taxCode: '',
      tvaPct: 0,
      remisePct: 0,
      totalLine: 0
    }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // Auto-calculate line total if product selected
    if (field === 'productId' && value) {
      const product = products.find(p => p._id === value);
      if (product) {
        console.log('Product selected:', product);
        newLines[index].designation = product.nom;
        newLines[index].codeAchat = product.referenceClient || product.sku || '';
        newLines[index].categorieCode = (product as any).categorieCode || '';
        newLines[index].prixUnitaireHT = product.prixVenteHT || 0;
        newLines[index].taxCode = product.taxCode || '';
        newLines[index].uomCode = product.uomVenteCode || '';
        
        // Use tvaPct from product if available, otherwise search for it
        if (product.tvaPct !== undefined && product.tvaPct !== null) {
          newLines[index].tvaPct = product.tvaPct;
        } else if (Array.isArray(taxRates) && taxRates.length > 0 && product.taxCode) {
          const taxRate = taxRates.find(t => t.code === product.taxCode);
          newLines[index].tvaPct = taxRate ? taxRate.tauxPct : 0;
        } else {
          newLines[index].tvaPct = 0;
        }
      }
    }
    
    // Recalculate total line (HT only for now, TVA calculated separately)
    if (field === 'quantite' || field === 'prixUnitaireHT') {
      newLines[index].totalLine = newLines[index].quantite * newLines[index].prixUnitaireHT;
    }
    
    // Update tax code when tvaPct changes (if manually edited)
    if (field === 'tvaPct' && Array.isArray(taxRates) && taxRates.length > 0) {
      // Keep taxCode as reference, but allow manual TVA override
      // Find matching tax rate or keep existing code
      const matchingRate = taxRates.find(t => t.tauxPct === value);
      if (matchingRate) {
        newLines[index].taxCode = matchingRate.code;
      }
    }
    
    setLines(newLines);
  };

  const fetchDeliveries = async () => {
    try {
      if (!tenantId) return;
      setLoading(true);
      const response = await fetch('/api/sales/deliveries', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        const deliveries = data.items || [];

        // Construire le nom client à partir des données déjà peuplées si possible
        const deliveriesWithCustomers: Delivery[] = deliveries.map((delivery: any) => {
          let customerName = '';

          if (delivery.customerId) {
            if (typeof delivery.customerId === 'object' && delivery.customerId !== null) {
              const customer = delivery.customerId as any;
              customerName =
                customer.raisonSociale ||
                `${customer.nom || ''} ${customer.prenom || ''}`.trim();
            }
          }

          return {
            ...delivery,
            customerName: customerName || delivery.customerName || '',
          };
        });

        setDeliveries(deliveriesWithCustomers);
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      toast.error('Erreur lors du chargement des bons de livraison');
    } finally {
      setLoading(false);
    }
  };

  const filtered = deliveries.filter(delivery =>
    delivery.numero.toLowerCase().includes(q.toLowerCase()) ||
    (delivery.customerName && delivery.customerName.toLowerCase().includes(q.toLowerCase()))
  );

  // Calculate totals
  const calculateTotals = () => {
    let totalHTBeforeDiscount = 0;
    let totalHT = 0;
    
    lines.forEach(line => {
      const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
      totalHTBeforeDiscount += lineHTBeforeDiscount;
      const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
      totalHT += lineHT;
    });
    
    const totalRemise = totalHTBeforeDiscount - totalHT;
    
    // Calculate TVA per line
    const totalTVA = lines.reduce((sum, line) => {
      const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
      const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
      const lineTVA = lineHT * (line.tvaPct || 0) / 100;
      return sum + lineTVA;
    }, 0);
    
    // Timbre fiscal (usually not used for delivery notes)
    const timbreAmount = 0;
    
    const totalTTC = totalHT + totalTVA + timbreAmount;
    
    return { totalHT, totalRemise, totalTVA, timbreAmount, totalTTC };
  };

  const totals = calculateTotals();

  // Save delivery
  const handleCreateDelivery = async () => {
    if (!formData.customerId) {
      toast.error('Veuillez sélectionner un client');
      return;
    }

    if (lines.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne');
      return;
    }

    try {
      if (!tenantId) return;
      setSaving(true);
      
      const lignesData = lines
        .filter(line => line.designation && line.designation.trim() !== '')
        .map(line => ({
          productId: line.productId,
          codeAchat: line.codeAchat || '',
          categorieCode: line.categorieCode || '',
          designation: line.designation.trim(),
          quantite: line.quantite,
          uomCode: line.uomCode,
          prixUnitaireHT: line.prixUnitaireHT,
          remisePct: line.remisePct || 0,
          taxCode: line.taxCode,
          tvaPct: line.tvaPct || 0
        }));
      
      if (lignesData.length === 0) {
        toast.error('Veuillez remplir au moins une ligne de produit valide');
        return;
      }

      const url = editingDeliveryId 
        ? `/api/sales/deliveries/${editingDeliveryId}` 
        : '/api/sales/deliveries';
      
      const method = editingDeliveryId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId 
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          dateDoc: formData.dateDoc,
          dateLivraisonPrevue: formData.dateLivraisonPrevue || undefined,
          dateLivraisonReelle: formData.dateLivraisonReelle || undefined,
          referenceExterne: formData.referenceExterne,
          devise: formData.devise,
          modePaiement: formData.modePaiement || undefined,
          lieuLivraison: formData.lieuLivraison || undefined,
          moyenTransport: formData.moyenTransport || undefined,
          notes: formData.notes,
          lignes: lignesData,
          timbreFiscal: 0
        })
      });

      if (response.ok) {
        toast.success(editingDeliveryId ? 'Bon de livraison modifié avec succès' : 'Bon de livraison créé avec succès');
        setShowModal(false);
        setLines([]);
        setEditingDeliveryId(null);
        setFormData({
          customerId: '',
          dateDoc: new Date().toISOString().split('T')[0],
          referenceExterne: '',
          devise: 'TND',
          modePaiement: 'Espèces',
          dateLivraisonPrevue: getDefaultDeliveryDate(),
          dateLivraisonReelle: getDefaultDeliveryDate(),
          lieuLivraison: '',
          moyenTransport: '',
          notes: ''
        });
        setCustomerSearch('');
        setShowCustomerDropdown(false);
        setSelectedCustomerIndex(-1);
        setProductSearches({});
        setShowProductModal({});
        setCurrentProductLineIndex(null);
        fetchDeliveries();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur');
      }
    } catch (err) {
      console.error('Error saving delivery:', err);
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Handle view delivery
  const handleView = async (delivery: Delivery) => {
    try {
      console.log('🔍 Viewing delivery:', delivery._id);
      console.log('📋 Delivery details:', delivery);
      
      // Fetch full delivery details
      const response = await fetch(`/api/sales/deliveries/${delivery._id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Full delivery data:', data);
        toast.success(`Bon de livraison ${delivery.numero} chargé avec succès`);
        router.push(`/sales/deliveries/${delivery._id}`);
      } else {
        const errorData = await response.json();
        console.error('❌ Error:', errorData);
        toast.error('Erreur: ' + (errorData.error || 'Unknown'));
      }
    } catch (err) {
      console.error('❌ Exception:', err);
      toast.error('Erreur lors du chargement');
    }
  };

  // Handle edit delivery
  const handleEdit = async (delivery: Delivery) => {
    console.log('✏️ Editing delivery:', delivery._id);
    
    // Fetch full delivery details
    try {
      const response = await fetch(`/api/sales/deliveries/${delivery._id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (response.ok) {
        const fullDelivery = await response.json();
        console.log('📋 Full delivery data:', fullDelivery);
        
        // Populate form with delivery data
        setFormData({
          customerId: fullDelivery.customerId || '',
          dateDoc: fullDelivery.dateDoc?.split('T')[0] || new Date().toISOString().split('T')[0],
          referenceExterne: fullDelivery.referenceExterne || '',
          devise: fullDelivery.devise || 'TND',
          modePaiement: fullDelivery.modePaiement || '',
          dateLivraisonPrevue: fullDelivery.dateLivraisonPrevue?.split('T')[0] || getDefaultDeliveryDate(),
          dateLivraisonReelle: fullDelivery.dateLivraisonReelle?.split('T')[0] || getDefaultDeliveryDate(),
          lieuLivraison: fullDelivery.lieuLivraison || '',
          moyenTransport: fullDelivery.moyenTransport || '',
          notes: fullDelivery.notes || ''
        });
        
        // Set customer search based on selected customer
        if (fullDelivery.customerId) {
          const selectedCustomer = customers.find(c => c._id === fullDelivery.customerId);
          if (selectedCustomer) {
            setCustomerSearch(selectedCustomer.raisonSociale || `${selectedCustomer.nom || ''} ${selectedCustomer.prenom || ''}`.trim());
          }
        } else {
          setCustomerSearch('');
        }
        
        // Populate lines
        if (fullDelivery.lignes && fullDelivery.lignes.length > 0) {
          const mappedLines = fullDelivery.lignes.map((line: any) => ({
            productId: line.productId || '',
            codeAchat: line.codeAchat || '',
            categorieCode: line.categorieCode || '',
            designation: line.designation || '',
            quantite: line.quantite || 0,
            uomCode: line.uomCode || '',
            prixUnitaireHT: line.prixUnitaireHT || 0,
            remisePct: line.remisePct || 0,
            taxCode: line.taxCode || '',
            tvaPct: line.tvaPct || 0,
            totalLine: 0
          }));
          setLines(mappedLines);
          
          // Fetch stock for all products in lines
          mappedLines.forEach((line: any) => {
            if (line.productId) {
              fetchProductStock(line.productId);
            }
          });
          
          // Populate product searches immediately using designation from API
          // This ensures products are visible even before products list is loaded
          const searches: { [key: number]: string } = {};
          mappedLines.forEach((line: any, idx: number) => {
            if (line.designation) {
              searches[idx] = line.designation;
            }
          });
          setProductSearches(searches);
        }
        
        // Set editing state
        setEditingDeliveryId(fullDelivery._id);
        
        // Open modal
        setShowModal(true);
      } else {
        toast.error('Erreur lors du chargement du bon de livraison');
      }
    } catch (err) {
      console.error('Error fetching delivery:', err);
      toast.error('Erreur lors du chargement du bon de livraison');
    }
  };

  // Handle download PDF
  const handleDownloadPDF = async (delivery: Delivery) => {
    try {
      const response = await fetch(`/api/sales/deliveries/${delivery._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bon-de-livraison-${delivery.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF téléchargé avec succès');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Erreur lors du téléchargement du PDF');
    }
  };

  // Handle delete delivery
  const handleDelete = async (deliveryId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bon de livraison ?')) {
      return;
    }

    try {
      if (!tenantId) return;
      
      const response = await fetch(`/api/sales/deliveries/${deliveryId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId }
      });

      if (response.ok) {
        toast.success('Bon de livraison supprimé avec succès');
        fetchDeliveries();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression du bon de livraison');
      }
    } catch (err) {
      console.error('Error deleting delivery:', err);
      toast.error('Erreur lors de la suppression du bon de livraison');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8" /> <span className="whitespace-nowrap">Bons de livraison</span>
          </h1>
          <div className="flex gap-2">
            <button className="hidden sm:flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-gray-50">
              <ArrowDownTrayIcon className="w-4 h-4" /> <span className="hidden lg:inline">Exporter</span>
            </button>
            <button 
              onClick={() => setShowModal(true)} 
              className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <PlusIcon className="w-5 h-5" /> <span>Nouveau bon de livraison</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par numéro ou nom du client..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm sm:text-base"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun bon de livraison trouvé</h3>
            <p className="text-gray-600 mb-6">Créez votre premier bon de livraison en quelques clics</p>
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mx-auto"
            >
              <PlusIcon className="w-5 h-5" /> Nouveau bon de livraison
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                  <th className="px-3 py-4 text-left text-sm font-semibold text-gray-700">Numéro</th>
                  <th className="px-3 py-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="px-3 py-4 text-left text-sm font-semibold text-gray-700">Client</th>
                  <th className="px-3 py-4 text-right text-sm font-semibold text-gray-700">Total HT</th>
                  <th className="px-3 py-4 text-right text-sm font-semibold text-gray-700">Total TVA</th>
                  <th className="px-3 py-4 text-right text-sm font-semibold text-gray-700">Total TTC</th>
                  <th className="px-2 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((delivery) => (
                  <tr key={delivery._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{delivery.numero}</td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(delivery.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600">
                      {delivery.customerName || '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap">
                      {delivery.totalBaseHT?.toFixed(3)} {delivery.devise || 'TND'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap">
                      {delivery.totalTVA?.toFixed(3)} {delivery.devise || 'TND'}
                    </td>
                    <td className="px-3 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                      {delivery.totalTTC?.toFixed(3)} {delivery.devise || 'TND'}
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex gap-0.5">
                        <button 
                          onClick={() => {
                            console.log('🔵 BUTTON CLICKED - Delivery ID:', delivery._id);
                            handleView(delivery);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            console.log('🟢 MODIFY BUTTON CLICKED - Delivery:', delivery);
                            handleEdit(delivery);
                          }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDownloadPDF(delivery)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Télécharger PDF"
                        >
                          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(delivery._id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              {filtered.map((delivery) => (
                <div key={delivery._id} className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{delivery.numero}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(delivery.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleView(delivery)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Voir"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(delivery)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Modifier"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Client:</span>
                      <span className="font-medium text-gray-900">{delivery.customerName || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total HT:</span>
                      <span className="font-medium text-gray-900">{delivery.totalBaseHT?.toFixed(3)} {delivery.devise || 'TND'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">TVA:</span>
                      <span className="font-medium text-gray-900">{delivery.totalTVA?.toFixed(3)} {delivery.devise || 'TND'}</span>
                    </div>
                    <div className="flex justify-between text-base pt-2 border-t">
                      <span className="font-semibold text-gray-900">Total TTC:</span>
                      <span className="font-bold text-blue-600">{delivery.totalTTC?.toFixed(3)} {delivery.devise || 'TND'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => handleDownloadPDF(delivery)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      PDF
                    </button>
                    <button 
                      onClick={() => handleDelete(delivery._id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Simple Modal Placeholder - Will be replaced with full modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
              <div className="p-4 sm:p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900">
                    {editingDeliveryId ? '✏️ Modifier bon de livraison' : '🧾 Nouveau bon de livraison'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {editingDeliveryId ? 'Modifiez votre bon de livraison' : 'Créez un bon de livraison élégant et précis en quelques clics'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  <div className="relative customer-autocomplete">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Client *
                    </label>
                    {loadingData ? (
                      <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 animate-pulse">
                        Chargement des clients...
                      </div>
                    ) : (
                      <>
                        {/* Input with search icon */}
                        <div className="relative">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
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
                            className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        {/* Dropdown */}
                        {showCustomerDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[280px] overflow-hidden">
                            {/* Alphabet filter bar */}
                            <div className="flex items-center justify-center gap-1 px-2 py-2 bg-gray-50 border-b text-xs">
                              {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
                                <button
                                  key={letter}
                                  onClick={() => handleAlphabetClick(letter)}
                                  className="px-1.5 py-0.5 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors font-semibold"
                                >
                                  {letter}
                                </button>
                              ))}
                            </div>
                            
                            {/* Customer list */}
                            <div className="overflow-y-auto max-h-[240px]">
                              {filteredCustomers.length > 0 ? (
                                filteredCustomers.map((customer, index) => {
                                  const displayName = customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim();
                                  const secondaryInfo = [
                                    customer.code,
                                    customer.matriculeFiscale
                                  ].filter(Boolean).join(' - ');
                                  
                                  return (
                                    <div
                                      key={customer._id}
                                      onClick={() => handleSelectCustomer(customer)}
                                      className={`px-4 py-3 cursor-pointer transition-colors ${
                                        index === selectedCustomerIndex
                                          ? 'bg-blue-50 border-l-2 border-blue-500'
                                          : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      <div className="font-medium text-gray-900">{displayName}</div>
                                      {secondaryInfo && (
                                        <div className="text-sm text-gray-500">{secondaryInfo}</div>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                                  Aucun client trouvé
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date
                    </label>
                    <input 
                      type="date"
                      value={formData.dateDoc}
                      onChange={(e) => setFormData({ ...formData, dateDoc: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Référence externe
                    </label>
                    <input 
                      type="text"
                      value={formData.referenceExterne}
                      onChange={(e) => setFormData({ ...formData, referenceExterne: e.target.value })}
                      placeholder="Ex: BC-2025-001"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Devise
                    </label>
                    <select
                      value={formData.devise}
                      onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="TND">TND - Dinar tunisien</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="USD">USD - Dollar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date livraison prévue
                    </label>
                    <input 
                      type="date"
                      value={formData.dateLivraisonPrevue}
                      onChange={(e) => setFormData({ ...formData, dateLivraisonPrevue: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date livraison réelle
                    </label>
                    <input 
                      type="date"
                      value={formData.dateLivraisonReelle}
                      onChange={(e) => setFormData({ ...formData, dateLivraisonReelle: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lieu de livraison
                    </label>
                    <input 
                      type="text"
                      value={formData.lieuLivraison}
                      onChange={(e) => setFormData({ ...formData, lieuLivraison: e.target.value })}
                      placeholder="Ex: Entrepôt principal"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Moyen de transport
                    </label>
                    <input 
                      type="text"
                      value={formData.moyenTransport}
                      onChange={(e) => setFormData({ ...formData, moyenTransport: e.target.value })}
                      placeholder="Ex: Camion, Livraison express"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Lines Table */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Lignes</h3>
                    <button 
                      onClick={addLine}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Ajouter une ligne
                    </button>
                  </div>
                  <div className="border rounded-lg overflow-visible">
                    {lines.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        Aucune ligne ajoutée
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Produit</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Qté</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Unité</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Prix HT</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">TVA %</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Total HT</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Total TVA</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Total TTC</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lines.map((line, index) => (
                            <tr key={index}>
                              <td className="px-2 sm:px-4 py-3" style={{ width: 'auto', maxWidth: 'none' }}>
                                <div className="flex items-center gap-2">
                                  <div className="relative inline-block">
                                    <input
                                      type="text"
                                      value={productSearches[index] || line.designation || ''}
                                      onChange={(e) => {
                                        const updatedLines = [...lines];
                                        updatedLines[index] = { ...updatedLines[index], designation: e.target.value };
                                        setLines(updatedLines);
                                        setProductSearches({ ...productSearches, [index]: e.target.value });
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        handleOpenProductModal(index);
                                      }}
                                      onFocus={(e) => {
                                        e.stopPropagation();
                                        handleOpenProductModal(index);
                                      }}
                                      placeholder="Rechercher un produit..."
                                      className="px-3 py-2 pr-8 border rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      readOnly
                                      style={{
                                        minWidth: '150px',
                                        width: line.designation ? `${Math.max(150, Math.min(500, (line.designation.length * 8) + 50))}px` : '150px',
                                        maxWidth: '500px',
                                      }}
                                    />
                                    <MagnifyingGlassIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                  </div>
                                  {line.designation && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedLines = [...lines];
                                        updatedLines[index] = { ...updatedLines[index], designation: '', productId: '' };
                                        setLines(updatedLines);
                                        setProductSearches({ ...productSearches, [index]: '' });
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                                      title="Effacer"
                                      type="button"
                                    >
                                      <XMarkIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <input 
                                    type="text" 
                                    value={line.quantite || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedLines = [...lines];
                                      updatedLines[index] = { ...updatedLines[index], quantite: parseFloat(val) || 0 };
                                      setLines(updatedLines);
                                    }}
                                    className={`w-20 px-2 py-1 border rounded text-sm ${
                                      line.productId && productStocks[line.productId] !== undefined && 
                                      (line.quantite || 0) > productStocks[line.productId]
                                        ? 'border-red-500' : ''
                                    }`}
                                    placeholder="0"
                                  />
                                  {line.productId && productStocks[line.productId] !== undefined && 
                                   (line.quantite || 0) > productStocks[line.productId] && (
                                    <span className="text-xs text-red-600 mt-1">
                                      Stock disponible: {productStocks[line.productId]}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="text" 
                                  value={line.uomCode || ''}
                                  readOnly
                                  className="w-20 px-2 py-1 border rounded text-sm bg-gray-50"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="text" 
                                  value={line.prixUnitaireHT || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedLines = [...lines];
                                    updatedLines[index] = { ...updatedLines[index], prixUnitaireHT: parseFloat(val) || 0 };
                                    setLines(updatedLines);
                                  }}
                                  className="w-24 px-2 py-1 border rounded text-sm"
                                  placeholder="0.000"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="text" 
                                  value={line.tvaPct ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedLines = [...lines];
                                    updatedLines[index] = { ...updatedLines[index], tvaPct: parseFloat(val) || 0 };
                                    setLines(updatedLines);
                                  }}
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                  placeholder="0%"
                                />
                                <div className="text-xs text-gray-500 mt-1">{line.taxCode || ''}</div>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">
                                {(((line.quantite || 0) * (line.prixUnitaireHT || 0)) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {formData.devise}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">
                                {((((line.quantite || 0) * (line.prixUnitaireHT || 0)) * (1 - ((line.remisePct || 0) / 100))) * ((line.tvaPct || 0) / 100)).toFixed(3)} {formData.devise}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-blue-600">
                                {(((line.quantite || 0) * (line.prixUnitaireHT || 0) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {formData.devise}
                              </td>
                              <td className="px-4 py-3">
                                <button 
                                  onClick={() => removeLine(index)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Sous-total HT</span>
                        <span className="font-medium">{totals.totalHT.toFixed(3)} {formData.devise}</span>
                      </div>
                      {totals.totalRemise > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Remise</span>
                          <span className="font-medium text-red-600">-{totals.totalRemise.toFixed(3)} {formData.devise}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVA</span>
                        <span className="font-medium">{totals.totalTVA.toFixed(3)} {formData.devise}</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-lg font-bold">
                        <span>Total TTC</span>
                        <span className="text-blue-600">{totals.totalTTC.toFixed(3)} {formData.devise}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conditions */}
                <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mode de paiement
                    </label>
                    <select 
                      value={formData.modePaiement}
                      onChange={(e) => setFormData({ ...formData, modePaiement: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner...</option>
                      {modesReglement.map((mode, index) => (
                        <option key={index} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea 
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notes additionnelles pour le client..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="p-4 sm:p-6 border-t flex flex-col sm:flex-row justify-end gap-3 relative">
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm sm:text-base"
                >
                  Annuler
                </button>
                <button 
                  onClick={saving ? undefined : handleCreateDelivery}
                  disabled={saving}
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm sm:text-base flex items-center justify-center gap-2 transition
                    ${saving 
                      ? 'bg-blue-500 text-white cursor-wait opacity-80' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  {saving && (
                    <span className="inline-flex h-4 w-4">
                      <span className="animate-spin inline-flex h-full w-full rounded-full border-2 border-white border-t-transparent" />
                    </span>
                  )}
                  <span>
                    {saving
                      ? (editingDeliveryId ? 'Enregistrement...' : 'Création en cours...')
                      : (editingDeliveryId ? 'Modifier' : 'Créer')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Search Modal */}
      {currentProductLineIndex !== null && showProductModal[currentProductLineIndex] && (
        <ProductSearchModal
          isOpen={true}
          onClose={handleCloseProductModal}
          onSelect={handleSelectProduct}
          products={products}
          tenantId={tenantId || ''}
          title="Rechercher un produit"
        />
      )}
    </DashboardLayout>
  );
}