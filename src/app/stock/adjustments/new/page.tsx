'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import ProductSearchModal from '@/components/common/ProductSearchModal';

export default function NewdjustmentPage() {
    const router = useRouter();
    const { tenantId } = useTenantId();
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    // Form Data
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [warehouseId, setWarehouseId] = useState('');
    const [notes, setNotes] = useState('');

    const [lines, setLines] = useState<any[]>([
        { productId: '', quantity: 1, type: 'ADD' }
    ]);

    const [saving, setSaving] = useState(false);

    // Modal
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
            const res = await fetch('/api/products?limit=1000', {
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(data.items || data.products || []);
            }
        } catch (e) { console.error(e); }
    }

    const addLine = () => {
        setLines([...lines, { productId: '', quantity: 1, type: 'ADD' }]);
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
                designation: product.nom
            };
            setLines(newLines);
        }
        setIsProductModalOpen(false);
    };

    const getProductDisplay = (productId: string) => {
        if (!productId) return '';
        const p = products.find(x => x._id === productId);
        return p ? `${p.nom}` : 'Produit inconnu';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!warehouseId) {
            toast.error('Veuillez sélectionner un entrepôt');
            return;
        }

        if (lines.some(l => !l.productId || l.quantity <= 0)) {
            toast.error('Veuillez vérifier les lignes');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/stock/adjustments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId || ''
                },
                body: JSON.stringify({
                    date,
                    warehouseId,
                    notes,
                    lines
                })
            });

            if (res.ok) {
                toast.success('Ajustements enregistrés');
                router.push('/stock'); // Redirect to stock list or history
            } else {
                toast.error('Erreur lors de l\'enregistrement');
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
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ajustement de Stock</h1>
                </div>

                <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entrepôt</label>
                            <select
                                required
                                value={warehouseId}
                                onChange={(e) => setWarehouseId(e.target.value)}
                                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
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
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500" // Added dark-mode scheme
                                style={{ colorScheme: 'dark' }} // Force date picker to be dark
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes / Raison</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ex: Inventaire annuel, Casser, Perdu..."
                                className="mt-1 block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Lignes à ajuster</h3>
                        <div className="space-y-3">
                            {lines.map((line, index) => (
                                <div key={index} className="flex flex-col md:flex-row gap-3 items-end bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Produit</label>
                                        <div
                                            onClick={() => openProductModal(index)}
                                            className="cursor-pointer border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 min-h-[38px] flex items-center justify-between hover:border-blue-500 transition-colors"
                                        >
                                            <span className="truncate text-gray-900 dark:text-white">{line.productId ? getProductDisplay(line.productId) : <span className="text-gray-400">Choisir...</span>}</span>
                                            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="w-full md:w-32">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                                        <select
                                            value={line.type}
                                            onChange={(e) => updateLine(index, 'type', e.target.value)}
                                            className="block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="ADD">Ajout (+)</option>
                                            <option value="REMOVE">Retrait (-)</option>
                                        </select>
                                    </div>
                                    <div className="w-full md:w-32">
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Quantité</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={line.quantity}
                                            onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value))}
                                            className="block w-full border rounded-md px-3 py-2 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeLine(index)}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addLine}
                            className="mt-4 flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium"
                        >
                            <PlusIcon className="w-4 h-4" /> Ajouter une ligne
                        </button>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Enregistrement...' : 'Valider l\'ajustement'}
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
