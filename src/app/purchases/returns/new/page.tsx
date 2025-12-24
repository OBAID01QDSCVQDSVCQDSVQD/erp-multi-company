'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTenantId } from '@/hooks/useTenantId';

interface BR {
    _id: string;
    numero: string;
    dateDoc: string;
    fournisseurId: {
        _id: string;
        nom: string;
        prenom: string;
        raisonSociale: string;
    } | string;
    fournisseurNom?: string; // For leaner responses
    warehouseId?: string; // Link to Warehouse
    lignes: any[];
}

interface Invoice {
    _id: string;
    numero: string;
    dateFacture: string;
    fournisseurId: string;
    fournisseurNom?: string;
    warehouseId?: string;
    lignes: any[];
    statut: string;
}

interface ReturnLine {
    productId: string;
    designation: string;
    quantite: number;
    quantiteMax: number;
    qteRecue: number; // Original quantity received/invoiced
    uom: string;
    prixUnitaireHT: number;
    remisePct: number;
    tvaPct: number;
}

export default function NewPurchaseReturnPage() {
    const router = useRouter();
    const { tenantId } = useTenantId();
    const [loading, setLoading] = useState(false);

    // Data
    const [brs, setBrs] = useState<BR[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);

    // Selection
    const [returnSource, setReturnSource] = useState<'BR' | 'INVOICE'>('BR');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const [selectedBR, setSelectedBR] = useState<BR | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // Form
    const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [formData, setFormData] = useState({
        dateDoc: new Date().toISOString().split('T')[0],
        notes: '',
    });

    useEffect(() => {
        if (tenantId) {
            fetchBrs();
            // Fetch invoices when switching source or eagerly? 
            // We fetch lazily when user switches to 'INVOICE' OR eagerly if we want.
            // Let's rely on fetchInvoices being called on toggle.
            fetchWarehouses();
        }
    }, [tenantId]);

    const fetchBrs = async () => {
        try {
            // Fetch VALIDATED receptions, EXCLUDING those already billed
            const response = await fetch('/api/purchases/receptions?statut=VALIDE&excludeBilled=true&limit=100', {
                headers: { 'X-Tenant-Id': tenantId || '' },
            });
            if (response.ok) {
                const data = await response.json();
                setBrs(data.items || []);
            }
        } catch (error) {
            console.error('Error fetching BRs:', error);
            toast.error('Erreur lors du chargement des bons de réception');
        }
    };

    const fetchInvoices = async () => {
        try {
            // Fetch VALIDATED or PAID Invoices
            // We can fetch 'VALIDEE' and then 'PAYEE' or fetch all and client filter.
            // API supports single status? Let's assume standard API.
            // Usually filters are exclusive. Let's fetch all and filter in memory if API is limited,
            // or check if API supports list of statuses. 
            // Currently `/api/purchases/invoices` filters strictly by one status.
            // We will try fetching VALIDEE first.
            // Ideally modify API to support multi-status, but let's just fetch VALIDEE for now as that's the main case
            // The user mentioned "Paid" too.
            // Let's loop fetches or modify API. Given time, I'll fetch VALIDEE.
            // Actually, I can just fetch all (limit=100) and filter. Or just ask for VALIDEE.

            // Wait, the API I saw earlier supports `statut`. 
            // I'll fetch all without status filter but large limit and filter client side? 
            // Or fetch VALIDEE and PAYEE.

            const [res1, res2, res3] = await Promise.all([
                fetch('/api/purchases/invoices?statut=VALIDEE&limit=50', { headers: { 'X-Tenant-Id': tenantId || '' } }),
                fetch('/api/purchases/invoices?statut=PAYEE&limit=50', { headers: { 'X-Tenant-Id': tenantId || '' } }),
                fetch('/api/purchases/invoices?statut=PARTIELLEMENT_PAYEE&limit=50', { headers: { 'X-Tenant-Id': tenantId || '' } })
            ]);

            let allInvoices: Invoice[] = [];
            if (res1.ok) { const d = await res1.json(); allInvoices = [...allInvoices, ...(d.items || [])]; }
            if (res2.ok) { const d = await res2.json(); allInvoices = [...allInvoices, ...(d.items || [])]; }
            if (res3.ok) { const d = await res3.json(); allInvoices = [...allInvoices, ...(d.items || [])]; }

            // Remove potential duplicates
            const uniqueInvoices = Array.from(new Map(allInvoices.map(inv => [inv._id, inv])).values());

            setInvoices(uniqueInvoices);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Erreur lors du chargement des factures');
        }
    };

    const fetchWarehouses = async () => {
        try {
            const response = await fetch('/api/stock/warehouses', {
                headers: { 'X-Tenant-Id': tenantId || '' },
            });
            if (response.ok) {
                const data = await response.json();
                setWarehouses(data);
            }
        } catch (error) {
            console.error('Error fetching warehouses:', error);
        }
    };

    const filteredItems = returnSource === 'BR'
        ? brs.filter(br => br.numero.toLowerCase().includes(searchQuery.toLowerCase()))
        : invoices.filter(inv => inv.numero.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSelectBR = (br: BR) => {
        setSelectedBR(br);
        setSelectedInvoice(null);
        setSearchQuery(br.numero);
        setShowDropdown(false);
        autoSelectWarehouse(br.warehouseId);
        populateLines(br.lignes);
    };

    const handleSelectInvoice = (inv: Invoice) => {
        setSelectedInvoice(inv);
        setSelectedBR(null);
        setSearchQuery(inv.numero);
        setShowDropdown(false);
        autoSelectWarehouse(inv.warehouseId);
        populateLines(inv.lignes);
    };

    const autoSelectWarehouse = (sourceWarehouseId?: string) => {
        if (sourceWarehouseId) {
            setSelectedWarehouseId(sourceWarehouseId);
        } else {
            const defaultMvt = warehouses.find(w => w.isDefault);
            if (defaultMvt) {
                setSelectedWarehouseId(defaultMvt._id);
            }
        }
    };

    const populateLines = (sourceLines: any[]) => {
        if (sourceLines && Array.isArray(sourceLines) && sourceLines.length > 0) {
            const lines = sourceLines.map((line: any) => {
                // Determine quantity (Recue for BR, Facturee/Quantite for Invoice)
                // For Invoice, line.quantite is the billed quantity.
                // For BR, line.qteRecue is the received quantity.
                // We use a generic variable for "max quantity available to return".
                let maxQty = 0;

                if (returnSource === 'BR') {
                    maxQty = line.qteRecue || 0;
                } else {
                    maxQty = line.quantite || 0; // Use invoiced quantity
                }

                return {
                    productId: line.productId || line.produitId || '',
                    designation: line.designation,
                    quantite: 0,
                    quantiteMax: maxQty,
                    qteRecue: maxQty,
                    uom: line.uom || line.unite || 'PCE',
                    prixUnitaireHT: line.prixUnitaireHT || 0,
                    remisePct: line.remisePct || 0,
                    tvaPct: line.tvaPct || 0,
                };
            });
            setReturnLines(lines);
        } else {
            setReturnLines([]);
            toast.error('Ce document ne contient aucune ligne');
        }
    };

    const updateReturnLineQuantity = (index: number, quantite: number) => {
        const newLines = [...returnLines];
        const maxQty = newLines[index].quantiteMax;
        newLines[index].quantite = Math.min(Math.max(0, quantite), maxQty);
        setReturnLines(newLines);
    };

    const removeReturnLine = (index: number) => {
        setReturnLines(returnLines.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (returnSource === 'BR' && !selectedBR) {
            toast.error('Veuillez sélectionner un BR');
            return;
        }
        if (returnSource === 'INVOICE' && !selectedInvoice) {
            toast.error('Veuillez sélectionner une facture');
            return;
        }

        const validLines = returnLines.filter(line => line.quantite > 0);
        if (validLines.length === 0) {
            toast.error('Veuillez ajouter au moins une ligne avec une quantité retournée');
            return;
        }

        if (!selectedWarehouseId) {
            toast.error('Veuillez sélectionner un entrepôt de départ (Stock)');
            return;
        }

        setLoading(true);
        try {
            const supplierId = returnSource === 'BR'
                ? (typeof selectedBR?.fournisseurId === 'object' ? selectedBR.fournisseurId._id : selectedBR?.fournisseurId)
                : selectedInvoice?.fournisseurId;

            // Extract financial settings from selected document (if Invoice)
            // If BR, we might not have them unless we fetched linked purchase order or supplier settings, 
            // but usually BR doesn't have financials like Fodec/Remise Globale itself (it relies on Invoice).
            // However, the User wants these on the Return/Credit Note.
            // If Source is Invoice, we definitely have them.

            let financialSettings = {};
            if (returnSource === 'INVOICE' && selectedInvoice) {
                financialSettings = {
                    remiseGlobalePct: (selectedInvoice as any).remiseGlobalePct || 0,
                    fodec: (selectedInvoice as any).fodec ? {
                        enabled: (selectedInvoice as any).fodec.enabled,
                        tauxPct: (selectedInvoice as any).fodec.tauxPct,
                        montant: 0 // Will be recalculated
                    } : undefined,
                    timbreFiscal: (selectedInvoice as any).timbre ? (selectedInvoice as any).timbre.montant : undefined
                };
            }

            const returnDoc = {
                brId: selectedBR?._id,
                invoiceId: selectedInvoice?._id,
                supplierId: supplierId,
                warehouseId: selectedWarehouseId,
                dateDoc: formData.dateDoc,
                notes: formData.notes,
                lignes: validLines.map(line => ({
                    productId: line.productId,
                    designation: line.designation,
                    quantite: line.quantite,
                    uomCode: line.uom,
                    prixUnitaireHT: line.prixUnitaireHT,
                    remisePct: line.remisePct,
                    tvaPct: line.tvaPct,
                })),
                ...financialSettings
            };

            const response = await fetch('/api/purchases/returns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId || '',
                },
                body: JSON.stringify(returnDoc),
            });

            if (response.ok) {
                toast.success('Retour achat créé avec succès. Veuillez le valider.');
                router.push('/purchases/returns');
            } else {
                const error = await response.json();
                const errorMessage = error.error || error.details || 'Erreur lors de la création du retour';
                toast.error(errorMessage, { duration: 5000 });
            }
        } catch (error) {
            console.error('Error creating return:', error);
            toast.error('Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    const getSupplierName = (supplier: any): string => {
        if (!supplier) return 'N/A';
        if (typeof supplier === 'object') {
            return supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim() || 'N/A';
        }
        return 'N/A';
    };

    const selectedDoc = returnSource === 'BR' ? selectedBR : selectedInvoice;

    return (
        <DashboardLayout>
            <div className="p-4 sm:p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/purchases/returns')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau retour achat</h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Créer un bon de retour vers le fournisseur</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Source Selection */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4 border dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Source du retour</h2>

                            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReturnSource('BR');
                                        setSelectedBR(null);
                                        setSelectedInvoice(null);
                                        setReturnLines([]);
                                        setSearchQuery('');
                                    }}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${returnSource === 'BR'
                                        ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                        }`}
                                >
                                    Bon de Réception (Non facturé)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReturnSource('INVOICE');
                                        setSelectedBR(null);
                                        setSelectedInvoice(null);
                                        setReturnLines([]);
                                        setSearchQuery('');
                                        if (invoices.length === 0) fetchInvoices();
                                    }}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${returnSource === 'INVOICE'
                                        ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                                        }`}
                                >
                                    Facture Achat (Validée)
                                </button>
                            </div>
                        </div>

                        {/* Generic Document Selection (BR or Invoice) */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {returnSource === 'BR' ? 'Bon de réception' : 'Facture Achat'} *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder={returnSource === 'BR' ? "Rechercher un BR..." : "Rechercher une facture..."}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                />
                                {selectedDoc && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (returnSource === 'BR') setSelectedBR(null);
                                            else setSelectedInvoice(null);
                                            setSearchQuery('');
                                            setReturnLines([]);
                                        }}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                )}

                                {showDropdown && filteredItems.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                        {filteredItems.map((item: any) => (
                                            <button
                                                key={item._id}
                                                type="button"
                                                onClick={() => returnSource === 'BR' ? handleSelectBR(item) : handleSelectInvoice(item)}
                                                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-600 last:border-b-0 text-gray-900 dark:text-white"
                                            >
                                                <div className="font-medium">{item.numero}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                                    {new Date(item.dateDoc || item.dateFacture).toLocaleDateString('fr-FR')} - {item.fournisseurNom || getSupplierName(item.fournisseurId)}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedDoc && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 mt-4">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-medium text-gray-900 dark:text-white">Document:</span> {selectedDoc.numero} |
                                    <span className="font-medium ml-2 text-gray-900 dark:text-white">Date:</span> {new Date((selectedDoc as any).dateDoc || (selectedDoc as any).dateFacture).toLocaleDateString('fr-FR')} |
                                    <span className="font-medium ml-2 text-gray-900 dark:text-white">Fournisseur:</span> {(selectedDoc as any).fournisseurNom || getSupplierName((selectedDoc as any).fournisseurId)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Return Lines */}
                    {selectedDoc && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4 border dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lignes à retourner</h2>
                            </div>

                            {returnLines.length === 0 ? (
                                <p className="text-gray-500 dark:text-gray-400 text-center py-4">Aucune ligne disponible</p>
                            ) : (
                                <div className="space-y-4">
                                    {returnLines.map((line, index) => (
                                        <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900 dark:text-white">{line.designation}</p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Quantité {returnSource === 'BR' ? 'reçue' : 'facturée'}: {line.qteRecue} {line.uom}
                                                        {line.qteRecue !== line.quantiteMax && (
                                                            <span className="text-orange-600 dark:text-orange-400 ml-2">
                                                                (Max retour: {line.quantiteMax} {line.uom})
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                {returnLines.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeReturnLine(index)}
                                                        className="text-red-600 hover:text-red-800"
                                                    >
                                                        <XMarkIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Quantité à retourner *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={line.quantiteMax}
                                                        value={line.quantite}
                                                        onChange={(e) => updateReturnLineQuantity(index, parseFloat(e.target.value) || 0)}
                                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                        required
                                                    />
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Maximum: {line.quantiteMax} {line.uom}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Form Details */}
                    {selectedDoc && returnLines.some(line => line.quantite > 0) && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4 border dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Détails du retour</h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Entrepôt de départ (Stock à diminuer) *</label>
                                <select
                                    value={selectedWarehouseId}
                                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                >
                                    <option value="">Sélectionner un entrepôt...</option>
                                    {warehouses.map(w => (
                                        <option key={w._id} value={w._id}>
                                            {w.name} {w.isDefault ? '(Défaut)' : ''}
                                        </option>
                                    ))}
                                </select>
                                {(selectedDoc as any)?.warehouseId && selectedWarehouseId !== (selectedDoc as any)?.warehouseId && (
                                    <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                                        Attention : L'entrepôt sélectionné diffère de celui du document original. Assurez-vous que le stock est disponible.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Date du retour *
                                </label>
                                <input
                                    type="date"
                                    value={formData.dateDoc}
                                    onChange={(e) => setFormData({ ...formData, dateDoc: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Notes (optionnel)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4">
                        <button
                            type="button"
                            onClick={() => router.push('/purchases/returns')}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedDoc || !returnLines.some(line => line.quantite > 0)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Création...' : 'Créer le retour'}
                        </button>
                    </div>
                </form>
            </div>
        </DashboardLayout>
    );
}
