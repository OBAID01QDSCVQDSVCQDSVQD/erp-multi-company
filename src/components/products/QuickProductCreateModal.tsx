import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface QuickProductCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (product: any) => void;
    initialName?: string;
    tenantId: string;
}

export default function QuickProductCreateModal({
    isOpen,
    onClose,
    onSuccess,
    initialName,
    tenantId
}: QuickProductCreateModalProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        nom: initialName || '',
        referenceClient: '',
        prixVenteHT: 0,
        tvaPct: 19, // Default TVA
        taxCode: 'T19', // Default Code
        typeProduit: 'stocke', // Default to stored product
        description: ''
    });

    useEffect(() => {
        if (isOpen) {
            setForm(prev => ({ ...prev, nom: initialName || '', referenceClient: '', typeProduit: 'stocke' }));
        }
    }, [isOpen, initialName]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.nom) return;

        setLoading(true);
        try {
            // Generate a random SKU
            const sku = `P-${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`;

            const payload = {
                nom: form.nom,
                sku: sku,
                referenceClient: form.referenceClient,
                prixVenteHT: form.prixVenteHT,
                taxCode: form.taxCode,
                tvaPct: form.tvaPct,
                estStocke: form.typeProduit === 'stocke',
                actif: true,
                description: 'Créé depuis la facture (Rapide)'
            };

            const res = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newProduct = await res.json();
                onSuccess(newProduct);
                onClose();
            } else {
                const txt = await res.text();
                alert('Erreur: ' + txt);
            }
        } catch (err) {
            console.error(err);
            alert('Erreur de connexion');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Création Rapide Produit</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type de produit</label>
                        <div className="flex gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="typeProduit"
                                    value="stocke"
                                    checked={form.typeProduit === 'stocke'}
                                    onChange={() => setForm({ ...form, typeProduit: 'stocke' })}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900 dark:text-gray-300">Article (Stocké)</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="typeProduit"
                                    value="service"
                                    checked={form.typeProduit === 'service'}
                                    onChange={() => setForm({ ...form, typeProduit: 'service' })}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900 dark:text-gray-300">Service (Non stocké)</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Référence</label>
                        <input
                            value={form.referenceClient}
                            onChange={e => setForm({ ...form, referenceClient: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="REF-..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom *</label>
                        <input
                            required
                            value={form.nom}
                            onChange={e => setForm({ ...form, nom: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prix HT</label>
                            <input
                                type="number"
                                step="0.001"
                                value={form.prixVenteHT}
                                onChange={e => setForm({ ...form, prixVenteHT: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">TVA (%)</label>
                            <select
                                value={form.taxCode}
                                onChange={e => {
                                    const code = e.target.value;
                                    let rate = 19;
                                    if (code === 'T19') rate = 19;
                                    if (code === 'T7') rate = 7;
                                    if (code === 'T13') rate = 13;
                                    if (code === 'EXX') rate = 0;
                                    setForm({ ...form, taxCode: code, tvaPct: rate });
                                }}
                                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="T19">19%</option>
                                <option value="T13">13%</option>
                                <option value="T7">7%</option>
                                <option value="EXX">0%</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-md"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                        >
                            {loading ? 'Création...' : 'Créer & Lier'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
