'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
    ArrowLeftIcon,
    PrinterIcon,
    CheckCircleIcon,
    XCircleIcon,
    TruckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useTenantId } from '@/hooks/useTenantId';

interface OrderDetail {
    _id: string;
    numero: string;
    dateDoc: string;
    dateLivraisonPrevue?: string;
    statut: string;
    customerId: {
        _id: string;
        raisonSociale: string;
        nom?: string;
        prenom?: string;
        email?: string;
        telephone?: string;
        adresseFacturation?: {
            ligne1: string;
            ville: string;
            codePostal: string;
        }
    };
    notes?: string;
    referenceExterne?: string;
    modePaiement?: string;
    lignes: Array<{
        productId: string;
        designation: string;
        quantite: number;
        uomCode: string;
        prixUnitaireHT: number;
        remisePct: number;
        tvaPct: number;
    }>;
    totalBaseHT: number;
    totalTVA: number;
    totalTTC: number;
    remiseGlobalePct?: number;
    fodec?: {
        enabled: boolean;
        tauxPct: number;
        montant: number;
    };
    timbreFiscal?: number;
    devise: string;
}

export default function OrderDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { tenantId } = useTenantId();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusLoading, setStatusLoading] = useState(false);

    useEffect(() => {
        if (tenantId) fetchOrder();
    }, [tenantId, params.id]);

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/sales/orders/${params.id}`, {
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (res.ok) {
                const data = await res.json();
                if (typeof data.customerId === 'string') {
                    const custRes = await fetch(`/api/customers/${data.customerId}`, {
                        headers: { 'X-Tenant-Id': tenantId || '' }
                    });
                    if (custRes.ok) {
                        data.customerId = await custRes.json();
                    }
                }
                setOrder(data);
            } else {
                toast.error('Commande introuvable');
                router.push('/sales/orders');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!confirm(`Voulez-vous vraiment changer le statut en "${newStatus}" ?`)) return;

        setStatusLoading(true);
        try {
            const res = await fetch(`/api/sales/orders/${params.id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId || ''
                },
                body: JSON.stringify({ statut: newStatus })
            });

            if (res.ok) {
                toast.success(`Statut mis à jour : ${newStatus}`);
                fetchOrder();
            } else {
                toast.error('Erreur lors de la mise à jour du statut');
            }
        } catch (e) {
            console.error(e);
            toast.error('Erreur serveur');
        } finally {
            setStatusLoading(false);
        }
    };

    const downloadPDF = async () => {
        toast("Génération PDF en cours...", { icon: '🖨️' });
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!order) return null;

    const StatusBadge = ({ status }: { status: string }) => {
        const styles = {
            VALIDEE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
            BROUILLON: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
            LIVREE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
            ANNULEE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        };
        const style = styles[status as keyof typeof styles] || styles.BROUILLON;
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${style}`}>
                {status}
            </span>
        );
    };

    const getLineTotalHT = (line: any) => {
        return line.quantite * line.prixUnitaireHT * (1 - (line.remisePct || 0) / 100);
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
                {/* Header Navigation & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" /> Retour
                    </button>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {order.statut !== 'ANNULEE' && (
                            <>
                                {order.statut !== 'VALIDEE' && order.statut !== 'LIVREE' && (
                                    <button
                                        onClick={() => handleStatusChange('VALIDEE')}
                                        disabled={statusLoading}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm text-sm font-medium"
                                    >
                                        <CheckCircleIcon className="w-5 h-5" /> Valider
                                    </button>
                                )}
                                {order.statut === 'VALIDEE' && (
                                    <button
                                        onClick={() => handleStatusChange('LIVREE')}
                                        disabled={statusLoading}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm text-sm font-medium"
                                    >
                                        <TruckIcon className="w-5 h-5" /> Livrée
                                    </button>
                                )}
                                <button
                                    onClick={() => handleStatusChange('ANNULEE')}
                                    disabled={statusLoading}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors text-sm font-medium"
                                >
                                    <XCircleIcon className="w-5 h-5" /> Annuler
                                </button>
                            </>
                        )}

                        <button
                            onClick={downloadPDF}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium"
                        >
                            <PrinterIcon className="w-5 h-5" /> Imprimer
                        </button>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">

                    {/* Title & Status */}
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                Commande {order.numero}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Créée le {new Date(order.dateDoc).toLocaleDateString()}
                            </p>
                        </div>
                        <StatusBadge status={order.statut} />
                    </div>

                    {/* Info Grid */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Customer Info */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Client</h3>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-xl border border-gray-100 dark:border-gray-600/50">
                                <div className="font-bold text-lg text-gray-900 dark:text-white mb-2">
                                    {order.customerId.raisonSociale || `${order.customerId.nom} ${order.customerId.prenom}`}
                                </div>
                                <div className="text-gray-600 dark:text-gray-300 space-y-1.5 text-sm">
                                    {order.customerId.email && (
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-70">✉️</span> {order.customerId.email}
                                        </div>
                                    )}
                                    {order.customerId.telephone && (
                                        <div className="flex items-center gap-2">
                                            <span className="opacity-70">📞</span> {order.customerId.telephone}
                                        </div>
                                    )}
                                    {order.customerId.adresseFacturation && (
                                        <div className="flex items-start gap-2">
                                            <span className="opacity-70 mt-0.5">📍</span>
                                            <span>
                                                {order.customerId.adresseFacturation.ligne1}, {order.customerId.adresseFacturation.ville} {order.customerId.adresseFacturation.codePostal}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Order Details */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Détails</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-600/30">
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Livraison Prévue</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {order.dateLivraisonPrevue ? new Date(order.dateLivraisonPrevue).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-600/30">
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Référence Externe</span>
                                    <span className="font-semibold text-gray-900 dark:text-white truncate" title={order.referenceExterne}>
                                        {order.referenceExterne || '—'}
                                    </span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-600/30">
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Mode de Paiement</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {order.modePaiement || '—'}
                                    </span>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-600/30">
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Devise</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {order.devise}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lines Section */}
                    <div className="border-t border-gray-200 dark:border-gray-700">
                        <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Lignes de commande</h3>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4">Produit</th>
                                        <th className="px-6 py-4 text-center">Qté</th>
                                        <th className="px-6 py-4 text-right">Prix HT</th>
                                        <th className="px-6 py-4 text-center">Remise</th>
                                        <th className="px-6 py-4 text-center">TVA</th>
                                        <th className="px-6 py-4 text-right">Total HT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                    {order.lignes.map((line, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900 dark:text-white line-clamp-2">{line.designation}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-700 dark:text-gray-300">
                                                <span className="font-medium">{line.quantite}</span> <span className="text-xs text-gray-500">{line.uomCode}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300 font-mono">
                                                {line.prixUnitaireHT.toFixed(3)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {line.remisePct > 0 ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                                        -{line.remisePct}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300 dark:text-gray-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                                                {line.tvaPct}%
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white font-mono">
                                                {getLineTotalHT(line).toFixed(3)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards (Stack) */}
                        <div className="md:hidden space-y-4 p-4 bg-gray-50 dark:bg-gray-900/20">
                            {order.lignes.map((line, idx) => (
                                <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">{line.designation}</div>

                                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                                        <div className="text-gray-500 dark:text-gray-400">Quantité:</div>
                                        <div className="text-right font-medium text-gray-900 dark:text-white">{line.quantite} {line.uomCode}</div>

                                        <div className="text-gray-500 dark:text-gray-400">Prix Unit. HT:</div>
                                        <div className="text-right font-mono text-gray-700 dark:text-gray-300">{line.prixUnitaireHT.toFixed(3)}</div>

                                        {line.remisePct > 0 && (
                                            <>
                                                <div className="text-gray-500 dark:text-gray-400">Remise:</div>
                                                <div className="text-right text-red-600 dark:text-red-400 font-medium utterly-red">-{line.remisePct}%</div>
                                            </>
                                        )}

                                        <div className="text-gray-500 dark:text-gray-400">TVA:</div>
                                        <div className="text-right text-gray-700 dark:text-gray-300">{line.tvaPct}%</div>

                                        <div className="col-span-2 border-t border-gray-100 dark:border-gray-700 mt-2 pt-2 flex justify-between items-center">
                                            <span className="font-bold text-gray-700 dark:text-gray-300">Total HT</span>
                                            <span className="font-bold text-lg text-gray-900 dark:text-white font-mono">{getLineTotalHT(line).toFixed(3)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Totals Section */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col md:items-end">
                            <div className="w-full md:w-1/2 lg:w-1/3 space-y-3">
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                    <span>Total HT</span>
                                    <span className="font-medium text-gray-900 dark:text-white font-mono">{order.totalBaseHT?.toFixed(3)} {order.devise}</span>
                                </div>
                                {order.remiseGlobalePct && order.remiseGlobalePct > 0 ? (
                                    <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                                        <span>Remise Globale ({order.remiseGlobalePct}%)</span>
                                        <span className="font-mono">- {(order.totalBaseHT * (order.remiseGlobalePct / 100)).toFixed(3)} {order.devise}</span>
                                    </div>
                                ) : null}
                                {order.fodec && order.fodec.enabled && (
                                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                        <span>FODEC (1%)</span>
                                        <span className="font-medium text-gray-900 dark:text-white font-mono">{order.fodec?.montant?.toFixed(3)} {order.devise}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                    <span>Total TVA</span>
                                    <span className="font-medium text-gray-900 dark:text-white font-mono">{order.totalTVA?.toFixed(3)} {order.devise}</span>
                                </div>
                                {order.timbreFiscal && order.timbreFiscal > 0 && (
                                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                        <span>Timbre Fiscal</span>
                                        <span className="font-medium text-gray-900 dark:text-white font-mono">{order.timbreFiscal.toFixed(3)} {order.devise}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-600 pt-4 mt-2">
                                    <span>Total TTC</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-mono">{order.totalTTC?.toFixed(3)} {order.devise}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Notes */}
                    {order.notes && (
                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">Notes</h4>
                            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50">
                                {order.notes}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
