'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function StockTransfersPage() {
    const router = useRouter();
    const { tenantId } = useTenantId();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [warehouses, setWarehouses] = useState<Record<string, string>>({});

    useEffect(() => {
        if (tenantId) {
            fetchTransfers();
            fetchWarehouses();
        }
    }, [tenantId]);

    async function fetchWarehouses() {
        try {
            const res = await fetch('/api/stock/warehouses', {
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (res.ok) {
                const data = await res.json();
                const map: Record<string, string> = {};
                data.forEach((w: any) => map[w._id] = w.name);
                setWarehouses(map);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchTransfers() {
        setLoading(true);
        try {
            const response = await fetch('/api/stock/transfers', {
                headers: { 'X-Tenant-Id': tenantId || '' },
            });
            if (response.ok) {
                setTransfers(await response.json());
            } else {
                toast.error('Erreur chargement transferts');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erreur connexion');
        } finally {
            setLoading(false);
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'VALIDE': return 'bg-green-100 text-green-800';
            case 'ANNULE': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <h1 className="text-2xl font-bold">Transferts de Stock</h1>
                    </div>
                    <Link
                        href="/stock/transfers/new"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Nouveau Transfert
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-10">Chargement...</div>
                ) : transfers.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">Aucun transfert trouvé.</div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {transfers.map((t) => (
                                    <tr key={t._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium">{t.numero}</td>
                                        <td className="px-6 py-4">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">{warehouses[t.sourceWarehouseId] || t.sourceWarehouseId}</td>
                                        <td className="px-6 py-4">{warehouses[t.destinationWarehouseId] || t.destinationWarehouseId}</td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={t.statut}
                                                onChange={async (e) => {
                                                    const newStatus = e.target.value;
                                                    if (t.statut === 'VALIDE') {
                                                        toast.error('Modification impossible (Déjà validé)');
                                                        fetchTransfers(); // Reset UI
                                                        return;
                                                    }

                                                    if (newStatus === 'VALIDE') {
                                                        if (!confirm('Valider ce transfert ? Cette action mettra à jour le stock.')) {
                                                            fetchTransfers(); return;
                                                        }
                                                        try {
                                                            const res = await fetch(`/api/stock/transfers/${t._id}/validate`, {
                                                                method: 'POST',
                                                                headers: { 'X-Tenant-Id': tenantId || '' }
                                                            });
                                                            if (res.ok) {
                                                                toast.success('Transfert validé');
                                                                fetchTransfers();
                                                            } else {
                                                                const err = await res.json();
                                                                toast.error(err.error || 'Erreur validation');
                                                                fetchTransfers();
                                                            }
                                                        } catch (e) { toast.error('Erreur connexion'); fetchTransfers(); }
                                                    } else if (newStatus === 'ANNULE') {
                                                        if (!confirm('Voulez-vous annuler ce transfert ?')) {
                                                            fetchTransfers(); return;
                                                        }
                                                        try {
                                                            const res = await fetch(`/api/stock/transfers/${t._id}`, {
                                                                method: 'PATCH',
                                                                headers: { 'X-Tenant-Id': tenantId || '', 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ statut: 'ANNULE' })
                                                            });
                                                            if (res.ok) {
                                                                toast.success('Transfert annulé');
                                                                fetchTransfers();
                                                            } else {
                                                                toast.error('Erreur lors de l\'annulation');
                                                                fetchTransfers();
                                                            }
                                                        } catch (e) { toast.error('Erreur serveur'); fetchTransfers(); }
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded text-xs font-semibold border-none cursor-pointer focus:ring-2 focus:ring-blue-500 ${getStatusColor(t.statut)}`}
                                                disabled={t.statut === 'VALIDE' || t.statut === 'ANNULE'}
                                            >
                                                <option value="BROUILLON">BROUILLON</option>
                                                <option value="VALIDE">VALIDE</option>
                                                <option value="ANNULE">ANNULE</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={`/stock/transfers/${t._id}`} className="text-blue-600 hover:text-blue-900">
                                                Voir
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
