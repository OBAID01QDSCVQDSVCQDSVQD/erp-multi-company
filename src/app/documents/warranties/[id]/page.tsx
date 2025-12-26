'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
    ArrowLeftIcon,
    PrinterIcon,
    NoSymbolIcon,
    ArrowDownTrayIcon,
    CheckIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';

export default function WarrantyDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { data: session } = useSession();
    const [warranty, setWarranty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [includeStamp, setIncludeStamp] = useState(true);

    useEffect(() => {
        if (session) {
            fetchWarranty();
        }
    }, [params.id, session]);

    const handleDownloadPDF = () => {
        setShowPrintModal(true);
    };

    const confirmDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        try {
            const res = await fetch(`/api/documents/warranties/${params.id}/pdf?includeStamp=${includeStamp}`, {
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Garantie-${warranty.certificateNumber}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                toast.error('Erreur lors de la génération du PDF');
            }
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Erreur lors du téléchargement');
        } finally {
            setIsGeneratingPdf(false);
            setShowPrintModal(false);
        }
    };

    const fetchWarranty = async () => {
        try {
            const res = await fetch(`/api/documents/warranties/${params.id}`, {
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });
            if (res.ok) {
                const data = await res.json();
                setWarranty(data);
            } else {
                toast.error('Garantie introuvable');
                router.push('/documents/warranties');
            }
        } catch (error) {
            console.error('Error fetching warranty:', error);
            toast.error('Erreur de chargement');
        } finally {
            setLoading(false);
        }
    };

    const handleVoid = async () => {
        if (!confirm('Êtes-vous sûr de vouloir annuler cette garantie ? Cette action est irréversible.')) return;

        try {
            const res = await fetch(`/api/documents/warranties/${params.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                },
                body: JSON.stringify({ status: 'void' })
            });

            if (res.ok) {
                toast.success('Garantie annulée');
                fetchWarranty();
            } else {
                toast.error('Erreur lors de l\'annulation');
            }
        } catch (error) {
            console.error('Error voiding warranty:', error);
            toast.error('Erreur serveur');
        }
    };



    if (loading) return <div className="p-8 text-center">Chargement...</div>;
    if (!warranty) return null;

    const { templateId: template, customerId: customer } = warranty;

    return (
        <DashboardLayout>
            <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-5xl mx-auto">
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/documents/warranties" className="p-2 -ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            <ArrowLeftIcon className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="opacity-50 font-normal">Garantie</span> {warranty.certificateNumber}
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 font-medium">
                                Créée le {new Date(warranty.date).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {warranty.status === 'active' && (
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => router.push(`/documents/warranties/new?edit=${params.id}`)}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-700 transition-all"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                    </svg>
                                    Modifier
                                </button>
                                <button
                                    onClick={handleVoid}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 transition-all"
                                >
                                    <NoSymbolIcon className="h-4 w-4" />
                                    Annuler
                                </button>
                            </div>
                        )}
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPdf}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isGeneratingPdf ? (
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <PrinterIcon className="h-4 w-4" />
                            )}
                            {isGeneratingPdf ? 'Génération...' : 'Imprimer'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Customer & Template */}
                        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Informations</h3>
                            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Client</dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                                        {customer ? (customer.raisonSociale || `${customer.prenom} ${customer.nom}`) : 'Client Passager'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Modèle Appliqué</dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                                        {template?.name || 'Inconnu'}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-medium text-gray-500">Statut</dt>
                                    <dd className="mt-1">
                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${warranty.status === 'active' ? 'bg-green-100 text-green-700' :
                                            warranty.status === 'void' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {warranty.status === 'active' ? 'Valide' : warranty.status === 'void' ? 'Annulée' : 'Expirée'}
                                        </span>
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        {/* Items */}
                        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Articles Couverts</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Produit</th>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">N° Série</th>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Durée</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:border-gray-700">
                                        {warranty.items.map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">{item.productName}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">{item.serialNumber || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.warrantyPeriod}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {/* Exclusive Advantages */}
                        {(warranty.exclusiveAdvantages || template?.exclusiveAdvantages) && (
                            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-blue-50/30 dark:bg-blue-900/10">
                                    <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Avantage exclusif</h3>
                                </div>
                                <div className="p-6">
                                    <div
                                        className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300"
                                        dangerouslySetInnerHTML={{ __html: warranty.exclusiveAdvantages || template?.exclusiveAdvantages || '' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Warranty Conditions */}
                        {(warranty.content || template?.content) && (
                            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Conditions de garantie</h3>
                                </div>
                                <div className="p-6">
                                    <div
                                        className="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-gray-300"
                                        dangerouslySetInnerHTML={{ __html: warranty.content || template?.content || '' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dynamic Fields Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Détails Spécifiques</h3>
                            <div className="space-y-4">
                                {template?.fields?.map((field: any) => (
                                    <div key={field.id} className="border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0 last:pb-0">
                                        <dt className="text-xs font-medium text-gray-500 uppercase">{field.label}</dt>
                                        <dd className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                                            {warranty.data?.[field.id] !== undefined ? String(warranty.data[field.id]) : '-'}
                                        </dd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Settings Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-l-xl rounded-r-xl sm:rounded-2xl max-w-md w-full shadow-2xl transform transition-all scale-100 opacity-100">
                        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <PrinterIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                Options d'impression
                            </h3>
                            <button
                                onClick={() => setShowPrintModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                Voulez-vous inclure le cachet de l'entreprise sur le document ?
                            </p>

                            <div
                                className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-6 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => setIncludeStamp(!includeStamp)}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeStamp ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white dark:bg-gray-600'}`}>
                                    {includeStamp && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div className="flex-1">
                                    <label className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer select-none block">
                                        Inclure le cachet / signature
                                    </label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Ajoute le tampon officiel en bas du document
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowPrintModal(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium border border-gray-200 dark:border-gray-700"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDownloadPDF}
                                    disabled={isGeneratingPdf}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-lg shadow-blue-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isGeneratingPdf ? (
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <ArrowDownTrayIcon className="w-4 h-4" />
                                    )}
                                    {isGeneratingPdf ? 'Génération...' : 'Télécharger PDF'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
