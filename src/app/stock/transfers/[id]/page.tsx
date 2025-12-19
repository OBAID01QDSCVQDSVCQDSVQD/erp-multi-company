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

    if (loading) return <DashboardLayout><div>Chargement...</div></DashboardLayout>;
    if (error) return <DashboardLayout><div className="p-8 text-center text-red-600 font-bold bg-white m-6 rounded shadow">Erreur: {error}</div></DashboardLayout>;
    if (!transfer) return <DashboardLayout><div>Introuvable</div></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6 max-w-5xl mx-auto">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold">Transfert {transfer.numero}</h1>
                            <span className={`text-sm px-2 py-0.5 rounded-full ${transfer.statut === 'VALIDE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                {transfer.statut}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {transfer.statut === 'BROUILLON' && (
                            <button
                                onClick={handleValidate}
                                disabled={validating}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                            >
                                <CheckIcon className="w-5 h-5" />
                                {validating ? 'Validation...' : 'Valider'}
                            </button>
                        )}
                        {/* Printing action can be added here later */}
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6 grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Source</h3>
                        <p className="text-lg font-semibold">{warehouses[transfer.sourceWarehouseId] || transfer.sourceWarehouseId}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Destination</h3>
                        <p className="text-lg font-semibold">{warehouses[transfer.destinationWarehouseId] || transfer.destinationWarehouseId}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Date</h3>
                        <p>{new Date(transfer.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-500">Créé par</h3>
                        <p>{transfer.createdBy}</p>
                    </div>
                    {transfer.notes && (
                        <div className="col-span-2">
                            <h3 className="text-sm font-medium text-gray-500">Notes</h3>
                            <p>{transfer.notes}</p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qté</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {transfer.lignes.map((line: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="px-6 py-4">{products[line.productId] || line.productId}</td>
                                    <td className="px-6 py-4 font-mono">{line.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
