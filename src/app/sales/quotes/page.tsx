'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, DocumentTextIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Quote {
  _id: string;
  numero: string;
  dateDoc: string;
  customerId?: string;
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

export default function QuotesPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
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
  const [showProductDropdowns, setShowProductDropdowns] = useState<{ [key: number]: boolean }>({});
  const [selectedProductIndices, setSelectedProductIndices] = useState<{ [key: number]: number }>({});
  const [productDropdownPositions, setProductDropdownPositions] = useState<{ [key: number]: { top: number; left: number; width: number; isMobile?: boolean } }>({});
  
  // Calculate default validity date (15 days from today)
  const getDefaultValidite = () => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date.toISOString().split('T')[0];
  };

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    dateDoc: new Date().toISOString().split('T')[0],
    referenceExterne: '',
    devise: 'TND',
    modePaiement: 'Espèces',
    validite: getDefaultValidite(),
    notes: '',
    remiseGlobalePct: 0,
    timbreActif: false,
    fodec: { enabled: false, tauxPct: 1 }
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
    if (tenantId) fetchQuotes();
  }, [tenantId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-autocomplete')) {
        setShowCustomerDropdown(false);
      }
      if (!target.closest('.product-autocomplete')) {
        setShowProductDropdowns({});
        setSelectedProductIndices({});
        setProductDropdownPositions({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown positions when dropdowns are shown
  useEffect(() => {
    Object.keys(showProductDropdowns).forEach((key) => {
      const lineIndex = parseInt(key);
      if (showProductDropdowns[lineIndex]) {
        // Find the input element for this line
        const input = document.querySelector(`.product-autocomplete input[data-line-index="${lineIndex}"]`) as HTMLInputElement;
        if (input && !productDropdownPositions[lineIndex]) {
          const position = calculateDropdownPosition(input);
          setProductDropdownPositions(prev => ({ ...prev, [lineIndex]: position }));
        }
      }
    });
  }, [showProductDropdowns]);

  // Close dropdowns on scroll to prevent positioning issues
  useEffect(() => {
    const handleScroll = () => {
      if (Object.keys(showProductDropdowns).length > 0) {
        setShowProductDropdowns({});
        setSelectedProductIndices({});
        setProductDropdownPositions({});
      }
    };

    window.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scroll events
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showProductDropdowns]);

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
  // Using fixed position (relative to viewport, not document)
  const calculateDropdownPosition = (inputElement: HTMLInputElement) => {
    const rect = inputElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 640; // sm breakpoint
    
    // On mobile, make dropdown full width with some padding
    if (isMobile) {
      return {
        top: rect.bottom + 4,
        left: 8, // 8px padding from screen edge
        width: viewportWidth - 16, // Full width minus padding
        isMobile: true
      };
    }
    
    // On desktop, use input width but ensure it doesn't go off screen
    const maxWidth = Math.min(rect.width, viewportWidth - rect.left - 16);
    const left = Math.max(8, Math.min(rect.left, viewportWidth - maxWidth - 8));
    
    return {
      top: rect.bottom + 4,
      left: left,
      width: maxWidth,
      isMobile: false
    };
  };

  // Handle product selection for a specific line
  const handleSelectProduct = (lineIndex: number, product: Product) => {
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

  const fetchQuotes = async () => {
    try {
      if (!tenantId) return;
      setLoading(true);
      const response = await fetch('/api/sales/quotes', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        const quotes = data.items || [];
        
        // Fetch customer names for each quote
        const quotesWithCustomers = await Promise.all(
          quotes.map(async (quote: Quote) => {
            if (quote.customerId) {
              try {
                const customerResponse = await fetch(`/api/customers/${quote.customerId}`, {
                  headers: { 'X-Tenant-Id': tenantId }
                });
                if (customerResponse.ok) {
                  const customer = await customerResponse.json();
                  return {
                    ...quote,
                    customerName: customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim()
                  };
                }
              } catch (err) {
                console.error('Error fetching customer:', err);
              }
            }
            return quote;
          })
        );
        
        setQuotes(quotesWithCustomers);
      }
    } catch (err) {
      console.error('Error fetching quotes:', err);
      toast.error('Erreur lors du chargement des devis');
    } finally {
      setLoading(false);
    }
  };

  const filtered = quotes.filter(quote =>
    quote.numero.toLowerCase().includes(q.toLowerCase()) ||
    (quote.customerName && quote.customerName.toLowerCase().includes(q.toLowerCase()))
  );

  // Calculate totals
  const calculateTotals = () => {
    let totalHTBeforeDiscount = 0;
    let totalHTAfterLineDiscount = 0;
    
    lines.forEach(line => {
      const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
      totalHTBeforeDiscount += lineHTBeforeDiscount;
      const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
      totalHTAfterLineDiscount += lineHT;
    });
    
    // Apply global remise
    const remiseGlobalePct = formData.remiseGlobalePct || 0;
    const totalHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));
    
    // Calculate remise amounts
    const remiseLignes = totalHTBeforeDiscount - totalHTAfterLineDiscount;
    const remiseGlobale = totalHTAfterLineDiscount - totalHT;
    
    // Calculate FODEC on Total HT AFTER discount
    // FODEC = totalHT * (tauxPct / 100)
    const fodec = formData.fodec?.enabled ? totalHT * ((formData.fodec.tauxPct || 1) / 100) : 0;
    
    // Calculate TVA per line (based on HT after line discount, before global remise, plus FODEC)
    const totalTVA = lines.reduce((sum, line) => {
      const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
      const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
      // Apply global remise to line HT for TVA calculation
      const lineHTAfterGlobalRemise = lineHT * (1 - (remiseGlobalePct / 100));
      // Add FODEC to base for TVA calculation (proportional to line)
      const lineFodec = formData.fodec?.enabled ? lineHTAfterGlobalRemise * ((formData.fodec.tauxPct || 1) / 100) : 0;
      const lineBaseTVA = lineHTAfterGlobalRemise + lineFodec;
      const lineTVA = lineBaseTVA * (line.tvaPct || 0) / 100;
      return sum + lineTVA;
    }, 0);
    
    // Timbre fiscal
    const timbreAmount = (formData.timbreActif && tvaSettings?.timbreFiscal?.actif) 
      ? (tvaSettings?.timbreFiscal?.montantFixe || 1) 
      : 0;
    
    const totalTTC = totalHT + fodec + totalTVA + timbreAmount;
    
    return { 
      totalHTBeforeDiscount,
      totalHT, 
      remiseLignes,
      remiseGlobale,
      remiseGlobalePct,
      totalTVA, 
      fodec,
      timbreAmount,
      totalTTC 
    };
  };

  const totals = calculateTotals();

  // Save quote
  const handleCreateQuote = async () => {
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

      const url = editingQuoteId 
        ? `/api/sales/quotes/${editingQuoteId}` 
        : '/api/sales/quotes';
      
      const method = editingQuoteId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId 
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          dateDoc: formData.dateDoc,
          dateValidite: formData.validite || undefined,
          referenceExterne: formData.referenceExterne,
          devise: formData.devise,
          modePaiement: formData.modePaiement || undefined,
          notes: formData.notes,
          lignes: lignesData,
          remiseGlobalePct: formData.remiseGlobalePct || 0,
          timbreFiscal: totals.timbreAmount,
          fodec: formData.fodec?.enabled ? {
            enabled: formData.fodec.enabled,
            tauxPct: formData.fodec.tauxPct || 1,
            montant: totals.fodec || 0
          } : undefined
        })
      });

      if (response.ok) {
        toast.success(editingQuoteId ? 'Devis modifié avec succès' : 'Devis créé avec succès');
        setShowModal(false);
        setLines([]);
        setEditingQuoteId(null);
        setFormData({
          customerId: '',
          dateDoc: new Date().toISOString().split('T')[0],
          referenceExterne: '',
          devise: 'TND',
          modePaiement: 'Espèces',
          validite: getDefaultValidite(),
          notes: '',
          remiseGlobalePct: 0,
          timbreActif: false,
          fodec: { enabled: false, tauxPct: 1 }
        });
        setCustomerSearch('');
        setShowCustomerDropdown(false);
        setSelectedCustomerIndex(-1);
        setProductSearches({});
        setShowProductDropdowns({});
        setSelectedProductIndices({});
        fetchQuotes();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur');
      }
    } catch (err) {
      console.error('Error saving quote:', err);
      toast.error('Erreur');
    }
  };

  // Handle view quote
  const handleView = async (quote: Quote) => {
    try {
      console.log('🔍 Viewing quote:', quote._id);
      console.log('📋 Quote details:', quote);
      
      // Fetch full quote details
      const response = await fetch(`/api/sales/quotes/${quote._id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Full quote data:', data);
        toast.success(`Devis ${quote.numero} chargé avec succès`);
        router.push(`/sales/quotes/${quote._id}`);
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

  // Handle edit quote
  const handleEdit = async (quote: Quote) => {
    console.log('✏️ Editing quote:', quote._id);
    
    // Fetch full quote details
    try {
      const response = await fetch(`/api/sales/quotes/${quote._id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (response.ok) {
        const fullQuote = await response.json();
        console.log('📋 Full quote data:', fullQuote);
        
        // Populate form with quote data
        setFormData({
          customerId: fullQuote.customerId || '',
          dateDoc: fullQuote.dateDoc?.split('T')[0] || new Date().toISOString().split('T')[0],
          referenceExterne: fullQuote.referenceExterne || '',
          devise: fullQuote.devise || 'TND',
          modePaiement: fullQuote.modePaiement || '',
          validite: fullQuote.dateValidite?.split('T')[0] || '',
          notes: fullQuote.notes || '',
          remiseGlobalePct: fullQuote.remiseGlobalePct || 0,
          timbreActif: (fullQuote.timbreFiscal || 0) > 0,
          fodec: fullQuote.fodec ? {
            enabled: fullQuote.fodec.enabled || false,
            tauxPct: fullQuote.fodec.tauxPct || 1
          } : { enabled: false, tauxPct: 1 }
        });
        
        // Set customer search based on selected customer
        if (fullQuote.customerId) {
          const selectedCustomer = customers.find(c => c._id === fullQuote.customerId);
          if (selectedCustomer) {
            setCustomerSearch(selectedCustomer.raisonSociale || `${selectedCustomer.nom || ''} ${selectedCustomer.prenom || ''}`.trim());
          }
        } else {
          setCustomerSearch('');
        }
        
        // Populate lines
        if (fullQuote.lignes && fullQuote.lignes.length > 0) {
          const mappedLines = fullQuote.lignes.map((line: any) => ({
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
          
          // Populate product searches
          const searches: { [key: number]: string } = {};
          mappedLines.forEach((line: any, idx: number) => {
            const product = products.find(p => p._id === line.productId);
            if (product) {
              searches[idx] = product.nom;
            }
          });
          setProductSearches(searches);
        }
        
        // Set editing state
        setEditingQuoteId(fullQuote._id);
        
        // Open modal
        setShowModal(true);
      } else {
        toast.error('Erreur lors du chargement du devis');
      }
    } catch (err) {
      console.error('Error fetching quote:', err);
      toast.error('Erreur lors du chargement du devis');
    }
  };

  // Handle open new quote modal
  const handleOpenNewQuoteModal = async () => {
    setEditingQuoteId(null);
    setLines([]);
    setProductSearches({});
    setShowProductDropdowns({});
    setSelectedProductIndices({});
    setProductDropdownPositions({});
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setSelectedCustomerIndex(-1);
    
    // Ensure TVA settings are loaded before opening modal
    let currentTvaSettings = tvaSettings;
    if (!currentTvaSettings) {
      try {
        if (tenantId) {
          const response = await fetch('/api/settings', {
            headers: { 'X-Tenant-Id': tenantId }
          });
          if (response.ok) {
            const data = await response.json();
            currentTvaSettings = data.tva;
            setTvaSettings(data.tva);
          }
        }
      } catch (err) {
        console.error('Error fetching TVA settings:', err);
      }
    }
    
    const resolvedForm = {
      customerId: '',
      dateDoc: new Date().toISOString().split('T')[0],
      referenceExterne: '',
      devise: 'TND',
      modePaiement: 'Espèces',
      validite: getDefaultValidite(),
      notes: '',
      remiseGlobalePct: 0,
      timbreActif: false,
      // Activate FODEC automatically if enabled in settings
      fodec: currentTvaSettings?.fodec?.actif ? {
        enabled: true,
        tauxPct: currentTvaSettings.fodec.tauxPct || 1
      } : { enabled: false, tauxPct: 1 }
    };
    setFormData(resolvedForm);
    setShowModal(true);
  };

  // Handle download PDF
  const handleDownloadPDF = async (quote: Quote) => {
    try {
      const response = await fetch(`/api/sales/quotes/${quote._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Devis-${quote.numero}.pdf`;
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

  // Handle delete quote
  const handleDelete = async (quoteId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce devis ?')) {
      return;
    }

    try {
      if (!tenantId) return;
      
      const response = await fetch(`/api/sales/quotes/${quoteId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId }
      });

      if (response.ok) {
        toast.success('Devis supprimé avec succès');
        fetchQuotes();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression du devis');
      }
    } catch (err) {
      console.error('Error deleting quote:', err);
      toast.error('Erreur lors de la suppression du devis');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8" /> <span className="whitespace-nowrap">Devis</span>
          </h1>
          <div className="flex gap-2">
            <button className="hidden sm:flex items-center gap-2 border px-3 py-2 rounded-lg hover:bg-gray-50">
              <ArrowDownTrayIcon className="w-4 h-4" /> <span className="hidden lg:inline">Exporter</span>
            </button>
            <button 
              onClick={handleOpenNewQuoteModal} 
              className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <PlusIcon className="w-5 h-5" /> <span>Nouveau devis</span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun devis trouvé</h3>
            <p className="text-gray-600 mb-6">Créez votre premier devis en quelques clics</p>
            <button 
              onClick={handleOpenNewQuoteModal}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mx-auto"
            >
              <PlusIcon className="w-5 h-5" /> Nouveau devis
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
                  <th className="px-3 py-4 text-right text-sm font-semibold text-gray-700">Timbre</th>
                  <th className="px-3 py-4 text-right text-sm font-semibold text-gray-700">Total TVA</th>
                  <th className="px-3 py-4 text-right text-sm font-semibold text-gray-700">Total TTC</th>
                  <th className="px-2 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((quote) => (
                  <tr key={quote._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{quote.numero}</td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(quote.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600">
                      {quote.customerName || '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap">
                      {quote.totalBaseHT?.toFixed(3)} {quote.devise || 'TND'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 text-right whitespace-nowrap">
                      {quote.timbreFiscal && quote.timbreFiscal > 0 ? `${quote.timbreFiscal.toFixed(3)} ${quote.devise || 'TND'}` : '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap">
                      {quote.totalTVA?.toFixed(3)} {quote.devise || 'TND'}
                    </td>
                    <td className="px-3 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                      {quote.totalTTC?.toFixed(3)} {quote.devise || 'TND'}
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex gap-0.5">
                        <button 
                          onClick={() => {
                            console.log('🔵 BUTTON CLICKED - Quote ID:', quote._id);
                            handleView(quote);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            console.log('🟢 MODIFY BUTTON CLICKED - Quote:', quote);
                            handleEdit(quote);
                          }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDownloadPDF(quote)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Télécharger PDF"
                        >
                          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(quote._id)}
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
              {filtered.map((quote) => (
                <div key={quote._id} className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{quote.numero}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(quote.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleView(quote)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Voir"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(quote)}
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
                      <span className="font-medium text-gray-900">{quote.customerName || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total HT:</span>
                      <span className="font-medium text-gray-900">{quote.totalBaseHT?.toFixed(3)} {quote.devise || 'TND'}</span>
                    </div>
                    {quote.timbreFiscal && quote.timbreFiscal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Timbre:</span>
                        <span className="font-medium text-gray-900">{quote.timbreFiscal.toFixed(3)} {quote.devise || 'TND'}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">TVA:</span>
                      <span className="font-medium text-gray-900">{quote.totalTVA?.toFixed(3)} {quote.devise || 'TND'}</span>
                    </div>
                    <div className="flex justify-between text-base pt-2 border-t">
                      <span className="font-semibold text-gray-900">Total TTC:</span>
                      <span className="font-bold text-blue-600">{quote.totalTTC?.toFixed(3)} {quote.devise || 'TND'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => handleDownloadPDF(quote)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      PDF
                    </button>
                    <button 
                      onClick={() => handleDelete(quote._id)}
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
                    {editingQuoteId ? '✏️ Modifier devis' : '🧾 Nouveau devis'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {editingQuoteId ? 'Modifiez votre devis' : 'Créez un devis élégant et précis en quelques clics'}
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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Remise %</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Total TVA</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Total TTC</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lines.map((line, index) => (
                            <tr key={index}>
                              <td className="px-2 sm:px-4 py-3 overflow-visible">
                                <div className="relative product-autocomplete">
                                  <div className="relative">
                                    <MagnifyingGlassIcon className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                                    <input
                                      type="text"
                                      data-line-index={index}
                                      value={productSearches[index] || ''}
                                      onChange={(e) => {
                                        const input = e.target as HTMLInputElement;
                                        setProductSearches({ ...productSearches, [index]: e.target.value });
                                        setShowProductDropdowns({ ...showProductDropdowns, [index]: true });
                                        setSelectedProductIndices({ ...selectedProductIndices, [index]: -1 });
                                        const position = calculateDropdownPosition(input);
                                        setProductDropdownPositions({ ...productDropdownPositions, [index]: position });
                                      }}
                                      onFocus={(e) => {
                                        const input = e.target as HTMLInputElement;
                                        setShowProductDropdowns({ ...showProductDropdowns, [index]: true });
                                        const position = calculateDropdownPosition(input);
                                        setProductDropdownPositions({ ...productDropdownPositions, [index]: position });
                                      }}
                                      onKeyDown={(e) => handleProductKeyDown(e, index)}
                                      placeholder="Rechercher un produit..."
                                      className="w-full pl-8 sm:pl-10 pr-2 sm:pr-3 py-2 sm:py-2.5 border rounded-lg text-sm sm:text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                  
                                  {/* Dropdown */}
                                  {showProductDropdowns[index] && productDropdownPositions[index] && (
                                    <div 
                                      className={`fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden ${
                                        productDropdownPositions[index].isMobile 
                                          ? 'max-h-[60vh]' 
                                          : 'max-h-[280px]'
                                      }`}
                                      style={{ 
                                        width: `${productDropdownPositions[index].width}px`,
                                        top: `${productDropdownPositions[index].top}px`,
                                        left: `${productDropdownPositions[index].left}px`
                                      }}
                                    >
                                      {/* Alphabet filter bar - scrollable on mobile */}
                                      <div className={`flex items-center gap-1 px-2 py-2 bg-gray-50 border-b ${
                                        productDropdownPositions[index].isMobile 
                                          ? 'overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300' 
                                          : 'justify-center'
                                      }`}>
                                        {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
                                          <button
                                            key={letter}
                                            onClick={() => handleProductAlphabetClick(index, letter)}
                                            className="px-2 sm:px-1.5 py-1 sm:py-0.5 rounded hover:bg-blue-100 hover:text-blue-600 active:bg-blue-200 transition-colors font-semibold text-xs sm:text-xs flex-shrink-0"
                                          >
                                            {letter}
                                          </button>
                                        ))}
                                      </div>
                                      
                                      {/* Product list */}
                                      <div className={`overflow-y-auto ${
                                        productDropdownPositions[index].isMobile 
                                          ? 'max-h-[calc(60vh-50px)]' 
                                          : 'max-h-[240px]'
                                      }`}>
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
                                                className={`px-3 sm:px-4 py-3 sm:py-2.5 cursor-pointer transition-colors touch-manipulation ${
                                                  prodIndex === (selectedProductIndices[index] || -1)
                                                    ? 'bg-blue-50 border-l-2 border-blue-500'
                                                    : 'hover:bg-gray-50 active:bg-gray-100'
                                                }`}
                                              >
                                                <div className="font-medium text-gray-900 text-sm sm:text-base">{displayName}</div>
                                                {secondaryInfo && (
                                                  <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{secondaryInfo}</div>
                                                )}
                                              </div>
                                            );
                                          })
                                        ) : (
                                          <div className="px-4 py-8 text-center text-gray-500 text-sm sm:text-base">
                                            Aucun produit trouvé
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="text" 
                                  value={line.quantite || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updatedLines = [...lines];
                                    updatedLines[index] = { ...updatedLines[index], quantite: parseFloat(val) || 0 };
                                    setLines(updatedLines);
                                  }}
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                  placeholder="0"
                                />
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
                              <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                                {(((line.quantite || 0) * (line.prixUnitaireHT || 0)) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {formData.devise}
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  type="number" 
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={line.remisePct ?? ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const updatedLines = [...lines];
                                    updatedLines[index] = { ...updatedLines[index], remisePct: Math.min(100, Math.max(0, val)) };
                                    setLines(updatedLines);
                                  }}
                                  className="w-20 px-2 py-1 border rounded text-sm"
                                  placeholder="0"
                                />
                                <div className="text-xs text-gray-500 mt-1">%</div>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                                {((((line.quantite || 0) * (line.prixUnitaireHT || 0)) * (1 - ((line.remisePct || 0) / 100))) * ((line.tvaPct || 0) / 100)).toFixed(3)} {formData.devise}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-blue-600 whitespace-nowrap">
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
                        <span className="font-medium">{totals.totalHTBeforeDiscount.toFixed(3)} {formData.devise}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Remise lignes</span>
                        {totals.remiseLignes > 0 ? (
                          <span className="font-medium text-red-600">-{totals.remiseLignes.toFixed(3)} {formData.devise}</span>
                        ) : (
                          <span className="font-medium text-gray-400">0.000 {formData.devise}</span>
                        )}
                      </div>
                      {/* Remise globale input */}
                      <div className="flex justify-between text-sm items-center border-t pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Remise globale</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={formData.remiseGlobalePct || 0}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setFormData({ ...formData, remiseGlobalePct: Math.min(100, Math.max(0, value)) });
                            }}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            placeholder="0"
                          />
                          <span className="text-gray-600">%</span>
                        </div>
                        {totals.remiseGlobale > 0 && (
                          <span className="font-medium text-red-600">-{totals.remiseGlobale.toFixed(3)} {formData.devise}</span>
                        )}
                        {totals.remiseGlobale === 0 && (
                          <span className="font-medium text-gray-400">0.000 {formData.devise}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-700">Total HT</span>
                        <span className="font-bold text-gray-900">{totals.totalHT.toFixed(3)} {formData.devise}</span>
                      </div>
                      {/* FODEC */}
                      <div className="flex justify-between text-sm items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">FODEC</span>
                          <input 
                            type="checkbox"
                            checked={formData.fodec?.enabled || false}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              fodec: { 
                                ...formData.fodec, 
                                enabled: e.target.checked,
                                tauxPct: formData.fodec?.tauxPct || 1
                              } 
                            })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </div>
                        {formData.fodec?.enabled && (
                          <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={formData.fodec?.tauxPct || 1}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                fodec: { 
                                  ...formData.fodec, 
                                  enabled: formData.fodec?.enabled || false,
                                  tauxPct: parseFloat(e.target.value) || 1
                                } 
                              })}
                              className="w-16 px-2 py-1 border rounded text-sm"
                              placeholder="1"
                            />
                            <span className="text-gray-600">%</span>
                            <span className="font-medium ml-2">{totals.fodec.toFixed(3)} {formData.devise}</span>
                          </div>
                        )}
                        {!formData.fodec?.enabled && (
                          <span className="font-medium text-gray-400">0.000 {formData.devise}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVA</span>
                        <span className="font-medium">{totals.totalTVA.toFixed(3)} {formData.devise}</span>
                      </div>
                      {tvaSettings?.timbreFiscal?.actif && (
                        <div className="flex justify-between text-sm items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Timbre fiscal</span>
                            <input
                              type="checkbox"
                              checked={formData.timbreActif}
                              onChange={(e) => setFormData({ ...formData, timbreActif: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </div>
                          <span className="font-medium">{totals.timbreAmount.toFixed(3)} {formData.devise}</span>
                        </div>
                      )}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Validité
                    </label>
                    <input 
                      type="date" 
                      value={formData.validite}
                      onChange={(e) => setFormData({ ...formData, validite: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
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
              <div className="p-4 sm:p-6 border-t flex flex-col sm:flex-row justify-end gap-3">
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm sm:text-base"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleCreateQuote}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                >
                  {editingQuoteId ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}