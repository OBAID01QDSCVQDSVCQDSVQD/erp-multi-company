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

interface ReturnLine {
    productId: string;
    designation: string;
    quantite: number;
    quantiteMax: number;
    qteRecue: number; // Original quantity received
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
    const [warehouses, setWarehouses] = useState<any[]>([]);

    // Selection
    const [brSearch, setBrSearch] = useState('');
    const [showBrDropdown, setShowBrDropdown] = useState(false);
    const [selectedBR, setSelectedBR] = useState<BR | null>(null);

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
            fetchWarehouses();
        }
    }, [tenantId]);

    const fetchBrs = async () => {
        try {
            // Fetch only VALIDATED receptions
            const response = await fetch('/api/purchases/receptions?statut=VALIDE&limit=100', {
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

    const filteredBRs = brs.filter((br) => {
        const searchLower = brSearch.toLowerCase();
        return br.numero.toLowerCase().includes(searchLower);
    });

    const handleSelectBR = async (br: BR) => {
        setSelectedBR(br);
        setBrSearch(br.numero);
        setShowBrDropdown(false);

        // Auto-select warehouse from BR if available
        if (br.warehouseId) {
            setSelectedWarehouseId(br.warehouseId);
        } else {
            // Find default warehouse if possible, or leave empty
            // Ideally we should find the default warehouse from the list
            const defaultMvt = warehouses.find(w => w.isDefault);
            if (defaultMvt) {
                setSelectedWarehouseId(defaultMvt._id);
            }
        }

        // Fetch full BR details including lignes because the list might be lightweight?
        // Actually our API returns lines, but let's be safe and use the object we have or fetch if needed.
        // Assuming 'br' from list already has lines. If not, we'd need a specific fetch.
        // Let's rely on the list data for now as our API /api/purchases/receptions returns lines.

        // BUT we need to be careful: the list API implementation I saw earlier does NOT specific select fields, so it returns everything (lean).
        // So 'br.lignes' should be available.

        if (br.lignes && Array.isArray(br.lignes) && br.lignes.length > 0) {
            const lines = br.lignes.map((line: any) => {
                // Use qteRecue as the max returnable quantity
                const qteRecue = line.qteRecue || 0;

                return {
                    productId: line.productId || '',
                    designation: line.designation,
                    quantite: 0,
                    quantiteMax: qteRecue,
                    qteRecue: qteRecue,
                    uom: line.uom || 'PCE',
                    prixUnitaireHT: line.prixUnitaireHT || 0,
                    remisePct: line.remisePct || 0,
                    tvaPct: line.tvaPct || 0,
                };
            });
            setReturnLines(lines);
        } else {
            setReturnLines([]);
            toast.error('Ce BR ne contient aucune ligne');
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

        if (!selectedBR) {
            toast.error('Veuillez sélectionner un BR');
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
            // Prepare return document
            const supplierId = typeof selectedBR.fournisseurId === 'object' ? selectedBR.fournisseurId._id : selectedBR.fournisseurId;

            const returnDoc = {
                brId: selectedBR._id,
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
                toast.success('Retour achat créé avec succès');
                router.push('/purchases/returns'); // We need to create this list page too
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

    return (
        <DashboardLayout>
            <div className="p-4 sm:p-6 space-y-6">
                {/* Header */}
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

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* BR Selection */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4 border dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sélectionner le Bon de Réception (BR)</h2>

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Bon de réception *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={brSearch}
                                    onChange={(e) => {
                                        setBrSearch(e.target.value);
                                        setShowBrDropdown(true);
                                    }}
                                    onFocus={() => setShowBrDropdown(true)}
                                    placeholder="Rechercher un BR..."
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                />
                                {selectedBR && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedBR(null);
                                            setBrSearch('');
                                            setReturnLines([]);
                                        }}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                )}

                                {showBrDropdown && filteredBRs.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                        {filteredBRs.map((br) => (
                                            <button
                                                key={br._id}
                                                type="button"
                                                onClick={() => handleSelectBR(br)}
                                                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-600 last:border-b-0 text-gray-900 dark:text-white"
                                            >
                                                <div className="font-medium">{br.numero}</div>
                                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                                    {new Date(br.dateDoc).toLocaleDateString('fr-FR')} - {br.fournisseurNom || getSupplierName(br.fournisseurId)}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedBR && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-medium text-gray-900 dark:text-white">BR:</span> {selectedBR.numero} |
                                    <span className="font-medium ml-2 text-gray-900 dark:text-white">Date:</span> {new Date(selectedBR.dateDoc).toLocaleDateString('fr-FR')} |
                                    <span className="font-medium ml-2 text-gray-900 dark:text-white">Fournisseur:</span> {selectedBR.fournisseurNom || getSupplierName(selectedBR.fournisseurId)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Return Lines */}
                    {selectedBR && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4 border dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lignes à retourner</h2>
                            </div>

                            {returnLines.length === 0 ? (
                                <p className="text-gray-500 dark:text-gray-400 text-center py-4">Aucune ligne disponible dans ce BR</p>
                            ) : (
                                <div className="space-y-4">
                                    {returnLines.map((line, index) => (
                                        <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900 dark:text-white">{line.designation}</p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        Quantité reçue: {line.qteRecue} {line.uom}
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
                    {selectedBR && returnLines.some(line => line.quantite > 0) && (
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
                                {selectedBR && selectedBR.warehouseId && selectedWarehouseId !== selectedBR.warehouseId && (
                                    <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                                        Attention : L'entrepôt sélectionné diffère de celui du BR original. Assurez-vous que le stock est disponible.
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
                            disabled={loading || !selectedBR || !returnLines.some(line => line.quantite > 0)}
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
