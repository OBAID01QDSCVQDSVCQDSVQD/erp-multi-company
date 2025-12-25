'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  PlusIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  PencilIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  XMarkIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChatBubbleLeftEllipsisIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ProductSearchModal from '@/components/common/ProductSearchModal';

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
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [quoteToPrint, setQuoteToPrint] = useState<Quote | null>(null);
  const [includeStamp, setIncludeStamp] = useState(true);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [taxRates, setTaxRates] = useState<Array<{ code: string; tauxPct: number }>>([]);
  const [tvaSettings, setTvaSettings] = useState<any>(null);
  const [modesReglement, setModesReglement] = useState<string[]>([]);
  const [previewNumber, setPreviewNumber] = useState<string>('');

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [selectedQuoteForWhatsApp, setSelectedQuoteForWhatsApp] = useState<Quote | null>(null);

  // Autocomplete state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

  // Product autocomplete state per line (modal-based)
  const [productSearches, setProductSearches] = useState<{ [key: number]: string }>({});
  const [showProductModal, setShowProductModal] = useState<{ [key: number]: boolean }>({});
  const [currentProductLineIndex, setCurrentProductLineIndex] = useState<number | null>(null);

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
    modePaiement: 'Chèque',
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // No dropdown scroll/position needed with modal

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
  // Modal product selection

  // Handle product selection for a specific line
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
        // Map quotes and extract customer name if available
        const quotesWithCustomers = quotes.map((quote: any) => {
          let customerName = quote.customerName || '';

          // If customerId is populated as an object, extract name from it
          if (quote.customerId && typeof quote.customerId === 'object') {
            const c = quote.customerId;
            customerName = c.raisonSociale || `${c.nom || ''} ${c.prenom || ''}`.trim();
          }

          return {
            ...quote,
            customerId: typeof quote.customerId === 'object' ? quote.customerId._id : quote.customerId, // Keep ID as string for interface consistency
            customerName: customerName || '-'
          };
        });

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
        setShowProductModal({});
        setCurrentProductLineIndex(null);
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

    const resolvedForm = {
      customerId: '',
      dateDoc: new Date().toISOString().split('T')[0],
      referenceExterne: '',
      devise: 'TND',
      modePaiement: 'Chèque',
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

    // Fetch preview number
    try {
      const response = await fetch('/api/settings/numbering/preview?type=devis', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setPreviewNumber(data.preview);
      }
    } catch (err) {
      console.error('Error fetching preview number:', err);
    }

    setShowModal(true);
  };

  // Handle download PDF
  const handleDownloadPDF = (quote: Quote) => {
    setQuoteToPrint(quote);
    setIncludeStamp(true); // Default to true
    setShowPrintModal(true);
  };

  const confirmDownloadPDF = async () => {
    if (!quoteToPrint) return;

    // Close modal immediately
    setShowPrintModal(false);

    try {
      if (!tenantId) return;

      toast.loading('Génération du PDF...', { id: 'pdf-toast' });

      const response = await fetch(`/api/sales/quotes/${quoteToPrint._id}/pdf?withStamp=${includeStamp}`, {
        headers: {
          'X-Tenant-Id': tenantId
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Devis-${quoteToPrint.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      toast.success('PDF téléchargé avec succès', { id: 'pdf-toast' });
      setQuoteToPrint(null);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error(error.message || 'Erreur lors du téléchargement du PDF', { id: 'pdf-toast' });
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

  // WhatsApp Logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (clientSearchQuery.trim()) {
        setSearchingClients(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(clientSearchQuery)}&type=client`, {
            headers: { 'X-Tenant-Id': tenantId || '' }
          });
          if (res.ok) {
            const data = await res.json();
            setClientSearchResults(data.results || []);
          }
        } catch (error) {
          console.error("Error searching clients", error);
        } finally {
          setSearchingClients(false);
        }
      } else {
        setClientSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearchQuery, tenantId]);

  const handleOpenWhatsAppModal = async (quote: Quote) => {
    setSelectedQuoteForWhatsApp(quote);
    setWhatsAppNumber('');

    if (quote.customerId && tenantId) {
      try {
        const custId = typeof quote.customerId === 'object' ? (quote.customerId as any)._id : quote.customerId;
        const res = await fetch(`/api/customers/${custId}`, {
          headers: { 'X-Tenant-Id': tenantId }
        });
        if (res.ok) {
          const customer = await res.json();
          const phone = customer.mobile || customer.telephone || '';
          let clean = phone.replace(/\D/g, '');
          if (clean.length === 8) clean = '216' + clean;
          setWhatsAppNumber(clean);
        }
      } catch (e) {
        console.error("Error fetching customer for whatsapp", e);
      }
    }

    setClientSearchQuery('');
    setClientSearchResults([]);
    setShowWhatsAppModal(true);
  };

  const confirmWhatsAppSend = async () => {
    if (!selectedQuoteForWhatsApp || !whatsAppNumber) return;

    let numberToSend = whatsAppNumber.replace(/\D/g, '');
    if (numberToSend.length === 8) numberToSend = '216' + numberToSend;

    // Generate public link
    let publicLink = '';
    const quote = selectedQuoteForWhatsApp;

    const toastId = toast.loading('Génération du lien...');

    try {
      const res = await fetch(`/api/sales/quotes/${quote._id}/share`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        publicLink = `${window.location.origin}/i/${data.token}`;
      }
    } catch (e) {
      console.error("Error generating public link", e);
      toast.error("Erreur génération lien", { id: toastId });
    }

    const customerName = quote.customerName || 'Cher Client';
    const companyName = tvaSettings?.societe?.nom || 'notre société';

    let message = `Bonjour ${customerName}, de la part de ${companyName} : Voici votre devis ${quote.numero} du ${new Date(quote.dateDoc).toLocaleDateString('fr-FR')} pour un montant de ${quote.totalTTC.toFixed(3)} ${quote.devise || 'TND'}.`;

    if (publicLink) {
      message += `\n\n📄 Télécharger votre devis ici : ${publicLink}`;
    }

    const url = `https://api.whatsapp.com/send?phone=${numberToSend}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    toast.dismiss(toastId);
    setShowWhatsAppModal(false);
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
              title="Retour à la page précédente"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
              <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8" /> <span className="whitespace-nowrap">Devis</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button className="hidden sm:flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
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
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm sm:text-base bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-4">
            <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
              </div>
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile Skeleton */}
            <div className="lg:hidden space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-2xl border dark:border-gray-700">
            <DocumentTextIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun devis trouvé</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Créez votre premier devis en quelques clics</p>
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
            <div className="hidden lg:block bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Numéro</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Client</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200">Total TTC</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map((quote) => (
                    <tr key={quote._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{quote.numero}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {new Date(quote.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{quote.customerName || '-'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white text-right whitespace-nowrap">
                        {quote.totalTTC?.toFixed(3)} {quote.devise || 'TND'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => {
                              console.log('🔵 BUTTON CLICKED - Quote ID:', quote._id);
                              handleView(quote);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Voir"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              console.log('🟢 MODIFY BUTTON CLICKED - Quote:', quote);
                              handleEdit(quote);
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(quote)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                            title="Télécharger PDF"
                          >
                            <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              handleOpenWhatsAppModal(quote);
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="WhatsApp"
                          >
                            <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(quote._id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
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

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              {filtered.map((quote) => (
                <div key={quote._id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{quote.numero}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {new Date(quote.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">
                        {quote.customerName || '-'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleView(quote)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Voir"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(quote)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="border-t dark:border-gray-700 pt-3 flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Total TTC</span>
                    <span className="font-bold text-gray-900 dark:text-white">{quote.totalTTC?.toFixed(3)} {quote.devise || 'TND'}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleDownloadPDF(quote)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      PDF
                    </button>
                    <button
                      onClick={() => handleOpenWhatsAppModal(quote)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-400"
                    >
                      <ChatBubbleLeftEllipsisIcon className="w-4 h-4" /> WhatsApp
                    </button>
                    <button
                      onClick={() => handleDelete(quote._id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
              <div className="p-4 sm:p-6 border-b dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {editingQuoteId ? '✏️ Modifier devis' : `🧾 Nouveau devis ${previewNumber ? previewNumber : ''}`}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Client *
                    </label>
                    {loadingData ? (
                      <div className="w-full px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 animate-pulse text-gray-500 dark:text-gray-400">
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
                            className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                          />
                        </div>

                        {/* Dropdown */}
                        {showCustomerDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[280px] overflow-hidden">
                            {/* Alphabet filter bar */}
                            <div className="flex items-center justify-center gap-1 px-2 py-2 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 text-xs">
                              {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
                                <button
                                  key={letter}
                                  onClick={() => handleAlphabetClick(letter)}
                                  className="px-1.5 py-0.5 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors font-semibold dark:text-gray-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-400"
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
                                      className={`px-4 py-3 cursor-pointer transition-colors ${index === selectedCustomerIndex
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                    >
                                      <div className="font-medium text-gray-900 dark:text-white">{displayName}</div>
                                      {secondaryInfo && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{secondaryInfo}</div>
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.dateDoc}
                      onChange={(e) => setFormData({ ...formData, dateDoc: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Référence externe
                    </label>
                    <input
                      type="text"
                      value={formData.referenceExterne}
                      onChange={(e) => setFormData({ ...formData, referenceExterne: e.target.value })}
                      placeholder="Ex: BC-2025-001"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Devise
                    </label>
                    <select
                      value={formData.devise}
                      onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Lignes</h3>
                    <button
                      onClick={addLine}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      + Ajouter une ligne
                    </button>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                    {lines.length === 0 ? (
                      <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                        Aucune ligne ajoutée
                      </div>
                    ) : (
                      <>
                        {/* Mobile View (Cards) */}
                        <div className="space-y-4 md:hidden p-1">
                          {lines.map((line, index) => (
                            <div key={index} className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
                              {/* Product/Designation */}
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Produit / Désignation</label>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="relative inline-block w-full">
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
                                        placeholder="Rechercher..."
                                        className="w-full px-3 py-2 pr-8 border dark:border-gray-600 rounded text-sm cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                        readOnly
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
                                        className="p-2 text-gray-400 hover:text-red-600"
                                      >
                                        <XMarkIcon className="w-5 h-5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Quantité & Unité */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantité</label>
                                  <input
                                    type="number"
                                    value={line.quantite || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedLines = [...lines];
                                      updatedLines[index] = { ...updatedLines[index], quantite: parseFloat(val) || 0 };
                                      setLines(updatedLines);
                                    }}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="0"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unité</label>
                                  <input
                                    type="text"
                                    value={line.uomCode || ''}
                                    readOnly
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded text-sm bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                                  />
                                </div>
                              </div>

                              {/* Prix & TVA */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Prix HT</label>
                                  <input
                                    type="number"
                                    value={line.prixUnitaireHT || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updatedLines = [...lines];
                                      updatedLines[index] = { ...updatedLines[index], prixUnitaireHT: parseFloat(val) || 0 };
                                      setLines(updatedLines);
                                    }}
                                    className="w-full px-3 py-2 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    placeholder="0.000"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">TVA %</label>
                                  <div className="flex flex-col">
                                    <input
                                      type="number"
                                      value={line.tvaPct ?? ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updatedLines = [...lines];
                                        updatedLines[index] = { ...updatedLines[index], tvaPct: parseFloat(val) || 0 };
                                        setLines(updatedLines);
                                      }}
                                      className="w-full px-3 py-2 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      placeholder="0%"
                                    />
                                    {line.taxCode && <span className="text-xs text-gray-500 mt-1">{line.taxCode}</span>}
                                  </div>
                                </div>
                              </div>

                              {/* Remise */}
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Remise %</label>
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
                                  className="w-full px-3 py-2 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="0"
                                />
                              </div>

                              {/* Totals Summary */}
                              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Total HT:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{(((line.quantite || 0) * (line.prixUnitaireHT || 0)) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {formData.devise}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600 dark:text-gray-400">Total TVA:</span>
                                  <span className="font-medium text-gray-900 dark:text-white">{((((line.quantite || 0) * (line.prixUnitaireHT || 0)) * (1 - ((line.remisePct || 0) / 100))) * ((line.tvaPct || 0) / 100)).toFixed(3)} {formData.devise}</span>
                                </div>
                                <div className="flex justify-between border-t dark:border-gray-700 pt-1 mt-1">
                                  <span className="font-bold text-gray-900 dark:text-white">Total TTC:</span>
                                  <span className="font-bold text-blue-600 dark:text-blue-400">{(((line.quantite || 0) * (line.prixUnitaireHT || 0) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {formData.devise}</span>
                                </div>
                              </div>

                              <button
                                onClick={() => removeLine(index)}
                                className="w-full py-2 flex items-center justify-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors text-sm font-medium"
                              >
                                <TrashIcon className="w-4 h-4" />
                                Supprimer la ligne
                              </button>
                              <button
                                onClick={addLine}
                                className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors text-sm font-medium"
                              >
                                <PlusIcon className="w-4 h-4" />
                                Ajouter une ligne
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Desktop View (Table) */}
                        <div className="hidden md:block min-w-full">
                          <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Produit</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Qté</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Unité</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Prix HT</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">TVA %</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Total HT</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Remise %</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Total TVA</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200">Total TTC</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                              {lines.map((line, index) => (
                                <tr key={index}>
                                  <td className="px-2 sm:px-4 py-3" style={{ width: 'auto', maxWidth: 'none' }}>
                                    <div className="flex items-center gap-2">
                                      <div className="relative inline-block w-full">
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
                                          className="w-full px-3 py-2 pr-8 border dark:border-gray-600 rounded-lg text-sm cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
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
                                    <input
                                      type="text"
                                      value={line.quantite || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updatedLines = [...lines];
                                        updatedLines[index] = { ...updatedLines[index], quantite: parseFloat(val) || 0 };
                                        setLines(updatedLines);
                                      }}
                                      className="w-20 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={line.uomCode || ''}
                                      readOnly
                                      className="w-20 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
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
                                      className="w-24 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                                      className="w-20 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      placeholder="0%"
                                    />
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{line.taxCode || ''}</div>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white">
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
                                      className="w-20 px-2 py-1 border dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      placeholder="0"
                                    />
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">%</div>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white">
                                    {((((line.quantite || 0) * (line.prixUnitaireHT || 0)) * (1 - ((line.remisePct || 0) / 100))) * ((line.tvaPct || 0) / 100)).toFixed(3)} {formData.devise}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                    {(((line.quantite || 0) * (line.prixUnitaireHT || 0) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {formData.devise}
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => removeLine(index)}
                                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                      title="Supprimer"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Totals */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-600">
                  <div className="flex justify-end">
                    <div className="w-80 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Sous-total HT</span>
                        <span className="font-medium text-gray-900 dark:text-white">{totals.totalHTBeforeDiscount.toFixed(3)} {formData.devise}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Remise lignes</span>
                        {totals.remiseLignes > 0 ? (
                          <span className="font-medium text-red-600 dark:text-red-400">-{totals.remiseLignes.toFixed(3)} {formData.devise}</span>
                        ) : (
                          <span className="font-medium text-gray-400 dark:text-gray-500">0.000 {formData.devise}</span>
                        )}
                      </div>
                      {/* Remise globale input */}
                      <div className="flex justify-between text-sm items-center border-t dark:border-gray-600 pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">Remise globale</span>
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
                            className="w-20 px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                          <span className="text-gray-600 dark:text-gray-400">%</span>
                        </div>
                        {totals.remiseGlobale > 0 && (
                          <span className="font-medium text-red-600 dark:text-red-400">-{totals.remiseGlobale.toFixed(3)} {formData.devise}</span>
                        )}
                        {totals.remiseGlobale === 0 && (
                          <span className="font-medium text-gray-400 dark:text-gray-500">0.000 {formData.devise}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-700 dark:text-gray-300">Total HT</span>
                        <span className="font-bold text-gray-900 dark:text-white">{totals.totalHT.toFixed(3)} {formData.devise}</span>
                      </div>
                      {/* FODEC */}
                      <div className="flex justify-between text-sm items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">FODEC</span>
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
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
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
                              className="w-16 px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                              placeholder="1"
                            />
                            <span className="text-gray-600 dark:text-gray-400">%</span>
                            <span className="font-medium text-gray-900 dark:text-white ml-2">{totals.fodec.toFixed(3)} {formData.devise}</span>
                          </div>
                        )}
                        {!formData.fodec?.enabled && (
                          <span className="font-medium text-gray-400 dark:text-gray-500">0.000 {formData.devise}</span>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">TVA</span>
                        <span className="font-medium text-gray-900 dark:text-white">{totals.totalTVA.toFixed(3)} {formData.devise}</span>
                      </div>
                      {tvaSettings?.timbreFiscal?.actif && (
                        <div className="flex justify-between text-sm items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Timbre fiscal</span>
                            <input
                              type="checkbox"
                              checked={formData.timbreActif}
                              onChange={(e) => setFormData({ ...formData, timbreActif: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                            />
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{totals.timbreAmount.toFixed(3)} {formData.devise}</span>
                        </div>
                      )}
                      <div className="border-t dark:border-gray-600 pt-3 flex justify-between text-lg font-bold">
                        <span className="text-gray-900 dark:text-white">Total TTC</span>
                        <span className="text-blue-600 dark:text-blue-400">{totals.totalTTC.toFixed(3)} {formData.devise}</span>
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
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    >
                      <option value="">Sélectionner...</option>
                      {modesReglement.map((mode, index) => (
                        <option key={index} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Validité
                    </label>
                    <input
                      type="date"
                      value={formData.validite}
                      onChange={(e) => setFormData({ ...formData, validite: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notes additionnelles pour le client..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="p-4 sm:p-6 border-t flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm sm:text-base transition-colors"
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
      {/* Print Options Modal */}
      {showPrintModal && quoteToPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Options d'impression
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Voulez-vous inclure le cachet de l'entreprise sur le document ?
              </p>

              <div className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-6 bg-gray-50 dark:bg-gray-700/50 cursor-pointer" onClick={() => setIncludeStamp(!includeStamp)}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeStamp ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white dark:bg-gray-700'}`}>
                  {includeStamp && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={includeStamp}
                  onChange={(e) => setIncludeStamp(e.target.checked)}
                  className="hidden"
                />
                <label className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer select-none">
                  Inclure le cachet / signature
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDownloadPDF}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Télécharger PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowWhatsAppModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  <span className="sr-only">Fermer</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                  <ChatBubbleLeftEllipsisIcon className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                    Envoyer par WhatsApp
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Confirmez le numéro ou recherchez un autre client.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="wa-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Numéro de téléphone
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <PhoneIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      name="wa-number"
                      id="wa-number"
                      className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                      placeholder="216..."
                      value={whatsAppNumber}
                      onChange={(e) => setWhatsAppNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OU RECHERCHER UN CLIENT</span>
                  <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                </div>

                <div className="relative">
                  <label htmlFor="search-client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rechercher un autre client
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      id="search-client"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                      placeholder="Nom du client..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      autoComplete="off"
                    />
                    {searchingClients && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                  </div>

                  {clientSearchResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {clientSearchResults.map((client) => (
                        <li
                          key={client._id}
                          className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 dark:hover:bg-gray-600"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              const res = await fetch(`/api/customers/${client._id}`, { headers: { 'X-Tenant-Id': tenantId || '' } });
                              if (res.ok) {
                                const data = await res.json();
                                const phone = data.mobile || data.telephone || '';
                                let clean = phone.replace(/\D/g, '');
                                if (clean.length === 8) clean = '216' + clean;

                                if (clean) {
                                  setWhatsAppNumber(clean);
                                  setClientSearchQuery('');
                                  setClientSearchResults([]);
                                } else {
                                  toast.error(`Aucun numéro trouvé pour ${client.title}`);
                                }
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error("Erreur lors de la récupération du numéro");
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <span className="font-medium block truncate text-gray-900 dark:text-white">
                              {client.title}
                            </span>
                          </div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            {client.subtitle}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                  onClick={confirmWhatsAppSend}
                >
                  Envoyer
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}