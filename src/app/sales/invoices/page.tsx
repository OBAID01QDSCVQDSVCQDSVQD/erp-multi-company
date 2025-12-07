'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, DocumentTextIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, ArrowDownTrayIcon, TrashIcon, ArrowRightIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import Link from 'next/link';
import ProductSearchModal from '@/components/common/ProductSearchModal';

interface Invoice {
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
  estStocke?: boolean;
}

export default function InvoicesPage() {
  const createDefaultFormData = () => ({
    customerId: '',
    dateDoc: new Date().toISOString().split('T')[0],
    referenceExterne: '',
    devise: 'TND',
    tauxChange: 1,
    modePaiement: 'Espèces',
    dateEcheance: '',
    conditionsPaiement: '',
    notes: '',
    numero: '',
    timbreActif: true,
    remiseGlobalePct: 0,
    fodec: { enabled: false, tauxPct: 1 }
  });

  const router = useRouter();
  const { tenantId } = useTenantId();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertSourceType, setConvertSourceType] = useState<'BL' | 'DEVIS' | null>(null);
  const [sourceDocuments, setSourceDocuments] = useState<any[]>([]);
  const [loadingSourceDocs, setLoadingSourceDocs] = useState(false);
  const [convertSearchQuery, setConvertSearchQuery] = useState('');
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
  const [invoiceNumberPreview, setInvoiceNumberPreview] = useState<string | null>(null);
  const [invoiceNumberLoading, setInvoiceNumberLoading] = useState(false);
  const [productStocks, setProductStocks] = useState<{ [productId: string]: number }>({});
  const [isFromBL, setIsFromBL] = useState(false); // Track if invoice is created from BL
  const [pendingSummary, setPendingSummary] = useState<{ totalCount: number; totalPendingAmount: number } | null>(null);
  const [loadingPendingSummary, setLoadingPendingSummary] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState(() => createDefaultFormData());
  
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
    estStocke?: boolean;
  }>>([]);

  // Fetch invoices function with retry mechanism
  const fetchInvoices = useCallback(async (retryCount: number = 0) => {
    try {
      if (!tenantId) return;
      
      if (retryCount === 0) {
        setLoading(true);
      }
      
      const response = await fetch(`/api/sales/invoices?t=${Date.now()}`, {
        headers: { 'X-Tenant-Id': tenantId },
        cache: 'no-store', // Prevent caching
      });
      
      if (response.ok) {
        const data = await response.json();
        const invoicesList = data.items || [];
        
        // Process invoices - customerId might already be populated as an object
        const invoicesWithCustomers = invoicesList.map((invoice: any) => {
          let customerName = '';
          let customerIdValue = invoice.customerId;
          
          if (invoice.customerId) {
            // Check if customerId is already populated (object) or just an ID (string)
            if (typeof invoice.customerId === 'object' && invoice.customerId !== null) {
              // Already populated from API
              customerName = invoice.customerId.raisonSociale || 
                           `${invoice.customerId.nom || ''} ${invoice.customerId.prenom || ''}`.trim() || 
                           '';
              // Extract the ID from the populated object
              customerIdValue = invoice.customerId._id || invoice.customerId;
            } else if (typeof invoice.customerId === 'string') {
              // Just an ID - keep as is
              customerIdValue = invoice.customerId;
            }
          }
          
          return {
            ...invoice,
            customerId: customerIdValue,
            customerName: customerName || invoice.customerName || ''
          };
        });
        
        setInvoices(invoicesWithCustomers);
        setLoading(false);
      } else if (response.status === 500 && retryCount < 3) {
        // Retry on server error with exponential backoff
        console.warn(`Failed to fetch invoices (attempt ${retryCount + 1}/3), retrying...`);
        setTimeout(() => {
          fetchInvoices(retryCount + 1);
        }, 1000 * (retryCount + 1));
      } else {
        const error = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        console.error('Error fetching invoices:', error);
        setLoading(false);
        if (retryCount >= 3) {
          toast.error(error.error || 'Erreur lors du chargement des factures');
        }
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      if (retryCount < 3) {
        // Retry on network error
        setTimeout(() => {
          fetchInvoices(retryCount + 1);
        }, 1000 * (retryCount + 1));
      } else {
        setLoading(false);
        toast.error('Erreur de connexion lors du chargement des factures');
      }
    }
  }, [tenantId]);

  // Fetch invoices on mount and when tenantId changes
  useEffect(() => {
    if (tenantId) {
      fetchInvoices(0);
      fetchPendingSummary();
    }
  }, [tenantId, fetchInvoices]);

  // Fetch pending invoices summary
  const fetchPendingSummary = async () => {
    try {
      setLoadingPendingSummary(true);
      const response = await fetch('/api/pending-invoices', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching pending summary:', error);
    } finally {
      setLoadingPendingSummary(false);
    }
  };

  // Close dropdown when clicking outside
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

  const incrementInvoiceNumber = (numero?: string | null): string | null => {
    if (!numero) return null;
    const match = numero.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const prefix = match[1];
    const digits = match[2];
    const nextValue = (parseInt(digits, 10) + 1).toString().padStart(digits.length, '0');
    return `${prefix}${nextValue}`;
  };

  const computeNextInvoiceNumberFromExisting = (): string | null => {
    if (!invoices || invoices.length === 0) return null;
    let candidateNumero: string | null = null;
    let highestValue = -Infinity;

    invoices.forEach((invoice) => {
      const numero = invoice.numero;
      if (!numero) return;
      const match = numero.match(/(\d+)(?!.*\d)/);
      if (!match) return;
      const value = parseInt(match[1], 10);
      if (Number.isNaN(value)) return;
      if (value > highestValue) {
        highestValue = value;
        candidateNumero = numero;
      }
    });

    return incrementInvoiceNumber(candidateNumero);
  };

  const findMissingInvoiceNumbers = useMemo(() => {
    const groups = new Map<string, { numbers: number[]; padding: number }>();

    invoices.forEach((invoice) => {
      if (!invoice.numero) return;
      const match = invoice.numero.match(/^(.*?)(\d+)$/);
      if (!match) return;
      const prefix = match[1];
      const digits = match[2];
      const value = parseInt(digits, 10);
      if (Number.isNaN(value)) return;

      if (!groups.has(prefix)) {
        groups.set(prefix, { numbers: [], padding: digits.length });
      }

      const group = groups.get(prefix)!;
      group.numbers.push(value);
      if (digits.length > group.padding) {
        group.padding = digits.length;
      }
    });

    const missing: string[] = [];
    groups.forEach(({ numbers, padding }, prefix) => {
      if (numbers.length < 2) return;
      const sorted = [...numbers].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const current = sorted[i];
        if (current - prev <= 1) continue;

        for (let val = prev + 1; val < current; val++) {
          missing.push(`${prefix}${val.toString().padStart(padding, '0')}`);
          if (missing.length >= 20) {
            return;
          }
        }
      }
    });

    return missing;
  }, [invoices]);

  const fetchInvoiceNumberPreview = async () => {
    if (!tenantId) {
      setInvoiceNumberPreview(null);
      return;
    }

    try {
      setInvoiceNumberLoading(true);
      const response = await fetch('/api/settings/numbering/preview?type=facture', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setInvoiceNumberPreview(data.preview || null);
        if (data.preview) {
          setFormData((prev) => {
            if (prev.numero && prev.numero.trim().length > 0) {
              return prev;
            }
            return { ...prev, numero: data.preview };
          });
        }
      } else {
        setInvoiceNumberPreview(null);
      }
    } catch (error) {
      console.error('Error fetching invoice number preview:', error);
      setInvoiceNumberPreview(null);
    } finally {
      setInvoiceNumberLoading(false);
    }
  };

  const handleCopyInvoiceNumber = async () => {
    const valueToCopy = formData.numero?.trim() || invoiceNumberPreview;
    if (!valueToCopy || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(valueToCopy);
      toast.success('Numéro copié dans le presse-papiers');
    } catch (error) {
      console.error('Error copying invoice number:', error);
      toast.error('Impossible de copier le numéro');
    }
  };

  const handleOpenNewInvoiceModal = async () => {
    setIsFromBL(false); // Reset isFromBL for new invoices
    setEditingInvoiceId(null);
    setLines([]);
    setProductSearches({});
    setShowProductModal({});
    setCurrentProductLineIndex(null);
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
    
    const defaultForm = createDefaultFormData();
    const nextNumero = computeNextInvoiceNumberFromExisting();
    const resolvedForm = {
      ...defaultForm,
      numero: nextNumero || defaultForm.numero,
      // Activate FODEC automatically if enabled in settings
      fodec: currentTvaSettings?.fodec?.actif ? {
        enabled: true,
        tauxPct: currentTvaSettings.fodec.tauxPct || 1
      } : { enabled: false, tauxPct: 1 }
    };
    setFormData(resolvedForm);
    if (nextNumero) {
      setInvoiceNumberPreview(nextNumero);
      setInvoiceNumberLoading(false);
    } else {
      setInvoiceNumberPreview(null);
      setInvoiceNumberLoading(true);
      fetchInvoiceNumberPreview();
    }
    setShowModal(true);
  };

  // Handle alphabet filter click
  const handleAlphabetClick = (letter: string) => {
    setCustomerSearch(letter);
    setShowCustomerDropdown(true);
    setSelectedCustomerIndex(0);
  };

  // Filter products based on search (for a specific line)

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
    
    newLines[lineIndex].estStocke = product.estStocke !== false;
    setLines(newLines);
    
    // Fetch stock for the selected product only if it's an article (estStocke !== false) and NOT from BL
    if (!isFromBL && product.estStocke !== false) {
      fetchProductStock(product._id);
    } else {
      setProductStocks(prev => {
        if (!prev[product._id]) return prev;
        const updated = { ...prev };
        delete updated[product._id];
        return updated;
      });
    }
    
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
    if (editingInvoiceId && products.length > 0 && lines.length > 0 && !loadingData) {
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
  }, [products, editingInvoiceId, loadingData]);

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
      totalLine: 0,
      estStocke: true
    }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
    const newSearches = { ...productSearches };
    delete newSearches[index];
    setProductSearches(newSearches);
    const newModals = { ...showProductModal };
    delete newModals[index];
    setShowProductModal(newModals);
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // Auto-calculate line total if product selected
    if (field === 'productId' && value) {
      const product = products.find(p => p._id === value);
      if (product) {
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

  const filtered = invoices.filter(invoice =>
    invoice.numero.toLowerCase().includes(q.toLowerCase()) ||
    (invoice.customerName && invoice.customerName.toLowerCase().includes(q.toLowerCase()))
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
    const remiseFromLines = totalHTBeforeDiscount - totalHTAfterLineDiscount;
    const remiseGlobale = totalHTAfterLineDiscount - totalHT;
    const totalRemise = remiseFromLines + remiseGlobale;
    
    // Calculate FODEC on Total HT AFTER discount (totalHT is already after all discounts)
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
      totalHTBeforeDiscount: totalHTBeforeDiscount,
      totalHT, 
      totalHTAfterLineDiscount,
      totalRemise, 
      remiseLignes: remiseFromLines, // Added remiseLignes
      remiseGlobale, 
      fodec,
      totalTVA, 
      timbreAmount, 
      totalTTC 
    };
  };

  const totals = calculateTotals();

  // Fetch source documents for conversion
  const fetchSourceDocuments = async (sourceType: 'BL' | 'DEVIS') => {
    try {
      if (!tenantId) return;
      setLoadingSourceDocs(true);
      const response = await fetch(`/api/sales/${sourceType === 'BL' ? 'deliveries' : 'quotes'}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        const documents = data.items || [];
        
        // If sourceType is BL, filter out BLs that have already been converted to invoices
        let availableDocuments = documents;
        if (sourceType === 'BL') {
          try {
            // Fetch all invoices that have linkedDocuments (converted from BL)
            const invoicesResponse = await fetch('/api/sales/invoices', {
              headers: { 'X-Tenant-Id': tenantId }
            });
            if (invoicesResponse.ok) {
              const invoicesData = await invoicesResponse.json();
              const invoices = invoicesData.items || [];
              
              // Extract BL IDs that have been converted (from linkedDocuments)
              const convertedBLIds = new Set<string>();
              invoices.forEach((invoice: any) => {
                if (invoice.linkedDocuments && Array.isArray(invoice.linkedDocuments)) {
                  invoice.linkedDocuments.forEach((linkedId: string) => {
                    convertedBLIds.add(linkedId.toString());
                  });
                }
              });
              
              // Filter out BLs that have been converted
              availableDocuments = documents.filter((doc: any) => {
                const docId = doc._id?.toString();
                return !convertedBLIds.has(docId);
              });
            }
          } catch (err) {
            console.error('Error checking converted BLs:', err);
            // Continue with all documents if check fails
          }
        }
        
        // Fetch customer names for each document
        const documentsWithCustomers = await Promise.all(
          availableDocuments.map(async (doc: any) => {
            if (doc.customerId) {
              try {
                const customerResponse = await fetch(`/api/customers/${doc.customerId}`, {
                  headers: { 'X-Tenant-Id': tenantId }
                });
                if (customerResponse.ok) {
                  const customer = await customerResponse.json();
                  return {
                    ...doc,
                    customerName: customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim()
                  };
                }
              } catch (err) {
                console.error('Error fetching customer:', err);
              }
            }
            return doc;
          })
        );
        
        setSourceDocuments(documentsWithCustomers);
      }
    } catch (err) {
      console.error('Error fetching source documents:', err);
      toast.error('Erreur lors du chargement des documents');
    } finally {
      setLoadingSourceDocs(false);
    }
  };

  // Handle convert modal
  const handleOpenConvertModal = (sourceType: 'BL' | 'DEVIS') => {
    setConvertSourceType(sourceType);
    setShowConvertModal(true);
    fetchSourceDocuments(sourceType);
  };

  // Handle convert from BL or DEVIS
  const handleConvert = async (sourceId: string) => {
    try {
      if (!tenantId || !convertSourceType) return;
      
      const response = await fetch('/api/sales/invoices/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify({
          sourceId,
          sourceType: convertSourceType,
          dateDoc: new Date().toISOString().split('T')[0],
        })
      });

      if (response.ok) {
        const invoice = await response.json();
        toast.success('Facture créée avec succès. Vous pouvez maintenant la modifier.');
        
        // Close convert modal
        setShowConvertModal(false);
        setConvertSourceType(null);
        setSourceDocuments([]);
        setConvertSearchQuery('');
        
        // Ensure products and customers are loaded before opening edit modal
        if (products.length === 0 || customers.length === 0) {
          await Promise.all([
            products.length === 0 ? fetchProducts() : Promise.resolve(),
            customers.length === 0 ? fetchCustomers() : Promise.resolve()
          ]);
        }
        
        // Fetch the created invoice to populate the edit form
        const invoiceResponse = await fetch(`/api/sales/invoices/${invoice._id}`, {
          headers: { 'X-Tenant-Id': tenantId }
        });
        
        if (invoiceResponse.ok) {
          const fullInvoice = await invoiceResponse.json();
          
          // Check if invoice is created from BL by checking linkedDocuments
          const hasBL = fullInvoice.linkedDocuments && fullInvoice.linkedDocuments.length > 0;
          setIsFromBL(hasBL || false);
          
          // Populate form with invoice data
          setFormData({
            customerId: fullInvoice.customerId || '',
            dateDoc: fullInvoice.dateDoc?.split('T')[0] || new Date().toISOString().split('T')[0],
            referenceExterne: fullInvoice.referenceExterne || '',
            devise: fullInvoice.devise || 'TND',
            tauxChange: fullInvoice.tauxChange || 1,
            modePaiement: fullInvoice.modePaiement || '',
            dateEcheance: fullInvoice.dateEcheance?.split('T')[0] || '',
            conditionsPaiement: fullInvoice.conditionsPaiement || '',
            notes: fullInvoice.notes || '',
            numero: fullInvoice.numero || '',
            timbreActif: (fullInvoice.timbreFiscal || 0) > 0,
            remiseGlobalePct: fullInvoice.remiseGlobalePct || 0,
            fodec: fullInvoice.fodec ? {
              enabled: fullInvoice.fodec.enabled || false,
              tauxPct: fullInvoice.fodec.tauxPct || 1
            } : { enabled: false, tauxPct: 1 }
          });
          setInvoiceNumberPreview(fullInvoice.numero || null);
          setInvoiceNumberLoading(false);
          
          // Set customer search based on selected customer
          if (fullInvoice.customerId) {
            const selectedCustomer = customers.find(c => c._id === fullInvoice.customerId);
            if (selectedCustomer) {
              setCustomerSearch(selectedCustomer.raisonSociale || `${selectedCustomer.nom || ''} ${selectedCustomer.prenom || ''}`.trim());
            }
          } else {
            setCustomerSearch('');
          }
          
          // Populate lines
          if (fullInvoice.lignes && fullInvoice.lignes.length > 0) {
            const mappedLines = fullInvoice.lignes.map((line: any) => ({
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
              totalLine: 0,
              estStocke: line.estStocke !== false
            }));
            setLines(mappedLines);
            
            // Fetch stock for all products in lines only if NOT from BL
            if (!hasBL) {
              mappedLines.forEach((line: any) => {
                if (line.productId && line.estStocke !== false) {
                  fetchProductStock(line.productId);
                }
              });
            }
            
            // Populate product searches immediately using designation from API
            const searches: { [key: number]: string } = {};
            mappedLines.forEach((line: any, idx: number) => {
              if (line.designation) {
                searches[idx] = line.designation;
              }
            });
            setProductSearches(searches);
          }
          
          // Set editing state and open modal
          setEditingInvoiceId(fullInvoice._id);
          setShowModal(true);
        }
        
        // Refresh invoices list
        fetchInvoices(0);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la conversion');
      }
    } catch (err) {
      console.error('Error converting document:', err);
      toast.error('Erreur lors de la conversion');
    }
  };

  // Save invoice
  const [saving, setSaving] = useState(false);

  const handleCreateInvoice = async () => {
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

      const url = editingInvoiceId 
        ? `/api/sales/invoices/${editingInvoiceId}` 
        : '/api/sales/invoices';
      
      const method = editingInvoiceId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId 
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          dateDoc: formData.dateDoc,
          dateEcheance: formData.dateEcheance || undefined,
          referenceExterne: formData.referenceExterne,
          devise: formData.devise,
          tauxChange: formData.tauxChange || 1,
          modePaiement: formData.modePaiement || undefined,
          conditionsPaiement: formData.conditionsPaiement || undefined,
          notes: formData.notes,
          numero: formData.numero?.trim() || undefined,
          lignes: lignesData,
          timbreFiscal: totals.timbreAmount || 0,
          remiseGlobalePct: formData.remiseGlobalePct || 0,
          fodec: formData.fodec?.enabled ? {
            enabled: true,
            tauxPct: formData.fodec.tauxPct || 1,
            montant: totals.fodec || 0
          } : { enabled: false, tauxPct: 1, montant: 0 }
        })
      });

      if (response.ok) {
        toast.success(editingInvoiceId ? 'Facture modifiée avec succès' : 'Facture créée avec succès');
        setShowModal(false);
        setLines([]);
        setEditingInvoiceId(null);
        setFormData(createDefaultFormData());
        setInvoiceNumberPreview(null);
        setCustomerSearch('');
        setShowCustomerDropdown(false);
        setSelectedCustomerIndex(-1);
        setProductSearches({});
        setShowProductModal({});
        setCurrentProductLineIndex(null);
        fetchInvoices(0);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur');
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Handle view invoice
  const handleView = async (invoice: Invoice) => {
    try {
      // Fetch full invoice details
      const response = await fetch(`/api/sales/invoices/${invoice._id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`Facture ${invoice.numero} chargée avec succès`);
        router.push(`/sales/invoices/${invoice._id}`);
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

  // Handle edit invoice
  const handleEdit = async (invoice: Invoice) => {
    // Fetch full invoice details
    try {
      const response = await fetch(`/api/sales/invoices/${invoice._id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (response.ok) {
        const fullInvoice = await response.json();
        
        // Check if invoice is created from BL by checking linkedDocuments
        const hasBL = fullInvoice.linkedDocuments && fullInvoice.linkedDocuments.length > 0;
        setIsFromBL(hasBL || false);
        
        // Populate form with invoice data
        setFormData({
            customerId: fullInvoice.customerId || '',
            dateDoc: fullInvoice.dateDoc?.split('T')[0] || new Date().toISOString().split('T')[0],
            referenceExterne: fullInvoice.referenceExterne || '',
            devise: fullInvoice.devise || 'TND',
            tauxChange: fullInvoice.tauxChange || 1,
            modePaiement: fullInvoice.modePaiement || '',
            dateEcheance: fullInvoice.dateEcheance?.split('T')[0] || '',
            conditionsPaiement: fullInvoice.conditionsPaiement || '',
            notes: fullInvoice.notes || '',
            numero: fullInvoice.numero || '',
            timbreActif: (fullInvoice.timbreFiscal || 0) > 0,
            remiseGlobalePct: 0, // Will be calculated from existing remise if needed
            fodec: fullInvoice.fodec ? {
              enabled: fullInvoice.fodec.enabled || false,
              tauxPct: fullInvoice.fodec.tauxPct || 1
            } : { enabled: false, tauxPct: 1 }
          });
        setInvoiceNumberPreview(fullInvoice.numero || null);
        setInvoiceNumberLoading(false);
        
        // Set customer search based on selected customer
        if (fullInvoice.customerId) {
          const selectedCustomer = customers.find(c => c._id === fullInvoice.customerId);
          if (selectedCustomer) {
            setCustomerSearch(selectedCustomer.raisonSociale || `${selectedCustomer.nom || ''} ${selectedCustomer.prenom || ''}`.trim());
          }
        } else {
          setCustomerSearch('');
        }
        
        // Populate lines
        if (fullInvoice.lignes && fullInvoice.lignes.length > 0) {
          const mappedLines = fullInvoice.lignes.map((line: any) => ({
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
            totalLine: 0,
            estStocke: line.estStocke !== false
          }));
          setLines(mappedLines);
          
          // Fetch stock for all products in lines only if NOT from BL
          if (!hasBL) {
            mappedLines.forEach((line: any) => {
              if (line.productId && line.estStocke !== false) {
                fetchProductStock(line.productId);
              }
            });
          }
          
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
        setEditingInvoiceId(fullInvoice._id);
        
        // Open modal
        setShowModal(true);
      } else {
        toast.error('Erreur lors du chargement de la facture');
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      toast.error('Erreur lors du chargement de la facture');
    }
  };

  // Handle download PDF
  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const response = await fetch(`/api/sales/invoices/${invoice._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        // Check if response is JSON (error) or PDF
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erreur lors de la génération du PDF');
        }
        throw new Error('Erreur lors de la génération du PDF');
      }

      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/pdf')) {
        const errorData = await response.json().catch(() => ({ error: 'Réponse invalide du serveur' }));
        throw new Error(errorData.error || 'Le serveur n\'a pas retourné un PDF valide');
      }

      const blob = await response.blob();
      
      // Verify blob is not empty and is a PDF
      if (blob.size === 0) {
        throw new Error('Le fichier PDF est vide');
      }
      
      // Check if blob type is PDF
      if (!blob.type.includes('pdf') && blob.size > 0) {
        // Try to read as text to see if it's an error message
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.error || 'Erreur lors de la génération du PDF');
        } catch {
          throw new Error('Le serveur n\'a pas retourné un PDF valide');
        }
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture-${invoice.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay to ensure download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      toast.success('PDF téléchargé avec succès');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error(error.message || 'Erreur lors du téléchargement du PDF');
    }
  };

  // Handle delete invoice
  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      return;
    }

    try {
      if (!tenantId) return;
      
      const response = await fetch(`/api/sales/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId }
      });

      if (response.ok) {
        toast.success('Facture supprimée avec succès');
        fetchInvoices(0);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression de la facture');
      }
    } catch (err) {
      console.error('Error deleting invoice:', err);
      toast.error('Erreur lors de la suppression de la facture');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8" /> <span className="whitespace-nowrap">Factures clients</span>
          </h1>
          <div className="flex gap-2 flex-wrap">
            <button 
              onClick={() => handleOpenConvertModal('DEVIS')}
              className="flex items-center gap-2 border border-blue-600 text-blue-600 px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-50 text-sm sm:text-base"
            >
              <span>Depuis Devis</span>
            </button>
            <button 
              onClick={() => handleOpenConvertModal('BL')}
              className="flex items-center gap-2 border border-green-600 text-green-600 px-3 sm:px-4 py-2 rounded-lg hover:bg-green-50 text-sm sm:text-base"
            >
              <span>Depuis BL</span>
            </button>
            <button 
              onClick={handleOpenNewInvoiceModal} 
              className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <PlusIcon className="w-5 h-5" /> <span>Nouvelle facture</span>
            </button>
          </div>
        </div>

        {/* Pending Invoices Alert Banner */}
        {pendingSummary && pendingSummary.totalCount > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Vous avez {pendingSummary.totalCount} facture(s) en attente de paiement
                  </h3>
                  <p className="text-sm text-gray-700 mt-1">
                    Montant total impayé: <span className="font-bold text-orange-600">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'TND',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 3,
                      }).format(pendingSummary.totalPendingAmount)}
                    </span>
                  </p>
                </div>
              </div>
              <Link
                href="/pending-invoices"
                className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                Voir les factures en attente
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {findMissingInvoiceNumbers.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg space-y-2">
            <div className="font-semibold">Factures manquantes détectées</div>
            <p className="text-sm">
              Les numéros suivants semblent absents de la séquence :
            </p>
            <div className="flex flex-wrap gap-2 text-sm font-mono">
              {findMissingInvoiceNumbers.map((numero) => (
                <span
                  key={numero}
                  className="px-2 py-1 bg-white border border-red-200 rounded"
                >
                  {numero}
                </span>
              ))}
            </div>
            <p className="text-xs text-red-700">
              Vérifiez vos factures pour combler ces numéros ou ajustez la numérotation manuellement.
            </p>
          </div>
        )}

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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune facture trouvée</h3>
            <p className="text-gray-600 mb-6">Créez votre première facture en quelques clics</p>
            <button 
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 mx-auto"
            >
              <PlusIcon className="w-5 h-5" /> Nouvelle facture
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
                {filtered.map((invoice) => (
                  <tr key={invoice._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{invoice.numero}</td>
                    <td className="px-3 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(invoice.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600">
                      {invoice.customerName || '-'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap">
                      {invoice.totalBaseHT?.toFixed(3)} {invoice.devise || 'TND'}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap">
                      {invoice.totalTVA?.toFixed(3)} {invoice.devise || 'TND'}
                    </td>
                    <td className="px-3 py-4 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                      {invoice.totalTTC?.toFixed(3)} {invoice.devise || 'TND'}
                    </td>
                    <td className="px-2 py-4">
                      <div className="flex gap-0.5">
                        <button 
                          onClick={() => {
                            handleView(invoice);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Voir"
                        >
                          <EyeIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => {
                            handleEdit(invoice);
                          }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDownloadPDF(invoice)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Télécharger PDF"
                        >
                          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(invoice._id)}
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
              {filtered.map((invoice) => (
                <div key={invoice._id} className="bg-white border rounded-xl shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{invoice.numero}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(invoice.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleView(invoice)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Voir"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(invoice)}
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
                      <span className="font-medium text-gray-900">{invoice.customerName || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total HT:</span>
                      <span className="font-medium text-gray-900">{invoice.totalBaseHT?.toFixed(3)} {invoice.devise || 'TND'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">TVA:</span>
                      <span className="font-medium text-gray-900">{invoice.totalTVA?.toFixed(3)} {invoice.devise || 'TND'}</span>
                    </div>
                    <div className="flex justify-between text-base pt-2 border-t">
                      <span className="font-semibold text-gray-900">Total TTC:</span>
                      <span className="font-bold text-blue-600">{invoice.totalTTC?.toFixed(3)} {invoice.devise || 'TND'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => handleDownloadPDF(invoice)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      PDF
                    </button>
                    <button 
                      onClick={() => handleDelete(invoice._id)}
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
                    {editingInvoiceId ? '✏️ Modifier facture' : '🧾 Nouvelle facture'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {editingInvoiceId ? 'Modifiez votre facture' : 'Créez une facture élégante et précise en quelques clics'}
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
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de facture
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={formData.numero || ''}
                          onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                          placeholder={
                            invoiceNumberLoading
                              ? 'Chargement...'
                              : invoiceNumberPreview || 'Saisissez un numéro'
                          }
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        {invoiceNumberLoading && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                            ...
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyInvoiceNumber}
                        className="px-4 py-2 border rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-200 disabled:bg-gray-50"
                        disabled={!formData.numero?.trim() && !invoiceNumberPreview}
                      >
                        Copier
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {editingInvoiceId
                        ? 'Vous pouvez ajuster le numéro de cette facture avant de sauvegarder.'
                        : 'Le numéro proposé est généré automatiquement mais reste modifiable avant création.'}
                    </p>
                  </div>
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
                  {formData.devise !== 'TND' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Taux de change (1 {formData.devise} = ? TND)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={formData.tauxChange}
                        onChange={(e) => setFormData({ ...formData, tauxChange: parseFloat(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: 3.25"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Taux de change utilisé pour convertir les montants en TND dans les rapports
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date échéance
                    </label>
                    <input 
                      type="date"
                      value={formData.dateEcheance}
                      onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Conditions de paiement
                    </label>
                    <input 
                      type="text"
                      value={formData.conditionsPaiement}
                      onChange={(e) => setFormData({ ...formData, conditionsPaiement: e.target.value })}
                      placeholder="Ex: 30 jours net"
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
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Remise %</th>
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
                                      !isFromBL && line.estStocke !== false && line.productId && productStocks[line.productId] !== undefined && 
                                      (line.quantite || 0) > productStocks[line.productId]
                                        ? 'border-red-500' : ''
                                    }`}
                                    placeholder="0"
                                  />
                                  {!isFromBL && line.estStocke !== false && line.productId && productStocks[line.productId] !== undefined && 
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
                        <span className="font-medium">{totals.totalHTBeforeDiscount.toFixed(3)} {formData.devise}</span>
                      </div>
                      {totals.remiseLignes > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Remise lignes</span>
                          <span className="font-medium text-red-600">-{totals.remiseLignes.toFixed(3)} {formData.devise}</span>
                        </div>
                      )}
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
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-700">Total HT</span>
                        <span className="font-bold text-gray-900">{totals.totalHT.toFixed(3)} {formData.devise}</span>
                      </div>
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
                              value={formData.fodec.tauxPct || 1}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                fodec: { 
                                  ...formData.fodec, 
                                  tauxPct: parseFloat(e.target.value) || 1 
                                } 
                              })}
                              min="0"
                              max="100"
                              step="0.1"
                              className="w-16 px-2 py-1 border rounded text-sm"
                            />
                            <span className="text-gray-600">%</span>
                            <span className="font-medium ml-2">{totals.fodec.toFixed(3)} {formData.devise}</span>
                          </div>
                        )}
                      </div>
                      {formData.fodec?.enabled && totals.fodec > 0 && (
                        <div className="flex justify-between text-sm ml-7">
                          <span className="text-gray-600">FODEC ({formData.fodec.tauxPct}%)</span>
                          <span className="font-medium">{totals.fodec.toFixed(3)} {formData.devise}</span>
                        </div>
                      )}
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
                  onClick={saving ? undefined : handleCreateInvoice}
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
                      ? (editingInvoiceId ? 'Enregistrement...' : 'Création en cours...')
                      : (editingInvoiceId ? 'Modifier' : 'Créer')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Convert Modal */}
        {showConvertModal && convertSourceType && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Convertir depuis {convertSourceType === 'BL' ? 'Bon de livraison' : 'Devis'}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Sélectionnez un {convertSourceType === 'BL' ? 'bon de livraison' : 'devis'} à convertir en facture
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowConvertModal(false);
                    setConvertSourceType(null);
                    setSourceDocuments([]);
                    setConvertSearchQuery('');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              {/* Search Bar */}
              <div className="px-6 pt-4 pb-2 border-b">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder={`Rechercher par numéro ou nom du client...`}
                    value={convertSearchQuery}
                    onChange={(e) => setConvertSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {loadingSourceDocs ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Chargement...</p>
                  </div>
                ) : (() => {
                  // Filter documents based on search query
                  const filteredDocs = sourceDocuments.filter((doc: any) => {
                    if (!convertSearchQuery.trim()) return true;
                    const query = convertSearchQuery.toLowerCase();
                    const numeroMatch = doc.numero?.toLowerCase().includes(query);
                    const customerMatch = doc.customerName?.toLowerCase().includes(query);
                    return numeroMatch || customerMatch;
                  });

                  if (filteredDocs.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-500">
                        {convertSearchQuery ? (
                          <>
                            Aucun {convertSourceType === 'BL' ? 'bon de livraison' : 'devis'} trouvé pour "{convertSearchQuery}"
                          </>
                        ) : (
                          <>
                            Aucun {convertSourceType === 'BL' ? 'bon de livraison' : 'devis'} trouvé
                          </>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filteredDocs.map((doc: any) => (
                        <div
                          key={doc._id}
                          className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleConvert(doc._id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-gray-900">{doc.numero}</h3>
                              <p className="text-sm text-gray-600">
                                Date: {new Date(doc.dateDoc).toLocaleDateString('fr-FR')}
                              </p>
                              {doc.customerName && (
                                <p className="text-sm text-gray-600">Client: {doc.customerName}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {doc.totalTTC?.toFixed(3) || '0.000'} {doc.devise || 'TND'}
                              </p>
                              <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                                Convertir
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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