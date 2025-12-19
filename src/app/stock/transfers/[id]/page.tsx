'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, CheckIcon, XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

export default function StockTransferDetailPage() {
    const router = useRouter();
    const { id } = useParams();
    const { tenantId } = useTenantId();
    const [transfer, setTransfer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [validating, setValidating] = useState(false);
    const [warehouses, setWarehouses] = useState<Record<string, string>>({});
    const [products, setProducts] = useState<Record<string, string>>({});

    useEffect(() => {
        if (tenantId && id) {
            fetchData();
        }
    }, [tenantId, id]);

    async function fetchData() {
        setLoading(true);
        setError('');
        try {
            // Fetch Transfer First
            const resTransfer = await fetch(`/api/stock/transfers/${id}`, {
                headers: { 'X-Tenant-Id': tenantId || '' },
                cache: 'no-store'
            });

            if (!resTransfer.ok) {
                const errBody = await resTransfer.json().catch(() => ({}));
                const msg = errBody.error || `Erreur API Transfert (${resTransfer.status})`;
                setError(msg);
                setLoading(false);
                return;
            }

            const transferData = await resTransfer.json();
            setTransfer(transferData);

            // Then fetch auxiliaries (non-blocking for critical view)
            try {
                const resWh = await fetch('/api/stock/warehouses', { headers: { 'X-Tenant-Id': tenantId || '' } });
                if (resWh.ok) {
                    const data = await resWh.json();
                    const map: Record<string, string> = {};
                    data.forEach((w: any) => map[w._id] = w.name);
                    setWarehouses(map);
                }
            } catch (e) { console.error('Warehouses fetch error', e); }

            try {
                const resProd = await fetch('/api/products?limit=1000', { headers: { 'X-Tenant-Id': tenantId || '' } });
                if (resProd.ok) {
                    const data = await resProd.json();
                    const list = data.products || data.items || data || [];
                    const map: Record<string, string> = {};
                    if (Array.isArray(list)) {
                        list.forEach((p: any) => map[p._id] = p.nom);
                    }
                    setProducts(map);
                }
            } catch (e) { console.error('Products fetch error', e); }

        } catch (error) {
            console.error(error);
            setError(`Erreur technique: ${(error as Error).message}`);
            toast.error('Erreur chargement');
        } finally {
            setLoading(false);
        }
    }

    const handleValidate = async () => {
        if (!confirm('Voulez-vous vraiment valider ce transfert ? Cette action créera les mouvements de stock.')) return;

        setValidating(true);
        try {
            const res = await fetch(`/api/stock/transfers/${id}/validate`, {
                method: 'POST',
                headers: { 'X-Tenant-Id': tenantId || '' }
            });

            if (res.ok) {
                toast.success('Transfert validé avec succès');
                fetchData(); // Reload
            } else {
                const err = await res.json();
                toast.error(err.error || 'Erreur lors de la validation');
            }
        } catch (e) {
            toast.error('Erreur serveur');
        } finally {
            setValidating(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Voulez-vous vraiment annuler ce transfert ?')) return;

        try {
            const res = await fetch(`/api/stock/transfers/${id}`, { // Using DELETE on the resource
                method: 'DELETE',
                headers: { 'X-Tenant-Id': tenantId || '' }
            });

            if (res.ok) {
                toast.success('Transfert annulé/supprimé');
                router.push('/stock/transfers');
            } else {
                toast.error('Erreur lors de l\'annulation');
            }
        } catch (e) { toast.error('Erreur serveur'); }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="p-6 space-y-6 max-w-5xl mx-auto animate-pulse">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-4 items-center">
                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
                        </div>
                        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 grid grid-cols-2 gap-6 border dark:border-gray-700">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i}>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
                                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                            </div>
                        ))}
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                        <div className="h-12 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700" />
                        <div className="p-4 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/30 rounded" />
                            ))}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }
    if (error) return <DashboardLayout><div className="p-8 text-center text-red-600 dark:text-red-400 font-bold bg-white dark:bg-gray-800 m-6 rounded shadow border dark:border-red-900/30">Erreur: {error}</div></DashboardLayout>;
    if (!transfer) return <DashboardLayout><div className="p-8 text-center text-gray-500 dark:text-gray-400">Introuvable</div></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6 max-w-5xl mx-auto">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transfert {transfer.numero}</h1>
                                <span className={`text-sm px-2 py-0.5 rounded-full border ${transfer.statut === 'VALIDE'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                                    }`}>
                                    {transfer.statut}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {transfer.statut === 'BROUILLON' && (
                            <button
                                onClick={handleValidate}
                                disabled={validating}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {validating ? 'Validation...' : 'Valider'}
                            </button>
                        )}
                        {/* Printing action can be added here later */}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 grid grid-cols-2 gap-6 border dark:border-gray-700">
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Source</h3>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{warehouses[transfer.sourceWarehouseId] || transfer.sourceWarehouseId}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Destination</h3>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{warehouses[transfer.destinationWarehouseId] || transfer.destinationWarehouseId}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</h3>
                        <p className="text-gray-900 dark:text-white">{new Date(transfer.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Créé par</h3>
                        <p className="text-gray-900 dark:text-white">{transfer.createdBy}</p>
                    </div>
                    {transfer.notes && (
                        <div className="col-span-2">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</h3>
                            <p className="text-gray-900 dark:text-white">{transfer.notes}</p>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Produit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Qté</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {transfer.lignes.map((line: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{products[line.productId] || line.productId}</td>
                                    <td className="px-6 py-4 font-mono text-sm text-gray-900 dark:text-white">{line.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
