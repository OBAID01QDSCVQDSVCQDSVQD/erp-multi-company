'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, MagnifyingGlassIcon, ArrowPathIcon, EyeIcon, PencilSquareIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import { toast } from 'react-hot-toast';

interface PurchaseReturn {
    _id: string;
    numero: string;
    dateDoc: string;
    supplierId: {
        raisonSociale?: string;
        nom?: string;
        prenom?: string;
    } | undefined;
    brNumero?: string;
    totalTTC: number;
    statut: string;
}

export default function PurchaseReturnsPage() {
    const { tenantId } = useTenantId();
    const [returns, setReturns] = useState<PurchaseReturn[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');

    useEffect(() => {
        if (tenantId) fetchReturns();
    }, [tenantId]);

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (q) params.append('q', q);

            const response = await fetch(`/api/purchases/returns?${params.toString()}`, {
                headers: {
                    'X-Tenant-Id': tenantId || '',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setReturns(data.items || []);
            }
        } catch (error) {
            console.error('Error fetching returns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        try {
            const toastId = toast.loading('Génération du PDF...');
            const response = await fetch(`/api/purchases/returns/${id}/pdf`, {
                headers: {
                    'X-Tenant-Id': tenantId || '',
                },
            });

            toast.dismiss(toastId);

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                window.open(url, '_blank');
            } else {
                toast.error('Erreur lors de la génération du PDF');
            }
        } catch (error) {
            console.error('Error printing:', error);
            toast.error('Erreur lors de l\'impression');
        }
    };

    const getSupplierName = (supplier: any) => {
        if (!supplier) return 'N/A';
        return supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim() || 'N/A';
    };

    const getStatusBadge = (statut: string) => {
        switch (statut) {
            case 'VALIDEE':
                return (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Validé
                    </span>
                );
            case 'BROUILLON':
                return (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        Brouillon
                    </span>
                );
            default:
                return (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {statut || 'Inconnu'}
                    </span>
                );
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Retours Achats</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Gérer les retours de marchandises aux fournisseurs</p>
                    </div>
                    <Link
                        href="/purchases/returns/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Nouveau retour
                    </Link>
                </div>

                {/* Filters */}
                <div className="flex gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par numéro, fournisseur..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchReturns()}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={fetchReturns}
                        className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* List - Desktop */}
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Numéro
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Fournisseur
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        BR Lié
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Total TTC
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Statut
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : returns.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            Aucun retour achat trouvé
                                        </td>
                                    </tr>
                                ) : (
                                    returns.map((ret) => (
                                        <tr key={ret._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                {ret.numero}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(ret.dateDoc).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {getSupplierName(ret.supplierId)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {ret.brNumero || '—'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-white">
                                                {ret.totalTTC.toFixed(3)} TND
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {getStatusBadge(ret.statut)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={(e) => handlePrint(ret._id, e)}
                                                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                                                        title="Imprimer"
                                                    >
                                                        <PrinterIcon className="h-5 w-5" />
                                                    </button>
                                                    <Link
                                                        href={`/purchases/returns/${ret._id}/edit`}
                                                        className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
                                                        title="Modifier"
                                                    >
                                                        <PencilSquareIcon className="h-5 w-5" />
                                                    </Link>
                                                    <Link
                                                        href={`/purchases/returns/${ret._id}`}
                                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                                        title="Voir détails"
                                                    >
                                                        <EyeIcon className="h-5 w-5" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* List - Mobile (Cards) */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : returns.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
                            Aucun retour achat trouvé
                        </div>
                    ) : (
                        returns.map((ret) => (
                            <div key={ret._id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700 space-y-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-lg font-bold text-gray-900 dark:text-white">{ret.numero}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(ret.dateDoc).toLocaleDateString('fr-FR')}
                                        </div>
                                    </div>
                                    {getStatusBadge(ret.statut)}
                                </div>

                                <div className="text-sm">
                                    <div className="flex justify-between py-1">
                                        <span className="text-gray-500 dark:text-gray-400">Fournisseur:</span>
                                        <span className="font-medium text-gray-900 dark:text-white text-right max-w-[60%] truncate">
                                            {getSupplierName(ret.supplierId)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-gray-500 dark:text-gray-400">BR Lié:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{ret.brNumero || '—'}</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span className="text-gray-500 dark:text-gray-400">Total TTC:</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{ret.totalTTC.toFixed(3)} TND</span>
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                                    <button
                                        onClick={(e) => handlePrint(ret._id, e)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        <PrinterIcon className="h-4 w-4" />
                                        Imprimer
                                    </button>
                                    <Link
                                        href={`/purchases/returns/${ret._id}/edit`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        <PencilSquareIcon className="h-4 w-4" />
                                        Modifier
                                    </Link>
                                    <Link
                                        href={`/purchases/returns/${ret._id}`}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg transition-colors text-sm font-medium"
                                    >
                                        <EyeIcon className="h-4 w-4" />
                                        Détails
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
