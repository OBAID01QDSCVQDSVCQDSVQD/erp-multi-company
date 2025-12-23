'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface ReturnLine {
    productId: string;
    reference: string;
    designation: string;
    quantite: number;
    uom: string;
    prixUnitaireHT: number;
    remisePct: number;
    tvaPct: number;
    totalLigneHT: number;
}

interface PurchaseReturn {
    _id: string;
    numero: string;
    dateDoc: string;
    supplier?: {
        nom?: string;
        prenom?: string;
        raisonSociale?: string;
        email?: string;
        telephone?: string;
        adresse?: {
            rue?: string;
            ville?: string;
            codePostal?: string;
            pays?: string;
        };
    };
    brInfo?: {
        numero: string;
        dateDoc: string;
    };
    warehouseName?: string;
    lignes: ReturnLine[];
    totalBaseHT: number;
    totalTVA: number;
    totalTTC: number;
    notes?: string;
    statut: string;
}

export default function PurchaseReturnDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { tenantId } = useTenantId();
    const { id } = params;

    const [returnDoc, setReturnDoc] = useState<PurchaseReturn | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (tenantId && id) {
            fetchReturnDetails();
        }
    }, [tenantId, id]);

    const fetchReturnDetails = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/purchases/returns/${id}`, {
                headers: {
                    'X-Tenant-Id': tenantId || '',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setReturnDoc(data);
            } else {
                toast.error('Erreur lors du chargement du retour');
                router.push('/purchases/returns');
            }
        } catch (error) {
            console.error('Error fetching return details:', error);
            toast.error('Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        toast('Fonctionnalité d\'impression à venir');
        // TODO: Implement PDF generation
    };

    const getSupplierName = (supplier: any) => {
        if (!supplier) return 'N/A';
        return supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim() || 'N/A';
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!returnDoc) return null;

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6 max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-300"
                        >
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                {returnDoc.numero}
                                <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                                    Validé
                                </span>
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Créé le {new Date(returnDoc.dateDoc).toLocaleDateString('fr-FR')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <PrinterIcon className="w-5 h-5" />
                        Imprimer
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Supplier Info */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Fournisseur</h2>
                        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                            <p className="font-medium text-base text-gray-900 dark:text-white">
                                {getSupplierName(returnDoc.supplier)}
                            </p>
                            {returnDoc.supplier?.email && <p>Email: {returnDoc.supplier.email}</p>}
                            {returnDoc.supplier?.telephone && <p>Tél: {returnDoc.supplier.telephone}</p>}
                            {returnDoc.supplier?.adresse && (
                                <p>
                                    {[
                                        returnDoc.supplier.adresse.rue,
                                        returnDoc.supplier.adresse.ville,
                                        returnDoc.supplier.adresse.codePostal,
                                        returnDoc.supplier.adresse.pays
                                    ].filter(Boolean).join(', ')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* General Info */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Informations</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Bon de Réception</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {returnDoc.brInfo ? `${returnDoc.brInfo.numero} du ${new Date(returnDoc.brInfo.dateDoc).toLocaleDateString('fr-FR')}` : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Entrepôt source</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {returnDoc.warehouseName || 'Défaut'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Notes</span>
                                <span className="font-medium text-gray-900 dark:text-white italic">
                                    {returnDoc.notes || 'Aucune'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lines */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Articles retournés</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Désignation</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Quantité</th>
                                    <th className="hidden md:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">P.U HT</th>
                                    <th className="hidden md:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Remise</th>
                                    <th className="hidden md:table-cell px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">TVA</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total HT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {returnDoc.lignes.map((line, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{line.designation || 'Article inconnu'}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{line.reference || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                                            {line.quantite ?? 0} {line.uom || ''}
                                        </td>
                                        <td className="hidden md:table-cell px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                                            {(line.prixUnitaireHT ?? 0).toFixed(3)}
                                        </td>
                                        <td className="hidden md:table-cell px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                                            {line.remisePct ? `${line.remisePct}%` : '-'}
                                        </td>
                                        <td className="hidden md:table-cell px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                                            {line.tvaPct ?? 0}%
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                                            {(line.totalLigneHT ?? 0).toFixed(3)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                    <div className="w-full md:w-1/3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Total HT</span>
                            <span className="font-medium text-gray-900 dark:text-white">{(returnDoc.totalBaseHT || 0).toFixed(3)} TND</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Total TVA</span>
                            <span className="font-medium text-gray-900 dark:text-white">{(returnDoc.totalTVA || 0).toFixed(3)} TND</span>
                        </div>
                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between text-base font-bold text-indigo-600 dark:text-indigo-400">
                            <span>Total TTC</span>
                            <span>{(returnDoc.totalTTC || 0).toFixed(3)} TND</span>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
