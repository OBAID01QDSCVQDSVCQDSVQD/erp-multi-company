'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Supplier {
  _id: string;
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  type: 'societe' | 'particulier';
}

interface Product {
  _id: string;
  nom: string;
  sku?: string;
  referenceClient?: string;
  prixAchatRef?: number;
  prixVenteHT?: number;
  tvaPct?: number;
  uomAchatCode?: string;
  uomStockCode?: string;
  taxCode?: string;
}

interface PurchaseOrder {
  _id: string;
  numero: string;
  fournisseurId: string;
  fournisseurNom: string;
  statut?: string;
  lignes: Array<{
    productId?: string;
    reference?: string;
    designation: string;
    quantite: number;
    unite: string;
    prixUnitaireHT: number;
    remisePct?: number;
    tvaPct?: number;
    totalLigneHT?: number;
  }>;
}

interface Reception {
  _id: string;
  numero: string;
  fournisseurId: string;
  fournisseurNom: string;
  purchaseOrderId?: string;
  statut?: string;
  lignes: Array<{
    productId?: string;
    reference?: string;
    designation: string;
    qteRecue: number;
    qteCommandee?: number;
    uom?: string;
    prixUnitaireHT: number;
    remisePct?: number;
    tvaPct?: number;
    totalLigneHT?: number;
  }>;
}

interface InvoiceLine {
  produitId?: string;
  designation: string;
  quantite: number;
  prixUnitaireHT: number;
  remisePct?: number;
  tvaPct?: number;
  fodecPct?: number;
  totalLigneHT?: number;
}

export default function NewPurchaseInvoicePage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);
  const [supplierDropdownPosition, setSupplierDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  
  // Purchase Orders and Receptions
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<'none' | 'ca' | 'br'>('none');
  const [selectedCAId, setSelectedCAId] = useState<string>('');
  const [selectedBRId, setSelectedBRId] = useState<string>('');
  
  // Product search states
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearches, setProductSearches] = useState<{ [key: number]: string }>({});
  const [showProductDropdowns, setShowProductDropdowns] = useState<{ [key: number]: boolean }>({});
  const [selectedProductIndices, setSelectedProductIndices] = useState<{ [key: number]: number }>({});
  const [productDropdownPositions, setProductDropdownPositions] = useState<{ [key: number]: { top: number; left: number; width: number } }>({});
  
  const [formData, setFormData] = useState({
    fournisseurId: '',
    fournisseurNom: '',
    dateFacture: new Date().toISOString().split('T')[0],
    referenceFournisseur: '',
    devise: 'TND',
    conditionsPaiement: '',
    fodec: { enabled: false, tauxPct: 1 },
    timbre: { enabled: true, montant: 1.000 },
    notes: '',
  });
  
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchSuppliers();
      fetchProducts();
      fetchPurchaseOrders();
      fetchReceptions();
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedCAId && selectedDocumentType === 'ca') {
      loadPurchaseOrderData();
    }
  }, [selectedCAId, selectedDocumentType]);

  useEffect(() => {
    if (selectedBRId && selectedDocumentType === 'br') {
      loadReceptionData();
    }
  }, [selectedBRId, selectedDocumentType]);

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

  async function fetchProducts() {
    if (!tenantId) return;
    try {
      const response = await fetch('/api/products', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.items || data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }

  async function fetchPurchaseOrders() {
    if (!tenantId) return;
    try {
      const response = await fetch('/api/purchases/orders', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter only validated orders
        const validatedOrders = (data.items || []).filter((po: PurchaseOrder) => 
          po.statut === 'VALIDEE' || po.statut === 'RECEPTION_PARTIELLE' || po.statut === 'CLOTUREE'
        );
        setPurchaseOrders(validatedOrders);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  }

  async function fetchReceptions() {
    if (!tenantId) return;
    try {
      const response = await fetch('/api/purchases/receptions', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter only validated receptions
        const validatedReceptions = (data.items || []).filter((br: Reception) => 
          br.statut === 'VALIDE'
        );
        setReceptions(validatedReceptions);
      }
    } catch (error) {
      console.error('Error fetching receptions:', error);
    }
  }

  async function loadPurchaseOrderData() {
    if (!tenantId || !selectedCAId) return;
    try {
      const response = await fetch(`/api/purchases/orders/${selectedCAId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const po: PurchaseOrder = await response.json();
        
        // Set supplier
        setFormData(prev => ({
          ...prev,
          fournisseurId: po.fournisseurId,
          fournisseurNom: po.fournisseurNom || '',
        }));
        setSupplierSearch(po.fournisseurNom || '');
        
        // Load lines
        const invoiceLines: InvoiceLine[] = po.lignes.map((line) => {
          let prixAvecRemise = line.prixUnitaireHT || 0;
          const remisePct = line.remisePct || 0;
          if (remisePct > 0) {
            prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
          }
          const totalHT = prixAvecRemise * (line.quantite || 0);
          
          return {
            produitId: line.productId || undefined,
            designation: line.designation,
            quantite: line.quantite,
            prixUnitaireHT: line.prixUnitaireHT,
            remisePct: line.remisePct || 0,
            tvaPct: line.tvaPct || 0,
            fodecPct: 0,
            totalLigneHT: line.totalLigneHT || totalHT,
          };
        });
        
        setLines(invoiceLines);
        
        // Initialize product searches
        const searches: { [key: number]: string } = {};
        invoiceLines.forEach((line, idx) => {
          if (line.designation) {
            searches[idx] = line.designation;
          }
        });
        setProductSearches(searches);
        
        toast.success('Données de la commande d\'achat chargées');
      }
    } catch (error) {
      console.error('Error loading purchase order:', error);
      toast.error('Erreur lors du chargement de la commande');
    }
  }

  async function loadReceptionData() {
    if (!tenantId || !selectedBRId) return;
    try {
      const response = await fetch(`/api/purchases/receptions/${selectedBRId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const br: Reception = await response.json();
        
        // Set supplier
        setFormData(prev => ({
          ...prev,
          fournisseurId: br.fournisseurId,
          fournisseurNom: br.fournisseurNom || '',
        }));
        setSupplierSearch(br.fournisseurNom || '');
        
        // Load lines
        const invoiceLines: InvoiceLine[] = br.lignes.map((line) => {
          let prixAvecRemise = line.prixUnitaireHT || 0;
          const remisePct = line.remisePct || 0;
          if (remisePct > 0) {
            prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
          }
          const totalHT = prixAvecRemise * (line.qteRecue || 0);
          
          return {
            produitId: line.productId || undefined,
            designation: line.designation || '',
            quantite: line.qteRecue,
            prixUnitaireHT: line.prixUnitaireHT || 0,
            remisePct: line.remisePct || 0,
            tvaPct: line.tvaPct || 0,
            fodecPct: 0,
            totalLigneHT: line.totalLigneHT || totalHT,
          };
        });
        
        setLines(invoiceLines);
        
        // Initialize product searches
        const searches: { [key: number]: string } = {};
        invoiceLines.forEach((line, idx) => {
          if (line.designation) {
            searches[idx] = line.designation;
          }
        });
        setProductSearches(searches);
        
        toast.success('Données du bon de réception chargées');
      }
    } catch (error) {
      console.error('Error loading reception:', error);
      toast.error('Erreur lors du chargement du bon de réception');
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
      if (Object.keys(showProductDropdowns).length > 0) {
        setShowProductDropdowns({});
        setProductDropdownPositions({});
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
      if (!target.closest('.product-autocomplete')) {
        if (Object.keys(showProductDropdowns).length > 0) {
          setShowProductDropdowns({});
          setProductDropdownPositions({});
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSupplierDropdown, showProductDropdowns]);

  // Filter products based on search
  const getFilteredProducts = (lineIndex: number) => {
    const search = productSearches[lineIndex] || '';
    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return products;
    
    return products.filter((product) => {
      const name = product.nom.toLowerCase();
      const sku = (product.sku || '').toLowerCase();
      const refClient = (product.referenceClient || '').toLowerCase();
      
      if (searchLower.length === 1) {
        return name.startsWith(searchLower) || sku.startsWith(searchLower);
      }
      
      return name.includes(searchLower) || sku.includes(searchLower) || refClient.includes(searchLower);
    });
  };

  const calculateProductDropdownPosition = (inputElement: HTMLInputElement) => {
    const rect = inputElement.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    };
  };

  const handleSelectProduct = (lineIndex: number, product: Product) => {
    const newLines = [...lines];
    newLines[lineIndex].produitId = product._id;
    newLines[lineIndex].designation = product.nom;
    newLines[lineIndex].prixUnitaireHT = product.prixAchatRef || product.prixVenteHT || 0;
    if (product.tvaPct !== undefined && product.tvaPct !== null) {
      newLines[lineIndex].tvaPct = product.tvaPct;
    }
    
    // Recalculate total
    if (newLines[lineIndex].prixUnitaireHT && newLines[lineIndex].quantite > 0) {
      let prixAvecRemise = newLines[lineIndex].prixUnitaireHT;
      const remisePct = newLines[lineIndex].remisePct || 0;
      if (remisePct > 0) {
        prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
      }
      newLines[lineIndex].totalLigneHT = prixAvecRemise * newLines[lineIndex].quantite;
    }
    
    setLines(newLines);
    setProductSearches({ ...productSearches, [lineIndex]: product.nom });
    setShowProductDropdowns({ ...showProductDropdowns, [lineIndex]: false });
    setSelectedProductIndices({ ...selectedProductIndices, [lineIndex]: -1 });
    const newPositions = { ...productDropdownPositions };
    delete newPositions[lineIndex];
    setProductDropdownPositions(newPositions);
  };

  const handleProductKeyDown = (e: React.KeyboardEvent, lineIndex: number) => {
    const dropdownVisible = showProductDropdowns[lineIndex];
    if (!dropdownVisible) return;
    
    const filteredProducts = getFilteredProducts(lineIndex);
    const currentIndex = selectedProductIndices[lineIndex] || -1;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedProductIndices({ 
        ...selectedProductIndices, 
        [lineIndex]: currentIndex < filteredProducts.length - 1 ? currentIndex + 1 : currentIndex 
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedProductIndices({ 
        ...selectedProductIndices, 
        [lineIndex]: currentIndex > 0 ? currentIndex - 1 : -1 
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentIndex >= 0 && filteredProducts[currentIndex]) {
        handleSelectProduct(lineIndex, filteredProducts[currentIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowProductDropdowns({ ...showProductDropdowns, [lineIndex]: false });
      setSelectedProductIndices({ ...selectedProductIndices, [lineIndex]: -1 });
    }
  };

  const handleProductAlphabetClick = (lineIndex: number, letter: string) => {
    setProductSearches({ ...productSearches, [lineIndex]: letter });
    setShowProductDropdowns({ ...showProductDropdowns, [lineIndex]: true });
    setSelectedProductIndices({ ...selectedProductIndices, [lineIndex]: 0 });
  };

  useEffect(() => {
    Object.keys(showProductDropdowns).forEach((key) => {
      const lineIndex = parseInt(key);
      if (showProductDropdowns[lineIndex]) {
        const input = document.querySelector(`input[data-product-input="${lineIndex}"]`) as HTMLInputElement;
        if (input && !productDropdownPositions[lineIndex]) {
          const position = calculateProductDropdownPosition(input);
          setProductDropdownPositions(prev => ({ ...prev, [lineIndex]: position }));
        }
      }
    });
  }, [showProductDropdowns]);

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
      setSelectedSupplierIndex(prev => 
        prev < filteredSuppliers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSupplierIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedSupplierIndex >= 0) {
      e.preventDefault();
      handleSelectSupplier(filteredSuppliers[selectedSupplierIndex]);
    } else if (e.key === 'Escape') {
      setShowSupplierDropdown(false);
      setSelectedSupplierIndex(-1);
    }
  };

  function addLine() {
    const newIndex = lines.length;
    setLines([...lines, {
      produitId: '',
      designation: '',
      quantite: 1,
      prixUnitaireHT: 0,
      remisePct: 0,
      tvaPct: 0,
      fodecPct: 0,
      totalLigneHT: 0,
    }]);
    setProductSearches({ ...productSearches, [newIndex]: '' });
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
    const newSearches = { ...productSearches };
    delete newSearches[index];
    setProductSearches(newSearches);
  }

  function updateLine(index: number, field: keyof InvoiceLine, value: any) {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === 'quantite' || field === 'prixUnitaireHT' || field === 'remisePct' || field === 'tvaPct') {
      const line = newLines[index];
      if (line.prixUnitaireHT && line.quantite > 0) {
        let prixAvecRemise = line.prixUnitaireHT;
        const remisePct = line.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        line.totalLigneHT = prixAvecRemise * line.quantite;
      } else {
        line.totalLigneHT = 0;
      }
    }
    
    setLines(newLines);
  }

  function calculateTotals() {
    let totalHT = 0;
    let totalRemise = 0;
    let totalTVA = 0;
    let totalHTAvantRemise = 0;
    
    lines.forEach((line) => {
      if (line.prixUnitaireHT && line.quantite > 0) {
        const prixUnitaire = line.prixUnitaireHT;
        const quantite = line.quantite;
        const htAvantRemise = prixUnitaire * quantite;
        totalHTAvantRemise += htAvantRemise;
        
        const remisePct = line.remisePct || 0;
        let prixAvecRemise = prixUnitaire;
        if (remisePct > 0) {
          prixAvecRemise = prixUnitaire * (1 - remisePct / 100);
          const remiseLigne = htAvantRemise - (prixAvecRemise * quantite);
          totalRemise += remiseLigne;
        }
        
        const ligneHT = prixAvecRemise * quantite;
        totalHT += ligneHT;
      } else if (line.totalLigneHT) {
        // If totalLigneHT is already calculated, estimate remise from prixUnitaireHT
        if (line.prixUnitaireHT && line.quantite > 0) {
          const htAvantRemise = line.prixUnitaireHT * line.quantite;
          totalHTAvantRemise += htAvantRemise;
          const remiseLigne = htAvantRemise - line.totalLigneHT;
          if (remiseLigne > 0) {
            totalRemise += remiseLigne;
          }
        }
        totalHT += line.totalLigneHT;
      }
    });
    
    const fodec = formData.fodec.enabled ? totalHT * (formData.fodec.tauxPct / 100) : 0;
    
    lines.forEach((line) => {
      if (line.prixUnitaireHT && line.quantite > 0 && line.tvaPct) {
        let prixAvecRemise = line.prixUnitaireHT;
        const remisePct = line.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * line.quantite;
        const ligneFodec = formData.fodec.enabled ? ligneHT * (formData.fodec.tauxPct / 100) : 0;
        const ligneBaseTVA = ligneHT + ligneFodec;
        const ligneTVA = ligneBaseTVA * (line.tvaPct / 100);
        totalTVA += ligneTVA;
      } else if (line.totalLigneHT && line.tvaPct) {
        const ligneHT = line.totalLigneHT;
        const ligneFodec = formData.fodec.enabled ? ligneHT * (formData.fodec.tauxPct / 100) : 0;
        const ligneBaseTVA = ligneHT + ligneFodec;
        const ligneTVA = ligneBaseTVA * (line.tvaPct / 100);
        totalTVA += ligneTVA;
      }
    });
    
    const timbre = formData.timbre.enabled ? formData.timbre.montant : 0;
    const totalTTC = totalHT + fodec + totalTVA + timbre;
    
    return {
      totalHTAvantRemise,
      totalRemise,
      totalHT,
      fodec,
      totalTVA,
      timbre,
      totalTTC,
    };
  }

  const totals = calculateTotals();

  async function handleSave() {
    if (!tenantId) return;
    
    if (!formData.fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }
    
    if (lines.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/purchases/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          ...formData,
          lignes: lines,
          bonsReceptionIds: selectedBRId ? [selectedBRId] : [],
        }),
      });
      
      if (response.ok) {
        const invoice = await response.json();
        toast.success('Facture créée avec succès');
        router.push(`/purchases/invoices/${invoice._id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!tenantId) return;
    
    if (!formData.fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }
    
    if (lines.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch('/api/purchases/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          ...formData,
          lignes: lines,
          statut: 'VALIDEE',
          bonsReceptionIds: selectedBRId ? [selectedBRId] : [],
        }),
      });
      
      if (response.ok) {
        const invoice = await response.json();
        toast.success('Facture validée avec succès');
        router.push(`/purchases/invoices/${invoice._id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la validation');
      }
    } catch (error) {
      console.error('Error validating invoice:', error);
      toast.error('Erreur lors de la validation');
    } finally {
      setSaving(false);
    }
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
          <div className="flex items-center gap-3">
            <ClipboardDocumentCheckIcon className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Nouvelle facture d'achat</h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Section 1: Informations générales */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Charger depuis
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={selectedDocumentType}
                    onChange={(e) => {
                      const type = e.target.value as 'none' | 'ca' | 'br';
                      setSelectedDocumentType(type);
                      if (type === 'none') {
                        setSelectedCAId('');
                        setSelectedBRId('');
                        setLines([]);
                        setProductSearches({});
                        setFormData(prev => ({
                          ...prev,
                          fournisseurId: '',
                          fournisseurNom: '',
                        }));
                        setSupplierSearch('');
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="none">Aucun document</option>
                    <option value="ca">Commande d'achat (CA)</option>
                    <option value="br">Bon de réception (BR)</option>
                  </select>
                  
                  {selectedDocumentType === 'ca' && (
                    <select
                      value={selectedCAId}
                      onChange={(e) => setSelectedCAId(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Sélectionner une commande d'achat</option>
                      {purchaseOrders.map((po) => (
                        <option key={po._id} value={po._id}>
                          {po.numero} - {po.fournisseurNom}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {selectedDocumentType === 'br' && (
                    <select
                      value={selectedBRId}
                      onChange={(e) => setSelectedBRId(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">Sélectionner un bon de réception</option>
                      {receptions.map((br) => (
                        <option key={br._id} value={br._id}>
                          {br.numero} - {br.fournisseurNom}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {(selectedDocumentType === 'ca' || selectedDocumentType === 'br') && (
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedDocumentType === 'ca' 
                      ? 'Les données de la commande d\'achat seront chargées automatiquement'
                      : 'Les données du bon de réception seront chargées automatiquement'}
                  </p>
                )}
              </div>

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
                      if (selectedDocumentType === 'none') {
                        setSupplierSearch(e.target.value);
                        setShowSupplierDropdown(true);
                        setSelectedSupplierIndex(-1);
                        calculateSupplierDropdownPosition();
                      }
                    }}
                    onFocus={(e) => {
                      if (selectedDocumentType === 'none') {
                        setShowSupplierDropdown(true);
                        calculateSupplierDropdownPosition();
                      }
                    }}
                    onKeyDown={selectedDocumentType === 'none' ? handleSupplierKeyDown : undefined}
                    placeholder="Rechercher un fournisseur..."
                    readOnly={selectedDocumentType !== 'none'}
                    className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      selectedDocumentType !== 'none' ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
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
                          className={`px-4 py-2 cursor-pointer hover:bg-gray-50 ${
                            index === selectedSupplierIndex ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de facture *
                </label>
                <input
                  type="date"
                  value={formData.dateFacture}
                  onChange={(e) => setFormData({ ...formData, dateFacture: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° facture fournisseur
                </label>
                <input
                  type="text"
                  value={formData.referenceFournisseur}
                  onChange={(e) => setFormData({ ...formData, referenceFournisseur: e.target.value })}
                  placeholder="Référence externe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise
                </label>
                <select
                  value={formData.devise}
                  onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conditions de paiement
                </label>
                <input
                  type="text"
                  value={formData.conditionsPaiement}
                  onChange={(e) => setFormData({ ...formData, conditionsPaiement: e.target.value })}
                  placeholder="Ex: Paiement à 30 jours"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Notes additionnelles..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Lignes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Lignes</h2>
              <button
                onClick={addLine}
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                Ajouter une ligne
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune ligne ajoutée
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-blue-50 border-b-2 border-blue-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-800">Désignation</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Quantité</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Prix HT</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Remise %</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">TVA %</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Total HT</th>
                      <th className="px-2 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 overflow-visible">
                          <div className="relative product-autocomplete">
                            <div className="relative">
                              <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input
                                type="text"
                                data-product-input={index}
                                value={productSearches[index] || line.designation || ''}
                                onChange={(e) => {
                                  const input = e.target as HTMLInputElement;
                                  updateLine(index, 'designation', e.target.value);
                                  setProductSearches({ ...productSearches, [index]: e.target.value });
                                  setShowProductDropdowns({ ...showProductDropdowns, [index]: true });
                                  setSelectedProductIndices({ ...selectedProductIndices, [index]: -1 });
                                  const position = calculateProductDropdownPosition(input);
                                  setProductDropdownPositions({ ...productDropdownPositions, [index]: position });
                                }}
                                onFocus={(e) => {
                                  const input = e.target as HTMLInputElement;
                                  setShowProductDropdowns({ ...showProductDropdowns, [index]: true });
                                  const position = calculateProductDropdownPosition(input);
                                  setProductDropdownPositions({ ...productDropdownPositions, [index]: position });
                                }}
                                onKeyDown={(e) => handleProductKeyDown(e, index)}
                                placeholder="Rechercher un produit..."
                                className="w-full pl-8 pr-2 py-1.5 border rounded text-sm"
                              />
                            </div>
                            
                            {showProductDropdowns[index] && productDropdownPositions[index] && (
                              <div 
                                className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl max-h-[280px] overflow-hidden" 
                                style={{ 
                                  minWidth: '300px',
                                  width: `${productDropdownPositions[index].width}px`,
                                  top: `${productDropdownPositions[index].top}px`,
                                  left: `${productDropdownPositions[index].left}px`
                                }}
                              >
                                <div className="flex items-center justify-center gap-1 px-2 py-1 bg-gray-50 border-b text-xs">
                                  {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
                                    <button
                                      key={letter}
                                      onClick={() => handleProductAlphabetClick(index, letter)}
                                      className="px-1.5 py-0.5 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors font-semibold"
                                    >
                                      {letter}
                                    </button>
                                  ))}
                                </div>
                                
                                <div className="overflow-y-auto max-h-[240px]">
                                  {getFilteredProducts(index).length > 0 ? (
                                    getFilteredProducts(index).map((product, prodIndex) => {
                                      const displayName = product.nom;
                                      const secondaryInfo = [
                                        product.sku,
                                        product.referenceClient
                                      ].filter(Boolean).join(' - ');
                                      
                                      return (
                                        <div
                                          key={product._id}
                                          onClick={() => handleSelectProduct(index, product)}
                                          className={`px-3 py-2 cursor-pointer transition-colors ${
                                            prodIndex === (selectedProductIndices[index] || -1)
                                              ? 'bg-blue-50 border-l-2 border-blue-500'
                                              : 'hover:bg-gray-50'
                                          }`}
                                        >
                                          <div className="font-medium text-gray-900 text-xs">{displayName}</div>
                                          {secondaryInfo && (
                                            <div className="text-xs text-gray-500">{secondaryInfo}</div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="px-3 py-4 text-center text-xs text-gray-500">
                                      Aucun produit trouvé
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={line.quantite || ''}
                            onChange={(e) => updateLine(index, 'quantite', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1.5 border rounded text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={line.prixUnitaireHT || ''}
                            onChange={(e) => updateLine(index, 'prixUnitaireHT', parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1.5 border rounded text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={line.remisePct || ''}
                            onChange={(e) => updateLine(index, 'remisePct', parseFloat(e.target.value) || 0)}
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-full px-2 py-1.5 border rounded text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={line.tvaPct || ''}
                            onChange={(e) => updateLine(index, 'tvaPct', parseFloat(e.target.value) || 0)}
                            min="0"
                            max="100"
                            step="0.01"
                            className="w-full px-2 py-1.5 border rounded text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={(line.totalLigneHT || 0).toFixed(3)}
                            className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50 text-right font-medium"
                            readOnly
                          />
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => removeLine(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Totaux */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Totaux</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.fodec.enabled}
                    onChange={(e) => setFormData({
                      ...formData,
                      fodec: { ...formData.fodec, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">FODEC</label>
                </div>
                {formData.fodec.enabled && (
                  <div className="ml-7">
                    <label className="block text-xs text-gray-600 mb-1">Taux FODEC (%)</label>
                    <input
                      type="number"
                      value={formData.fodec.tauxPct}
                      onChange={(e) => setFormData({
                        ...formData,
                        fodec: { ...formData.fodec, tauxPct: parseFloat(e.target.value) || 1 }
                      })}
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.timbre.enabled}
                    onChange={(e) => setFormData({
                      ...formData,
                      timbre: { ...formData.timbre, enabled: e.target.checked }
                    })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Timbre fiscal</label>
                </div>
                {formData.timbre.enabled && (
                  <div className="ml-7">
                    <label className="block text-xs text-gray-600 mb-1">Montant Timbre</label>
                    <input
                      type="number"
                      value={formData.timbre.montant}
                      onChange={(e) => setFormData({
                        ...formData,
                        timbre: { ...formData.timbre, montant: parseFloat(e.target.value) || 1.000 }
                      })}
                      min="0"
                      step="0.001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <table className="w-full">
                  <tbody className="space-y-2">
                    {totals.totalRemise > 0 && (
                      <tr>
                        <td className="py-2 text-right text-sm font-semibold text-gray-700">Total Remise:</td>
                        <td className="py-2 text-right text-sm font-bold text-red-600 pl-4">
                          -{totals.totalRemise.toFixed(3)} DT
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2 text-right text-sm font-semibold text-gray-700">Total HT:</td>
                      <td className="py-2 text-right text-sm font-bold text-gray-900 pl-4">
                        {totals.totalHT.toFixed(3)} DT
                      </td>
                    </tr>
                    {formData.fodec.enabled && (
                      <tr>
                        <td className="py-2 text-right text-sm font-semibold text-gray-700">
                          FODEC ({formData.fodec.tauxPct}%):
                        </td>
                        <td className="py-2 text-right text-sm font-bold text-gray-900 pl-4">
                          {totals.fodec.toFixed(3)} DT
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2 text-right text-sm font-semibold text-gray-700">Total TVA:</td>
                      <td className="py-2 text-right text-sm font-bold text-gray-900 pl-4">
                        {totals.totalTVA.toFixed(3)} DT
                      </td>
                    </tr>
                    {formData.timbre.enabled && (
                      <tr>
                        <td className="py-2 text-right text-sm font-semibold text-gray-700">Timbre fiscal:</td>
                        <td className="py-2 text-right text-sm font-bold text-gray-900 pl-4">
                          {totals.timbre.toFixed(3)} DT
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-gray-300">
                      <td className="py-2 text-right text-sm font-semibold text-blue-600">Total TTC:</td>
                      <td className="py-2 text-right text-sm font-bold text-blue-600 pl-4">
                        {totals.totalTTC.toFixed(3)} DT
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer en brouillon'}
            </button>
            <button
              onClick={handleValidate}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Validation...' : 'Valider la facture'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

