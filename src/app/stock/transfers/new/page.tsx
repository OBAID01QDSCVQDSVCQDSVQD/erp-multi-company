'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ProductSearchModal from '@/components/common/ProductSearchModal';

export default function NewStockTransferPage() {
    const router = useRouter();
    const { tenantId } = useTenantId();
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        sourceWarehouseId: '',
        destinationWarehouseId: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const [lines, setLines] = useState<any[]>([
        { productId: '', quantity: 1 }
    ]);

    const [saving, setSaving] = useState(false);

    // Modal State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

    useEffect(() => {
        if (tenantId) {
            fetchWarehouses();
            fetchProducts();
        }
    }, [tenantId]);

    async function fetchWarehouses() {
        try {
            const res = await fetch('/api/stock/warehouses', {
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (res.ok) setWarehouses(await res.json());
        } catch (e) { console.error(e); }
    }

    async function fetchProducts() {
        try {
            // We fetch all products (lightweight if possible)
            // using existing list API or similar
            const res = await fetch('/api/products?limit=1000', { // simplified
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (res.ok) {
                const data = await res.json();
                // Handle both array response and paginated response { items: [...] }
                const items = Array.isArray(data) ? data : (data.items || data.products || []);
                setProducts(items);
            }
        } catch (e) { console.error(e); }
    }

    const addLine = () => {
        setLines([...lines, { productId: '', quantity: 1 }]);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const openProductModal = (index: number) => {
        setActiveLineIndex(index);
        setIsProductModalOpen(true);
    };

    const handleProductSelect = (product: any) => {
        if (activeLineIndex !== null) {
            const newLines = [...lines];
            newLines[activeLineIndex] = {
                ...newLines[activeLineIndex],
                productId: product._id,
                designation: product.nom // Save designation for display/errors
            };
            setLines(newLines);
        }
        setIsProductModalOpen(false); // Close modal after selection
    };

    const getProductDisplay = (productId: string) => {
        if (!productId) return '';
        const p = products.find(x => x._id === productId);
        return p ? `${p.nom} (${p.sku || '-'})` : 'Produit inconnu';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.sourceWarehouseId || !formData.destinationWarehouseId) {
            toast.error('Veuillez sélectionner les entrepôts');
            return;
        }
        if (formData.sourceWarehouseId === formData.destinationWarehouseId) {
            toast.error('Les entrepôts doivent être différents');
            return;
        }
        if (lines.some(l => !l.productId || l.quantity <= 0)) {
            toast.error('Veuillez remplir correctement les lignes');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/stock/transfers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId || ''
                },
                body: JSON.stringify({
                    ...formData,
                    lignes: lines
                })
            });

            if (res.ok) {
                toast.success('Transfert créé avec succès');
                router.push('/stock/transfers');
            } else {
                const err = await res.json();
                toast.error(err.error || 'Erreur lors de la création');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erreur serveur');
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau Transfert</h1>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6 border dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entrepôt Source (Départ)</label>
                            <select
                                required
                                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                value={formData.sourceWarehouseId}
                                onChange={e => setFormData({ ...formData, sourceWarehouseId: e.target.value })}
                            >
                                <option value="">Sélectionner...</option>
                                {warehouses.map(w => (
                                    <option key={w._id} value={w._id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entrepôt Destination (Arrivée)</label>
                            <select
                                required
                                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                value={formData.destinationWarehouseId}
                                onChange={e => setFormData({ ...formData, destinationWarehouseId: e.target.value })}
                            >
                                <option value="">Sélectionner...</option>
                                {warehouses.map(w => (
                                    <option key={w._id} value={w._id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                            <input
                                type="date"
                                required
                                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                            <input
                                type="text"
                                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Produits à transférer</h3>
                        <div className="space-y-4">
                            {lines.map((line, index) => (
                                <div key={index} className="flex gap-4 items-end bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Produit</label>
                                        <div
                                            className="relative cursor-pointer"
                                            onClick={() => openProductModal(index)}
                                        >
                                            <div className="block w-full border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 min-h-[38px] flex items-center">
                                                {line.productId ? (
                                                    <span className="text-gray-900 dark:text-white">{getProductDisplay(line.productId)}</span>
                                                ) : (
                                                    <span className="text-gray-400">Cliquer pour choisir un produit...</span>
                                                )}
                                            </div>
                                            <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="w-32">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Quantité</label>
                                        <input
                                            type="number"
                                            min="0.001"
                                            step="0.001"
                                            required
                                            className="block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                            value={line.quantity}
                                            onChange={e => updateLine(index, 'quantity', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeLine(index)}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                        title="Supprimer la ligne"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addLine}
                            className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" /> Ajouter une ligne
                        </button>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Enregistrement...' : 'Créer le transfert'}
                        </button>
                    </div>
                </form>

                <ProductSearchModal
                    isOpen={isProductModalOpen}
                    onClose={() => setIsProductModalOpen(false)}
                    onSelect={handleProductSelect}
                    products={products}
                    tenantId={tenantId || ''}
                />
            </div>
        </DashboardLayout>
    );
}
