'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckIcon,
    UserIcon,
    PlusIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    CubeIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import ProductSearchModal from '@/components/common/ProductSearchModal';
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';

interface WarrantyTemplate {
    _id: string;
    name: string;
    isActive: boolean;
    fields: any[];
    content?: string;
    exclusiveAdvantages?: string;
}


interface Customer {
    _id: string;
    raisonSociale?: string;
    nom?: string;
    prenom?: string;
    code?: string;
    matriculeFiscale?: string;
}

interface Product {
    _id: string;
    nom: string;
    description?: string;
    sku?: string;
    sellingPrice?: number;
    prixVenteHT?: number;
}

interface WarrantyItem {
    productId?: string;
    productName: string;
    serialNumber: string;
    warrantyPeriod: string;
}

export default function NewWarrantyPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Data
    const [templates, setTemplates] = useState<WarrantyTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<WarrantyTemplate | null>(null);

    const [customerSearch, setCustomerSearch] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]); // Store all customers
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [selectedCustomerIndex, setSelectedCustomerIndex] = useState(-1);

    // Products
    const [products, setProducts] = useState<Product[]>([]);
    const [activeProductDropdown, setActiveProductDropdown] = useState<number | null>(null);
    const [activeModalIndex, setActiveModalIndex] = useState<number | null>(null);

    const [items, setItems] = useState<WarrantyItem[]>([{ productName: '', serialNumber: '', warrantyPeriod: '12 mois' }]);

    const [formData, setFormData] = useState<Record<string, any>>({});
    const [warrantyContent, setWarrantyContent] = useState('');
    const [warrantyExclusiveAdvantages, setWarrantyExclusiveAdvantages] = useState('');

    useEffect(() => {
        if (session) {
            fetchTemplates();

            fetchCustomers();
            fetchProducts();
        }
    }, [session]);

    // Close product dropdown on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.product-autocomplete')) {
                setActiveProductDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

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

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/settings/warranty-templates', {
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.filter((t: any) => t.isActive));
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            toast.error('Erreur chargement modèles');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const res = await fetch('/api/customers', { // Fetch all customers
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });
            if (res.ok) {
                const data = await res.json();
                setCustomers(data.items || data || []);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/products', {
                headers: { 'X-Tenant-Id': (session?.user as any)?.companyId || '' }
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(data.items || data || []);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    // Filter customers
    const filteredCustomers = customers.filter((customer) => {
        const searchLower = customerSearch.toLowerCase().trim();
        if (!searchLower) return true;

        const name = (customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim()).toLowerCase();
        const code = (customer.code || '').toLowerCase();

        if (searchLower.length === 1) {
            return name.startsWith(searchLower) || code.startsWith(searchLower);
        }

        return name.includes(searchLower) || code.includes(searchLower);
    });

    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerSearch(getCustomerName(customer));
        setShowCustomerDropdown(false);
    };

    const handleSelectProduct = (index: number, product: Product) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            productId: product._id,
            productName: product.nom,
            warrantyPeriod: '12 mois' // Default or fetch from product if available?
        };
        setItems(newItems);
        setActiveProductDropdown(null);
    };

    const handleSelectProductFromModal = (product: any) => {
        if (activeModalIndex !== null) {
            handleSelectProduct(activeModalIndex, { ...product, nom: product.nom || product.name });
            setActiveModalIndex(null);
        }
    };

    const handleItemChange = (index: number, field: keyof WarrantyItem, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        if (field === 'productName') {
            newItems[index].productId = undefined; // Clear linked product if name is manually edited
        }
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { productName: '', serialNumber: '', warrantyPeriod: '12 mois' }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
        if (!showCustomerDropdown) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedCustomerIndex((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedCustomerIndex((prev) => (prev > 0 ? prev - 1 : -1));
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

    const handleAlphabetClick = (letter: string) => {
        setCustomerSearch(letter);
        setShowCustomerDropdown(true);
        setSelectedCustomerIndex(0);
    };

    const handleTemplateSelect = (template: WarrantyTemplate) => {
        setSelectedTemplate(template);
        setStep(2);
        // Initialize form data with defaults
        const initialData: any = {};
        template.fields.forEach(field => {
            if (field.defaultValue) initialData[field.id] = field.defaultValue;
        });
        setFormData(initialData);
        setWarrantyContent(template.content || '');
        setWarrantyExclusiveAdvantages(template.exclusiveAdvantages || '');
    };



    const getCustomerName = (c: Customer) => c.raisonSociale || `${c.prenom} ${c.nom}`;

    const updateFormData = (fieldId: string, value: any) => {
        setFormData({ ...formData, [fieldId]: value });
    };

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const editId = searchParams?.get('edit');
    const isEditMode = !!editId;

    useEffect(() => {
        if (session) {
            fetchTemplates();
            fetchCustomers();
            if (editId) {
                fetchWarrantyToEdit(editId);
            }
        }
    }, [session, editId]);

    const fetchWarrantyToEdit = async (id: string) => {
        try {
            const res = await fetch(`/api/documents/warranties/${id}`);
            if (res.ok) {
                const data = await res.json();

                // Set Items
                if (data.items && data.items.length > 0) {
                    setItems(data.items);
                }

                // Set Customer - wait for customers to load or set directly if payload has full object
                if (data.customerId) {
                    setSelectedCustomer(data.customerId);
                    setCustomerSearch(data.customerId.raisonSociale || `${data.customerId.prenom} ${data.customerId.nom}`);
                    setShowCustomerDropdown(false);
                }

                // Set Form Data
                if (data.data) {
                    setFormData(data.data);
                }

                // Set Template - we need to wait for templates to load, 
                // but since we fetch templates in parallel, we might need a separate effect or check
                // For simplicity, we assume templates load fast or we set logical ID
                // Ideally we find the template object in the templates array.
                // We'll defer this slightly or handle it when templates update.
            }
        } catch (error) {
            console.error('Error fetching warranty:', error);
            toast.error('Erreur chargement garantie');
        }
    };

    // Effect to match template once loaded and editing
    useEffect(() => {
        if (templates.length > 0 && editId && !selectedTemplate) {
            // Re-fetch to get the template ID from the warranty data again or store it in state
            // Optimization: fetchWarrantyToEdit actually has the data. 
            // In a real app we'd save the warrantyData in state. 
            // Here lets do a quick fetch or reliable selection if we have the warranty object.
            // Let's modify fetchWarrantyToEdit to save the template ID.
        }
    }, [templates, editId]);

    // Better approach: modify fetchTemplates and fetchWarrantyToEdit to work together.
    // Redefining fetchWarrantyToEdit to fully handle state hydration

    useEffect(() => {
        const loadEditData = async () => {
            if (editId && templates.length > 0 && customers.length > 0 && !selectedTemplate) {
                try {
                    const res = await fetch(`/api/documents/warranties/${editId}`);
                    if (res.ok) {
                        const data = await res.json();

                        // Find Template
                        const tmpl = templates.find(t => t._id === (data.templateId._id || data.templateId));
                        if (tmpl) setSelectedTemplate(tmpl);

                        // Find Customer
                        // If data.customerId is populated object
                        if (data.customerId) {
                            setSelectedCustomer(data.customerId);
                            setCustomerSearch(data.customerId.raisonSociale || `${data.customerId.prenom} ${data.customerId.nom}`);
                        }

                        setItems(data.items || []);
                        setFormData(data.data || {});
                        setWarrantyContent(data.content || tmpl?.content || '');
                        setWarrantyExclusiveAdvantages(data.exclusiveAdvantages || tmpl?.exclusiveAdvantages || '');

                        // Go to step 3 directly? Or step 1 to show selected?
                        // Step 3 (Details) is usually what users want to edit.
                        // But we need to ensure Step 1 logic (init data) doesn't overwrite.
                        setStep(3);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
        loadEditData();
    }, [editId, templates, customers]);


    // ... (rest of functions) ...

    const handleSubmit = async () => {
        if (!selectedTemplate) return;
        setSubmitting(true);

        try {
            const payload = {
                templateId: selectedTemplate._id,
                customerId: selectedCustomer?._id,
                items: items.filter(i => i.productName),
                data: formData,
                content: warrantyContent,
                exclusiveAdvantages: warrantyExclusiveAdvantages
            };

            const url = isEditMode
                ? `/api/documents/warranties/${editId}`
                : '/api/documents/warranties';

            const method = isEditMode ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(isEditMode ? 'Garantie modifiée' : 'Garantie créée');
                router.push(`/documents/warranties/${data._id}`);
            } else {
                const err = await res.json();
                toast.error(err.error || 'Erreur');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Erreur serveur');
        } finally {
            setSubmitting(false);
        }
    };

    // Render Steps
    const renderStepIndicator = () => (
        <nav aria-label="Progress" className="mb-8 overflow-x-auto pb-4 sm:pb-0 scrollbar-hide">
            <ol role="list" className="flex min-w-max md:min-w-0 md:grid md:grid-cols-4 gap-4 md:gap-8">
                {['Modèle', 'Client', 'Détails', 'Validation'].map((label, idx) => {
                    const stepNum = idx + 1;
                    const status = step > stepNum ? 'complete' : step === stepNum ? 'current' : 'upcoming';
                    return (
                        <li key={label} className="flex-1 min-w-[120px] md:min-w-0">
                            <div
                                className={`group flex flex-col border-t-4 pt-4 transition-colors ${status === 'complete' ? 'border-blue-600' :
                                    status === 'current' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'
                                    }`}
                            >
                                <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${status === 'complete' || status === 'current' ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`}>
                                    Étape {stepNum}
                                </span>
                                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{label}</span>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );

    if (loading) return <div>Chargement...</div>;

    return (
        <DashboardLayout>
            <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Nouvelle Garantie</h1>
                </div>

                {renderStepIndicator()}

                {/* STEP 1: SELECT TEMPLATE */}
                {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {templates.length === 0 ? (
                            <div className="col-span-3 text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                                <p className="text-gray-500 mb-4">Aucun modèle de garantie actif trouvé.</p>
                                <button onClick={() => router.push('/settings/warranties/new')} className="text-blue-600 hover:underline">Créer un modèle</button>
                            </div>
                        ) : (
                            templates.map(template => (
                                <div
                                    key={template._id}
                                    onClick={() => handleTemplateSelect(template)}
                                    className="cursor-pointer bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-md border-2 border-transparent hover:border-blue-500 transition-all"
                                >
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">{template.name}</h3>
                                    <p className="text-sm text-gray-500 mt-2">{template.fields.length} champs à remplir</p>

                                    {/* Field Preview */}
                                    <div className="flex flex-wrap gap-2 my-3">
                                        {template.fields.slice(0, 5).map((f, i) => (
                                            <span key={i} className="inline-flex items-center rounded-md bg-gray-50 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-500/10">
                                                {f.label}
                                            </span>
                                        ))}
                                        {template.fields.length > 5 && (
                                            <span className="text-xs text-gray-400 self-center">+{template.fields.length - 5} autres</span>
                                        )}
                                    </div>

                                    <button className="mt-4 w-full rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400">
                                        Sélectionner
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* STEP 2: CUSTOMER & ITEMS */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <UserIcon className="h-5 w-5" /> Client
                            </h2>
                            <div className="relative customer-autocomplete"> {/* Add customer-autocomplete class */}
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un client (nom, matricule...)"
                                    value={customerSearch}
                                    onChange={(e) => {
                                        setCustomerSearch(e.target.value);
                                        setShowCustomerDropdown(true);
                                        setSelectedCustomerIndex(-1);
                                        setSelectedCustomer(null); // Clear selection on type
                                    }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    onKeyDown={handleCustomerKeyDown}
                                    className="block w-full pl-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />

                                {showCustomerDropdown && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-[280px] overflow-hidden">
                                        {/* Alphabet filter bar */}
                                        <div className="flex items-center justify-center gap-1 px-2 py-2 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 text-xs flex-wrap">
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
                                                    const displayName = getCustomerName(customer);
                                                    const secondaryInfo = [
                                                        customer.code,
                                                        customer.matriculeFiscale
                                                    ].filter(Boolean).join(' - ');

                                                    return (
                                                        <div
                                                            key={customer._id}
                                                            onClick={() => handleSelectCustomer(customer)}
                                                            className={`px-4 py-3 cursor-pointer transition-colors ${index === selectedCustomerIndex
                                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' // Highlight style
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
                            </div>
                        </div>

                        {/* ARTICLES SECTION */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mt-6">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <CubeIcon className="h-5 w-5" /> Articles Couverts
                            </h2>

                            <div className="space-y-4">
                                {items.map((item, index) => (
                                    <div key={index} className="flex flex-col md:flex-row gap-4 items-start border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0 last:pb-0">

                                        {/* Product Name (Autocomplete) */}
                                        <div className="w-full md:flex-1 relative product-autocomplete">
                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Article</label>
                                            <div className="relative flex shadow-sm rounded-md overflow-hidden">
                                                <div className="relative flex-1">
                                                    <input
                                                        type="text"
                                                        value={item.productName}
                                                        onChange={(e) => {
                                                            const newVal = e.target.value;
                                                            handleItemChange(index, 'productName', newVal);
                                                            setActiveProductDropdown(index);
                                                        }}
                                                        onFocus={() => setActiveProductDropdown(index)}
                                                        className="block w-full border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm border-r-0"
                                                        placeholder="Chercher ou saisir un article"
                                                    />
                                                    {/* Dropdown */}
                                                    {activeProductDropdown === index && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-auto">
                                                            {products
                                                                .filter(p => {
                                                                    const search = (item.productName || '').toLowerCase();
                                                                    // Only show products with a name
                                                                    if (!p.nom || !p.nom.trim()) return false;

                                                                    const nameMatches = p.nom.toLowerCase().includes(search);
                                                                    const skuMatches = p.sku ? p.sku.toLowerCase().includes(search) : false;

                                                                    return nameMatches || skuMatches;
                                                                })
                                                                .slice(0, 10)
                                                                .map(p => (
                                                                    <div
                                                                        key={p._id}
                                                                        className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 last:border-0"
                                                                        onClick={() => handleSelectProduct(index, p)}
                                                                    >
                                                                        <div className="font-medium">{p.nom}</div>
                                                                        {p.sku && <div className="text-xs text-gray-400">{p.sku}</div>}
                                                                    </div>
                                                                ))
                                                            }
                                                            {products.filter(p => (p.nom || '').toLowerCase().includes((item.productName || '').toLowerCase())).length === 0 && (
                                                                <div className="px-4 py-2 text-sm text-gray-400">Aucun produit trouvé</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveModalIndex(index)}
                                                    className="px-3 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors border border-blue-600"
                                                    title="Rechercher un produit dans la liste"
                                                >
                                                    <MagnifyingGlassIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Serial Number */}
                                        <div className="w-full md:w-56">
                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">N° Série / IMEI</label>
                                            <input
                                                type="text"
                                                value={item.serialNumber}
                                                onChange={(e) => handleItemChange(index, 'serialNumber', e.target.value)}
                                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                                                placeholder="Optionnel"
                                            />
                                        </div>

                                        {/* Warranty Period */}
                                        <div className="w-full md:w-36">
                                            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Garantie</label>
                                            <input
                                                type="text"
                                                value={item.warrantyPeriod}
                                                onChange={(e) => handleItemChange(index, 'warrantyPeriod', e.target.value)}
                                                placeholder="Ex: 12 mois"
                                                className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                                            />
                                        </div>

                                        {/* Delete Button */}
                                        <div className="mt-6 flex-shrink-0">
                                            <button
                                                onClick={() => removeItem(index)}
                                                disabled={items.length === 1}
                                                className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={addItem}
                                className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            >
                                <PlusIcon className="h-4 w-4" /> Ajouter un article
                            </button>
                        </div>

                        <div className="flex justify-between mt-6">
                            <button onClick={() => setStep(1)} className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
                                <ArrowLeftIcon className="h-4 w-4" /> Précédent
                            </button>
                            <button
                                onClick={() => {
                                    setStep(3);
                                    window.scrollTo(0, 0);
                                }}
                                disabled={!selectedCustomer}
                                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
                            >
                                Suivant <ArrowRightIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: DYNAMIC FORM */}
                {step === 3 && selectedTemplate && (
                    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Détails de Garantie ({selectedTemplate.name})</h2>

                        <div className="space-y-6">
                            {[...(selectedTemplate.fields || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).map((field) => (
                                <div key={field.id}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </label>

                                    {field.type === 'textarea' ? (
                                        <textarea
                                            rows={4}
                                            value={formData[field.id] || ''}
                                            onChange={(e) => updateFormData(field.id, e.target.value)}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                                        />
                                    ) : field.type === 'boolean' ? (
                                        <div className="flex items-center gap-4 mt-2">
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name={field.id}
                                                    checked={formData[field.id] === 'true'}
                                                    onChange={() => updateFormData(field.id, 'true')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Oui</span>
                                            </label>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    name={field.id}
                                                    checked={formData[field.id] === 'false'}
                                                    onChange={() => updateFormData(field.id, 'false')}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Non</span>
                                            </label>
                                        </div>
                                    ) : (
                                        <input
                                            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                            value={formData[field.id] || ''}
                                            onChange={(e) => updateFormData(field.id, e.target.value)}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Custom Content Editors */}
                        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6 space-y-8">
                            {/* Avantage exclusif Section */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Avantage exclusif (Modifiable)
                                </label>
                                <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                    <ReactQuill
                                        theme="snow"
                                        value={warrantyExclusiveAdvantages}
                                        onChange={setWarrantyExclusiveAdvantages}
                                        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                                        [&_.ql-toolbar]:border-b-gray-200 dark:[&_.ql-toolbar]:border-b-gray-700 
                                        [&_.ql-container]:border-none 
                                        [&_.ql-editor]:min-h-[150px] [&_.ql-editor]:text-base
                                        dark:[&_.ql-stroke]:stroke-gray-300 
                                        dark:[&_.ql-fill]:fill-gray-300 
                                        dark:[&_.ql-picker]:text-gray-300
                                        dark:[&_.ql-picker-options]:bg-gray-800
                                        dark:[&_.ql-editor.ql-blank::before]:text-gray-500"
                                        modules={{
                                            toolbar: [
                                                ['bold', 'italic', 'underline', 'strike'],
                                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                [{ 'header': [1, 2, 3, false] }],
                                                [{ 'color': [] }, { 'background': [] }],
                                                ['clean']
                                            ],
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Conditions Section */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Conditions de garantie (Modifiable)
                                </label>
                                <div className="bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                                    <ReactQuill
                                        theme="snow"
                                        value={warrantyContent}
                                        onChange={setWarrantyContent}
                                        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                                        [&_.ql-toolbar]:border-b-gray-200 dark:[&_.ql-toolbar]:border-b-gray-700 
                                        [&_.ql-container]:border-none 
                                        [&_.ql-editor]:min-h-[150px] [&_.ql-editor]:text-base
                                        dark:[&_.ql-stroke]:stroke-gray-300 
                                        dark:[&_.ql-fill]:fill-gray-300 
                                        dark:[&_.ql-picker]:text-gray-300
                                        dark:[&_.ql-picker-options]:bg-gray-800
                                        dark:[&_.ql-editor.ql-blank::before]:text-gray-500"
                                        modules={{
                                            toolbar: [
                                                ['bold', 'italic', 'underline', 'strike'],
                                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                [{ 'header': [1, 2, 3, false] }],
                                                [{ 'color': [] }, { 'background': [] }],
                                                ['clean']
                                            ],
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                            <button onClick={() => setStep(2)} className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
                                <ArrowLeftIcon className="h-4 w-4" /> Précédent
                            </button>
                            <button
                                onClick={() => setStep(4)}
                                className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-500 flex items-center gap-2"
                            >
                                Vérifier <ArrowRightIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: SUMMARY */}
                {step === 4 && selectedTemplate && (
                    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow space-y-8">
                        <div className="text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
                            </div>
                            <h3 className="mt-2 text-base font-semibold leading-6 text-gray-900 dark:text-white">Confirmer la création</h3>
                            <p className="mt-1 text-sm text-gray-500">Vérifiez les informations avant de générer le certificat.</p>
                        </div>

                        <dl className="divide-y divide-gray-100 dark:divide-gray-700">
                            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                                <dt className="text-sm font-medium leading-6 text-gray-900 dark:text-white">Modèle</dt>
                                <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-400 sm:col-span-2 sm:mt-0">{selectedTemplate.name}</dd>
                            </div>
                            <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                                <dt className="text-sm font-medium leading-6 text-gray-900 dark:text-white">Client</dt>
                                <dd className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-400 sm:col-span-2 sm:mt-0">{selectedCustomer && getCustomerName(selectedCustomer)}</dd>
                            </div>

                        </dl>

                        <div className="flex justify-between w-full">
                            <button onClick={() => setStep(3)} className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
                                <ArrowLeftIcon className="h-4 w-4" /> Retour
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-500 disabled:opacity-50 flex items-center gap-2"
                            >
                                {submitting ? 'Création...' : 'Générer le Certificat'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* PRODUCT SEARCH MODAL */}
            {activeModalIndex !== null && (
                <ProductSearchModal
                    isOpen={true}
                    onClose={() => setActiveModalIndex(null)}
                    onSelect={handleSelectProductFromModal}
                    products={products as any}
                    tenantId={(session?.user as any)?.companyId || ''}
                    title="Sélectionner un article à couvrir"
                />
            )}
        </DashboardLayout>
    );
}
