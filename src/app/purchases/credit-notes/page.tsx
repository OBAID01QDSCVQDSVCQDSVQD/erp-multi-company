'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { toast } from 'react-hot-toast';
import {
    DocumentTextIcon,
    ArrowPathIcon,
    EyeIcon,
    ArrowDownTrayIcon,
    ArrowLeftIcon,
} from '@heroicons/react/24/outline';

interface CreditNote {
    _id: string;
    numero: string;
    referenceExterne?: string;
    supplierId?: string;
    supplier?: {
        nom?: string;
        prenom?: string;
        raisonSociale?: string;
    };
    dateDoc: string;
    totalTTC: number;
    devise?: string;
    statut?: string;
    notes?: string;
    linkedDocuments?: string[];
}

const formatPrice = (value: number, currency: string = 'TND') =>
    new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 3,
    }).format(value || 0);

const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('fr-FR') : '-';

export default function SupplierCreditNotesPage() {
    const router = useRouter();
    const { tenantId } = useTenantId();
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        if (tenantId) {
            fetchCreditNotes();
        }
    }, [tenantId]);

    const fetchCreditNotes = async () => {
        if (!tenantId) return;
        try {
            setLoading(true);
            const response = await fetch('/api/purchases/credit-notes', {
                headers: {
                    'X-Tenant-Id': tenantId,
                },
            });
            if (response.ok) {
                const data = await response.json();
                setCreditNotes(data.items || []);
            } else {
                const error = await response.json();
                toast.error(error.error || 'Impossible de charger les avoirs');
            }
        } catch (error) {
            console.error('Error fetching credit notes:', error);
            toast.error('Erreur lors du chargement des avoirs');
        } finally {
            setLoading(false);
        }
    };

    const getSupplierName = (supplier: any) => {
        if (!supplier) return 'N/A';
        return supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim() || 'N/A';
    };

    const handleDownloadPdf = async (note: CreditNote) => {
        try {
            setDownloadingId(note._id);
            const response = await fetch(`/api/purchases/credit-notes/${note._id}/pdf`, {
                headers: {
                    'X-Tenant-Id': tenantId || '',
                },
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Avoir-${note.numero}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('PDF téléchargé avec succès');
            } else {
                toast.error('Erreur lors de la génération du PDF');
            }
        } catch (error) {
            console.error('Error printing:', error);
            toast.error('Erreur lors de l\'impression');
        } finally {
            setDownloadingId(null);
        }
    };

    const filteredCreditNotes = creditNotes.filter((note) => {
        if (!q) return true;
        const lowerQ = q.toLowerCase();
        return (
            note.numero.toLowerCase().includes(lowerQ) ||
            getSupplierName(note.supplier).toLowerCase().includes(lowerQ)
        );
    });

    return (
        <DashboardLayout>
            <div className="space-y-6 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            title="Retour à la page précédente"
                        >
                            <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                                <DocumentTextIcon className="w-7 h-7 text-blue-600" />
                                Avoirs Fournisseurs
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Consultez les avoirs générés par les retours ou les annulations.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchCreditNotes}
                            className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                            Rafraîchir
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Rechercher par numéro ou fournisseur..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="w-full pl-4 pr-4 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                    </div>
                ) : filteredCreditNotes.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border dark:border-gray-700 border-dashed">
                        <DocumentTextIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            Aucun avoir trouvé
                        </h3>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Numéro
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Fournisseur
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Montant TTC
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredCreditNotes.map((note) => (
                                        <tr key={note._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                {note.numero}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                {getSupplierName(note.supplier)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                {formatDate(note.dateDoc)}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400">
                                                {formatPrice(note.totalTTC || 0, note.devise)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => router.push(`/purchases/credit-notes/${note._id}`)}
                                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        title="Voir les détails"
                                                    >
                                                        <EyeIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadPdf(note)}
                                                        disabled={downloadingId === note._id}
                                                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 disabled:opacity-50"
                                                        title="Télécharger le PDF"
                                                    >
                                                        {downloadingId === note._id ? (
                                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <ArrowDownTrayIcon className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>


                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-4 p-4">
                            {filteredCreditNotes.map((note) => (
                                <div key={note._id} className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 space-y-3 shadow-sm">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">{note.numero}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                {formatDate(note.dateDoc)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 dark:text-gray-400">Fournisseur :</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{getSupplierName(note.supplier)}</span>
                                        </div>
                                    </div>

                                    <div className="border-t dark:border-gray-700 pt-3 flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400 text-sm">Montant TTC</span>
                                        <span className="font-bold text-green-600 dark:text-green-400">
                                            {formatPrice(note.totalTTC || 0, note.devise)}
                                        </span>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => handleDownloadPdf(note)}
                                            disabled={downloadingId === note._id}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                                        >
                                            {downloadingId === note._id ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Génération...
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                                    PDF
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
