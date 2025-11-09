'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

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

export default function EditPurchaseInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [suppliers, setSuppliers] = useState<any[]>([]);
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
    dateFacture: new Date().toISOString().split('T')[0],
    referenceFournisseur: '',
    fournisseurId: '',
    fournisseurNom: '',
    devise: 'TND',
    conditionsPaiement: '',
    statut: 'BROUILLON',
    fodec: {
      enabled: false,
      tauxPct: 1,
      montant: 0,
    },
    timbre: {
      enabled: true,
      montant: 1.000,
    },
    notes: '',
  });
  
  const [lines, setLines] = useState<InvoiceLine[]>([]);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchInvoice();
      fetchSuppliers();
      fetchProducts();
    }
  }, [tenantId, params.id]);

  async function fetchInvoice() {
    if (!tenantId || !params.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/purchases/invoices/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const invoice = await response.json();
        
        setFormData({
          dateFacture: invoice.dateFacture ? new Date(invoice.dateFacture).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          referenceFournisseur: invoice.referenceFournisseur || '',
          fournisseurId: invoice.fournisseurId || '',
          fournisseurNom: invoice.fournisseurNom || '',
          devise: invoice.devise || 'TND',
          conditionsPaiement: invoice.conditionsPaiement || '',
          statut: invoice.statut || 'BROUILLON',
          fodec: {
            enabled: invoice.fodec?.enabled ?? false,
            tauxPct: invoice.fodec?.tauxPct ?? 1,
            montant: invoice.fodec?.montant ?? 0,
          },
          timbre: {
            enabled: invoice.timbre?.enabled ?? true,
            montant: invoice.timbre?.montant ?? 1.000,
          },
          notes: invoice.notes || '',
        });
        
        setSupplierSearch(invoice.fournisseurNom || '');
        setLines(invoice.lignes || []);
        
        // Initialize product searches
        const searches: { [key: number]: string } = {};
        (invoice.lignes || []).forEach((line: InvoiceLine, idx: number) => {
          if (line.designation) {
            searches[idx] = line.designation;
          }
        });
        setProductSearches(searches);
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

  const handleSelectSupplier = (supplier: any) => {
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

  function addLine() {
    const newIndex = lines.length;
    setLines([...lines, {
      produitId: '',
      designation: '',
      quantite: 0,
      prixUnitaireHT: 0,
      remisePct: 0,
      tvaPct: 0,
      fodecPct: 0,
      totalLigneHT: 0,
    }]);
    // Initialize empty search for new line
    setProductSearches({ ...productSearches, [newIndex]: '' });
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
    // Clear product search and dropdown states for the removed line
    const newProductSearches = { ...productSearches };
    delete newProductSearches[index];
    setProductSearches(newProductSearches);

    const newShowProductDropdowns = { ...showProductDropdowns };
    delete newShowProductDropdowns[index];
    setShowProductDropdowns(newShowProductDropdowns);

    const newSelectedProductIndices = { ...selectedProductIndices };
    delete newSelectedProductIndices[index];
    setSelectedProductIndices(newSelectedProductIndices);

    const newProductDropdownPositions = { ...productDropdownPositions };
    delete newProductDropdownPositions[index];
    setProductDropdownPositions(newProductDropdownPositions);
  }

  function updateLine(index: number, field: keyof InvoiceLine, value: any) {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // Recalculate total if price, quantity, or remise changed
    if (field === 'quantite' || field === 'prixUnitaireHT' || field === 'remisePct' || field === 'tvaPct') {
      const line = newLines[index];
      if (line.prixUnitaireHT && line.quantite > 0) {
        // Apply remise if exists
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
    let totalHTAvantRemise = 0;
    let totalTVA = 0;
    
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
    if (!tenantId || !params.id) return;
    
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
      const response = await fetch(`/api/purchases/invoices/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          ...formData,
          lignes: lines,
        }),
      });
      
      if (response.ok) {
        toast.success('Facture mise à jour avec succès');
        router.push(`/purchases/invoices/${params.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
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

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-6">
          <button onClick={() => router.push(`/purchases/invoices/${params.id}`)} className="text-gray-600 hover:text-gray-800 mr-2">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Modifier la facture d'achat</h1>
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
                <label htmlFor="dateFacture" className="block text-sm font-medium text-gray-700 mb-1">
                  Date de facture *
                </label>
                <input
                  type="date"
                  id="dateFacture"
                  value={formData.dateFacture}
                  onChange={(e) => setFormData({ ...formData, dateFacture: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="referenceFournisseur" className="block text-sm font-medium text-gray-700 mb-1">
                  N° facture fournisseur
                </label>
                <input
                  type="text"
                  id="referenceFournisseur"
                  value={formData.referenceFournisseur}
                  onChange={(e) => setFormData({ ...formData, referenceFournisseur: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Référence externe du fournisseur"
                />
              </div>

              <div>
                <label htmlFor="devise" className="block text-sm font-medium text-gray-700 mb-1">
                  Devise
                </label>
                <input
                  type="text"
                  id="devise"
                  value={formData.devise}
                  onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <label htmlFor="conditionsPaiement" className="block text-sm font-medium text-gray-700 mb-1">
                  Conditions de paiement
                </label>
                <input
                  type="text"
                  id="conditionsPaiement"
                  value={formData.conditionsPaiement}
                  onChange={(e) => setFormData({ ...formData, conditionsPaiement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Ex: 30 jours fin de mois"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Lignes */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Lignes de facture</h2>
              <button
                onClick={addLine}
                className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                Ajouter une ligne
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Désignation</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prix HT</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remise %</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">TVA %</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total HT</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <div className="product-autocomplete relative">
                          <input
                            type="text"
                            data-product-input={index}
                            value={productSearches[index] || line.designation || ''}
                            onChange={(e) => {
                              const searchValue = e.target.value;
                              setProductSearches({ ...productSearches, [index]: searchValue });
                              updateLine(index, 'designation', searchValue);
                              setShowProductDropdowns({ ...showProductDropdowns, [index]: true });
                              setSelectedProductIndices({ ...selectedProductIndices, [index]: -1 });
                              
                              const input = e.target as HTMLInputElement;
                              const position = calculateProductDropdownPosition(input);
                              setProductDropdownPositions({ ...productDropdownPositions, [index]: position });
                            }}
                            onFocus={(e) => {
                              setShowProductDropdowns({ ...showProductDropdowns, [index]: true });
                              const position = calculateProductDropdownPosition(e.target as HTMLInputElement);
                              setProductDropdownPositions({ ...productDropdownPositions, [index]: position });
                            }}
                            onKeyDown={(e) => handleProductKeyDown(e, index)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                            placeholder="Rechercher un produit..."
                          />
                          {showProductDropdowns[index] && productDropdownPositions[index] && getFilteredProducts(index).length > 0 && (
                            <div
                              className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
                              style={{
                                width: `${productDropdownPositions[index].width}px`,
                                top: `${productDropdownPositions[index].top}px`,
                                left: `${productDropdownPositions[index].left}px`,
                              }}
                            >
                              {getFilteredProducts(index).map((product, productIndex) => (
                                <div
                                  key={product._id}
                                  onClick={() => handleSelectProduct(index, product)}
                                  className={`px-4 py-2 cursor-pointer hover:bg-gray-100 ${
                                    productIndex === (selectedProductIndices[index] || -1) ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <div className="font-medium">{product.nom}</div>
                                  {(product.sku || product.referenceClient) && (
                                    <div className="text-xs text-gray-500">
                                      {product.sku || product.referenceClient}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.quantite || 0}
                          onChange={(e) => updateLine(index, 'quantite', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={line.prixUnitaireHT || 0}
                          onChange={(e) => updateLine(index, 'prixUnitaireHT', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.remisePct || 0}
                          onChange={(e) => updateLine(index, 'remisePct', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.tvaPct || 0}
                          onChange={(e) => updateLine(index, 'tvaPct', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-medium">
                        {line.totalLigneHT?.toFixed(3) || '0.000'} DT
                      </td>
                      <td className="px-3 py-3 text-center">
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
                <tfoot className="bg-gray-50">
                  {totals.totalRemise > 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                        Total Remise:
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-red-600">
                        -{totals.totalRemise.toFixed(3)} DT
                      </td>
                      <td></td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      Total HT:
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                      {totals.totalHT.toFixed(3)} DT
                    </td>
                    <td></td>
                  </tr>
                  {formData.fodec.enabled && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                        FODEC ({formData.fodec.tauxPct}%):
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                        {totals.fodec.toFixed(3)} DT
                      </td>
                      <td></td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      Total TVA:
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                      {totals.totalTVA.toFixed(3)} DT
                    </td>
                    <td></td>
                  </tr>
                  {formData.timbre.enabled && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                        Timbre fiscal:
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">
                        {totals.timbre.toFixed(3)} DT
                      </td>
                      <td></td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-blue-600">
                      Total TTC:
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-blue-600">
                      {totals.totalTTC.toFixed(3)} DT
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Section 3: Totaux et options */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Options fiscales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="fodecEnabled"
                  checked={formData.fodec.enabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    fodec: { ...formData.fodec, enabled: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="fodecEnabled" className="ml-2 block text-sm text-gray-900">
                  Activer FODEC
                </label>
              </div>
              {formData.fodec.enabled && (
                <div>
                  <label htmlFor="tauxFodec" className="block text-sm font-medium text-gray-700 mb-1">
                    Taux FODEC (%)
                  </label>
                  <input
                    type="number"
                    id="tauxFodec"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.fodec.tauxPct}
                    onChange={(e) => setFormData({
                      ...formData,
                      fodec: { ...formData.fodec, tauxPct: parseFloat(e.target.value) || 1 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              )}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="timbreEnabled"
                  checked={formData.timbre.enabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    timbre: { ...formData.timbre, enabled: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="timbreEnabled" className="ml-2 block text-sm text-gray-900">
                  Activer Timbre fiscal
                </label>
              </div>
              {formData.timbre.enabled && (
                <div>
                  <label htmlFor="montantTimbre" className="block text-sm font-medium text-gray-700 mb-1">
                    Montant Timbre (DT)
                  </label>
                  <input
                    type="number"
                    id="montantTimbre"
                    min="0"
                    step="0.001"
                    value={formData.timbre.montant}
                    onChange={(e) => setFormData({
                      ...formData,
                      timbre: { ...formData.timbre, montant: parseFloat(e.target.value) || 1.000 }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              )}
            </div>
            <div className="mt-4">
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

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => router.push(`/purchases/invoices/${params.id}`)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


