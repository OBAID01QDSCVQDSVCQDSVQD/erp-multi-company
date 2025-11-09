'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, XMarkIcon, MagnifyingGlassIcon, ClipboardDocumentCheckIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

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

interface ReceptionLine {
  productId?: string;
  reference?: string;
  designation?: string;
  uom?: string;
  qteCommandee?: number;
  qteRecue: number;
  prixUnitaireHT?: number;
  remisePct?: number;
  tvaPct?: number;
  totalLigneHT?: number;
}

export default function NewReceptionPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string>('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [selectedSupplierIndex, setSelectedSupplierIndex] = useState(-1);
  const [supplierDropdownPosition, setSupplierDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  
  // Product search states
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearches, setProductSearches] = useState<{ [key: number]: string }>({});
  const [showProductDropdowns, setShowProductDropdowns] = useState<{ [key: number]: boolean }>({});
  const [selectedProductIndices, setSelectedProductIndices] = useState<{ [key: number]: number }>({});
  const [productDropdownPositions, setProductDropdownPositions] = useState<{ [key: number]: { top: number; left: number; width: number } }>({});
  
  const [formData, setFormData] = useState({
    purchaseOrderId: '',
    fournisseurId: '',
    fournisseurNom: '',
    dateDoc: new Date().toISOString().split('T')[0],
    fodecActif: false,
    tauxFodec: 1,
    timbreActif: true,
    montantTimbre: 1.000,
    notes: '',
  });
  
  const [lines, setLines] = useState<ReceptionLine[]>([]);

  useEffect(() => {
    if (tenantId) {
      fetchPurchaseOrders();
      fetchSuppliers();
      fetchProducts();
    }
  }, [tenantId]);

  useEffect(() => {
    if (selectedPurchaseOrderId) {
      loadPurchaseOrderLines();
    }
  }, [selectedPurchaseOrderId]);

  async function fetchPurchaseOrders() {
    if (!tenantId) return;
    try {
      const response = await fetch('/api/purchases/orders', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        // Filter only non-closed orders
        const activeOrders = (data.items || []).filter((po: PurchaseOrder) => 
          po.statut !== 'CLOTUREE' && po.statut !== 'ANNULEE'
        );
        setPurchaseOrders(activeOrders);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  }

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

  async function loadPurchaseOrderLines() {
    if (!tenantId || !selectedPurchaseOrderId) return;
    try {
      const response = await fetch(`/api/purchases/orders/${selectedPurchaseOrderId}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const po: PurchaseOrder = await response.json();
        setFormData(prev => ({
          ...prev,
          fournisseurId: po.fournisseurId,
          fournisseurNom: po.fournisseurNom || '',
          purchaseOrderId: selectedPurchaseOrderId,
        }));
        setSupplierSearch(po.fournisseurNom || '');
        
        // Load lines from purchase order - copy all fields including remise and quantities
        const receptionLines: ReceptionLine[] = po.lignes.map((line) => {
          // Calculate totalLigneHT with remise if applicable
          let prixAvecRemise = line.prixUnitaireHT || 0;
          const remisePct = line.remisePct || 0;
          if (remisePct > 0) {
            prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
          }
          const totalHT = prixAvecRemise * (line.quantite || 0);
          
          return {
            productId: line.productId,
            reference: line.reference || '',
            designation: line.designation,
            uom: line.unite || 'PCE',
            qteCommandee: line.quantite,
            qteRecue: line.quantite, // Set qteRecue to quantite by default
            prixUnitaireHT: line.prixUnitaireHT,
            remisePct: line.remisePct || 0,
            tvaPct: line.tvaPct || 0,
            totalLigneHT: line.totalLigneHT || totalHT,
          };
        });
        setLines(receptionLines);
        
        // Initialize product searches for loaded lines
        const searches: { [key: number]: string } = {};
        receptionLines.forEach((line, idx) => {
          if (line.designation) {
            searches[idx] = line.designation;
          }
        });
        setProductSearches(searches);
      }
    } catch (error) {
      console.error('Error loading purchase order:', error);
      toast.error('Erreur lors du chargement du bon de commande');
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

  // Filter products based on search (for a specific line)
  const getFilteredProducts = (lineIndex: number) => {
    const search = productSearches[lineIndex] || '';
    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return products;
    
    return products.filter((product) => {
      const name = product.nom.toLowerCase();
      const sku = (product.sku || '').toLowerCase();
      const refClient = (product.referenceClient || '').toLowerCase();
      
      // If single letter, use startsWith
      if (searchLower.length === 1) {
        return name.startsWith(searchLower) || sku.startsWith(searchLower);
      }
      
      // If more than one letter, use contains
      return name.includes(searchLower) || sku.includes(searchLower) || refClient.includes(searchLower);
    });
  };

  // Calculate dropdown position based on input element
  const calculateProductDropdownPosition = (inputElement: HTMLInputElement) => {
    const rect = inputElement.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    };
  };

  // Handle product selection for a specific line
  const handleSelectProduct = (lineIndex: number, product: Product) => {
    const newLines = [...lines];
    newLines[lineIndex].productId = product._id;
    newLines[lineIndex].designation = product.nom;
    newLines[lineIndex].reference = product.referenceClient || product.sku || '';
    newLines[lineIndex].uom = product.uomAchatCode || product.uomStockCode || 'PCE';
    newLines[lineIndex].prixUnitaireHT = product.prixAchatRef || product.prixVenteHT || 0;
    if (product.tvaPct !== undefined && product.tvaPct !== null) {
      newLines[lineIndex].tvaPct = product.tvaPct;
    }
    
    // Recalculate total
    if (newLines[lineIndex].prixUnitaireHT && newLines[lineIndex].qteRecue > 0) {
      let prixAvecRemise = newLines[lineIndex].prixUnitaireHT;
      const remisePct = newLines[lineIndex].remisePct || 0;
      if (remisePct > 0) {
        prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
      }
      newLines[lineIndex].totalLigneHT = prixAvecRemise * newLines[lineIndex].qteRecue;
    }
    
    setLines(newLines);
    
    // Update search and dropdown state
    setProductSearches({ ...productSearches, [lineIndex]: product.nom });
    setShowProductDropdowns({ ...showProductDropdowns, [lineIndex]: false });
    setSelectedProductIndices({ ...selectedProductIndices, [lineIndex]: -1 });
    // Clear position when closing
    const newPositions = { ...productDropdownPositions };
    delete newPositions[lineIndex];
    setProductDropdownPositions(newPositions);
  };

  // Handle keyboard navigation for products
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

  // Handle alphabet filter click for products
  const handleProductAlphabetClick = (lineIndex: number, letter: string) => {
    setProductSearches({ ...productSearches, [lineIndex]: letter });
    setShowProductDropdowns({ ...showProductDropdowns, [lineIndex]: true });
    setSelectedProductIndices({ ...selectedProductIndices, [lineIndex]: 0 });
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
      // Close all product dropdowns on scroll
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
      
      // Close product dropdowns when clicking outside
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

  // Update product dropdown positions when they open
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
      setSelectedSupplierIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSupplierIndex >= 0 && filteredSuppliers[selectedSupplierIndex]) {
        handleSelectSupplier(filteredSuppliers[selectedSupplierIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSupplierDropdown(false);
      setSelectedSupplierIndex(-1);
    }
  };

  function addLine() {
    setLines([...lines, {
      productId: '',
      reference: '',
      designation: '',
      uom: 'PCE',
      qteRecue: 0,
      prixUnitaireHT: 0,
      tvaPct: 0,
      totalLigneHT: 0,
    }]);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof ReceptionLine, value: any) {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // Recalculate total if price, quantity, or remise changed
    if (field === 'qteRecue' || field === 'prixUnitaireHT' || field === 'remisePct' || field === 'tvaPct') {
      const line = newLines[index];
      if (line.prixUnitaireHT && line.qteRecue > 0) {
        // Apply remise if exists
        let prixAvecRemise = line.prixUnitaireHT;
        const remisePct = line.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        line.totalLigneHT = prixAvecRemise * line.qteRecue;
      } else {
        line.totalLigneHT = 0;
      }
    }
    
    setLines(newLines);
  }

  function calculateTotals() {
    let totalHT = 0;
    let totalTVA = 0;
    
    // Calculate TotalHT (with remise applied)
    lines.forEach((line) => {
      if (line.prixUnitaireHT && line.qteRecue > 0) {
        // Apply remise if exists
        let prixAvecRemise = line.prixUnitaireHT;
        const remisePct = line.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * line.qteRecue;
        totalHT += ligneHT;
      } else if (line.totalLigneHT) {
        totalHT += line.totalLigneHT;
      }
    });
    
    // Calculate FODEC
    const fodec = formData.fodecActif ? totalHT * (formData.tauxFodec / 100) : 0;
    
    // Calculate TVA (base includes FODEC if active)
    lines.forEach((line) => {
      if (line.prixUnitaireHT && line.qteRecue > 0 && line.tvaPct) {
        // Apply remise if exists
        let prixAvecRemise = line.prixUnitaireHT;
        const remisePct = line.remisePct || 0;
        if (remisePct > 0) {
          prixAvecRemise = prixAvecRemise * (1 - remisePct / 100);
        }
        const ligneHT = prixAvecRemise * line.qteRecue;
        const ligneFodec = formData.fodecActif ? ligneHT * (formData.tauxFodec / 100) : 0;
        const ligneBaseTVA = ligneHT + ligneFodec;
        const ligneTVA = ligneBaseTVA * (line.tvaPct / 100);
        totalTVA += ligneTVA;
      } else if (line.totalLigneHT && line.tvaPct) {
        const ligneHT = line.totalLigneHT;
        const ligneFodec = formData.fodecActif ? ligneHT * (formData.tauxFodec / 100) : 0;
        const ligneBaseTVA = ligneHT + ligneFodec;
        const ligneTVA = ligneBaseTVA * (line.tvaPct / 100);
        totalTVA += ligneTVA;
      }
    });
    
    // Calculate TIMBRE
    const timbre = formData.timbreActif ? formData.montantTimbre : 0;
    
    // Calculate TotalTTC
    const totalTTC = totalHT + fodec + totalTVA + timbre;
    
    return {
      totalHT,
      fodec,
      totalTVA,
      timbre,
      totalTTC,
    };
  }

  async function handleSave(saveAsValid: boolean = false) {
    if (!tenantId) return;
    
    // Validate
    if (!formData.fournisseurId) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }
    
    if (lines.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne');
      return;
    }
    
    const hasQteRecue = lines.some(line => line.qteRecue > 0);
    if (saveAsValid && !hasQteRecue) {
      toast.error('Au moins une quantité reçue doit être supérieure à 0');
      return;
    }
    
    for (const line of lines) {
      if (line.qteRecue < 0) {
        toast.error('La quantité reçue ne peut pas être négative');
        return;
      }
    }
    
    try {
      setSaving(true);
      
      // Create reception
      const response = await fetch('/api/purchases/receptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          purchaseOrderId: formData.purchaseOrderId || undefined,
          fournisseurId: formData.fournisseurId,
          fournisseurNom: formData.fournisseurNom,
          dateDoc: formData.dateDoc,
          fodecActif: formData.fodecActif,
          tauxFodec: formData.tauxFodec,
          timbreActif: formData.timbreActif,
          montantTimbre: formData.montantTimbre,
          notes: formData.notes,
          lignes: lines,
        }),
      });
      
      if (response.ok) {
        const reception = await response.json();
        
        // If save as valid, validate it
        if (saveAsValid) {
          const validateResponse = await fetch(`/api/purchases/receptions/${reception._id}/valider`, {
            method: 'POST',
            headers: { 'X-Tenant-Id': tenantId },
          });
          
          if (validateResponse.ok) {
            toast.success('Réception créée et validée avec succès');
            router.push(`/purchases/receptions/${reception._id}`);
            return;
          } else {
            toast.error('Réception créée mais erreur lors de la validation');
          }
        } else {
          toast.success('Réception enregistrée en brouillon');
        }
        
        router.push(`/purchases/receptions/${reception._id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la création');
      }
    } catch (error) {
      console.error('Error saving reception:', error);
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  }

  const totals = calculateTotals();

  if (!tenantId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Retour"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-6 h-6 sm:w-8 sm:h-8" />
              <span>Nouveau bon de réception</span>
            </h1>
          </div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm sm:text-base"
          >
            Annuler
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bon de commande (optionnel)
              </label>
              <select
                value={selectedPurchaseOrderId}
                onChange={(e) => {
                  setSelectedPurchaseOrderId(e.target.value);
                  setFormData(prev => ({ ...prev, purchaseOrderId: e.target.value }));
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Sans bon de commande —</option>
                {purchaseOrders.map((po) => (
                  <option key={po._id} value={po._id}>
                    {po.numero} - {po.fournisseurNom}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    setTimeout(() => calculateSupplierDropdownPosition(), 0);
                  }}
                  onFocus={(e) => {
                    setShowSupplierDropdown(true);
                    setTimeout(() => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setSupplierDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width,
                      });
                    }, 0);
                  }}
                  onKeyDown={handleSupplierKeyDown}
                  placeholder="Rechercher un fournisseur..."
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!!formData.purchaseOrderId}
                />
              </div>
              
              {showSupplierDropdown && filteredSuppliers.length > 0 && supplierDropdownPosition && (
                <div 
                  data-supplier-dropdown="true"
                  className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                  style={{
                    top: `${supplierDropdownPosition.top}px`,
                    left: `${supplierDropdownPosition.left}px`,
                    width: `${supplierDropdownPosition.width}px`,
                  }}
                >
                  {filteredSuppliers.map((supplier, index) => {
                    const name = supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
                    return (
                      <div
                        key={supplier._id}
                        onClick={() => handleSelectSupplier(supplier)}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          index === selectedSupplierIndex
                            ? 'bg-blue-50 border-l-2 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{name}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de réception *
              </label>
              <input
                type="date"
                value={formData.dateDoc}
                onChange={(e) => setFormData(prev => ({ ...prev, dateDoc: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* FODEC and TIMBRE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 border-t pt-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.fodecActif}
                  onChange={(e) => setFormData(prev => ({ ...prev, fodecActif: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">FODEC</span>
              </label>
              {formData.fodecActif && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Taux FODEC (%)</label>
                  <input
                    type="number"
                    value={formData.tauxFodec}
                    onChange={(e) => setFormData(prev => ({ ...prev, tauxFodec: parseFloat(e.target.value) || 1 }))}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.timbreActif}
                  onChange={(e) => setFormData(prev => ({ ...prev, timbreActif: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Timbre fiscal</span>
              </label>
              {formData.timbreActif && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Montant Timbre (TND)</label>
                  <input
                    type="number"
                    value={formData.montantTimbre}
                    onChange={(e) => setFormData(prev => ({ ...prev, montantTimbre: parseFloat(e.target.value) || 1.000 }))}
                    min="0"
                    step="0.001"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Notes additionnelles..."
            />
          </div>

          {/* Lines Table */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Lignes</h3>
              {!formData.purchaseOrderId && (
                <button
                  onClick={addLine}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <PlusIcon className="w-5 h-5" />
                  Ajouter une ligne
                </button>
              )}
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
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-800 whitespace-nowrap">Réf</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-800">Désignation</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Qté commandée</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Qté reçue *</th>
                      <th className="px-3 py-3 text-center text-sm font-bold text-gray-800 whitespace-nowrap">Unité</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Prix HT</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Remise %</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">TVA %</th>
                      <th className="px-3 py-3 text-right text-sm font-bold text-gray-800 whitespace-nowrap">Total HT</th>
                      {!formData.purchaseOrderId && <th className="px-2 py-3"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={line.reference || ''}
                            onChange={(e) => updateLine(index, 'reference', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm"
                            disabled={!!formData.purchaseOrderId}
                          />
                        </td>
                        <td className="px-4 py-3 overflow-visible">
                          {formData.purchaseOrderId ? (
                            <input
                              type="text"
                              value={line.designation || ''}
                              className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50"
                              readOnly
                            />
                          ) : (
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
                              
                              {/* Dropdown */}
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
                                  {/* Alphabet filter bar */}
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
                                  
                                  {/* Product list */}
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
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={line.qteCommandee || ''}
                            className="w-full px-2 py-1.5 border rounded text-sm bg-gray-50 text-right"
                            readOnly
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            value={line.qteRecue || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              updateLine(index, 'qteRecue', isNaN(value) ? 0 : value);
                            }}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1.5 border rounded text-sm text-right"
                            required
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={line.uom || ''}
                            onChange={(e) => updateLine(index, 'uom', e.target.value)}
                            className="w-full px-2 py-1.5 border rounded text-sm text-center"
                            disabled={!!formData.purchaseOrderId}
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
                            disabled={!!formData.purchaseOrderId}
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
                            disabled={!!formData.purchaseOrderId}
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
                            disabled={!!formData.purchaseOrderId}
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
                        {!formData.purchaseOrderId && (
                          <td className="px-2 py-3">
                            <button
                              onClick={() => removeLine(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={8} className="px-4 py-3 text-right font-semibold text-gray-700">
                        Total HT:
                      </td>
                      <td className="px-2 py-3 font-bold text-gray-900">
                        {totals.totalHT.toFixed(3)} DT
                      </td>
                    </tr>
                    {formData.fodecActif && (
                      <tr>
                        <td colSpan={8} className="px-4 py-3 text-right font-semibold text-gray-700">
                          FODEC ({formData.tauxFodec}%):
                        </td>
                        <td className="px-2 py-3 font-bold text-gray-900">
                          {totals.fodec.toFixed(3)} DT
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={8} className="px-4 py-3 text-right font-semibold text-gray-700">
                        Total TVA:
                      </td>
                      <td className="px-2 py-3 font-bold text-gray-900">
                        {totals.totalTVA.toFixed(3)} DT
                      </td>
                    </tr>
                    {formData.timbreActif && totals.timbre > 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-3 text-right font-semibold text-gray-700">
                          Timbre fiscal:
                        </td>
                        <td className="px-2 py-3 font-bold text-gray-900">
                          {totals.timbre.toFixed(3)} DT
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={8} className="px-4 py-3 text-right font-semibold text-blue-600">
                        Total TTC:
                      </td>
                      <td className="px-2 py-3 font-bold text-blue-600">
                        {totals.totalTTC.toFixed(3)} DT
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => router.back()}
              className="w-full sm:w-auto px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm sm:text-base"
            >
              Annuler
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm sm:text-base"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer brouillon'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm sm:text-base"
            >
              {saving ? 'Validation...' : 'Valider la réception'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
