'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    PlusIcon,
    FunnelIcon,
    DocumentArrowDownIcon,
    ChatBubbleLeftEllipsisIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    CheckIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';

interface Warranty {
    _id: string;
    certificateNumber: string;
    templateId: { _id: string; name: string };
    customerId?: { _id: string; raisonSociale: string; nom: string; prenom: string; telephone?: string; mobile?: string };
    date: string;
    status: 'active' | 'expired' | 'void';
}

export default function WarrantyListPage() {
    const { data: session } = useSession();
    const [warranties, setWarranties] = useState<Warranty[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingWhatsApp, setProcessingWhatsApp] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        status: '',
        search: ''
    });
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [includeStamp, setIncludeStamp] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);

    useEffect(() => {
        if (session) {
            fetchWarranties();
        }
    }, [filters, session]);

    const fetchWarranties = async () => {
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);

            const res = await fetch(`/api/documents/warranties?${params.toString()}`, {
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });
            if (res.ok) {
                const data = await res.json();
                setWarranties(data);
            }
        } catch (error) {
            console.error('Error fetching warranties:', error);
            toast.error('Erreur lors du chargement des garanties');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadClick = (warranty: Warranty) => {
        setSelectedWarranty(warranty);
        setShowPrintModal(true);
    };

    const confirmDownloadPDF = async () => {
        if (!selectedWarranty) return;

        setIsGeneratingPdf(true);
        try {
            const res = await fetch(`/api/documents/warranties/${selectedWarranty._id}/pdf?includeStamp=${includeStamp}`, {
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Garantie-${selectedWarranty.certificateNumber}.pdf`;
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
            setSelectedWarranty(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400">Actif</span>;
            case 'expired':
                return <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400">Expiré</span>;
            case 'void':
                return <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-900/20 dark:text-gray-400">Annulé</span>;
            default:
                return null;
        }
    };

    const getCustomerName = (customer: any) => {
        if (!customer) return 'Client Passager';
        return customer.raisonSociale || `${customer.prenom} ${customer.nom}`;
    };

    const handleWhatsApp = async (warranty: Warranty) => {
        if (!warranty.customerId) {
            toast.error('Aucun client associé');
            return;
        }

        const customer = warranty.customerId as any; // Type casting for safety if interface mismatches
        const phoneNumber = customer.mobile || customer.telephone;
        if (!phoneNumber) {
            toast.error('Aucun numéro de téléphone trouvé pour ce client');
            return;
        }

        // Clean number (Tunisia format assumption)
        let clean = phoneNumber.replace(/\D/g, '');
        if (clean.length === 8) clean = '216' + clean;

        setProcessingWhatsApp(warranty._id);
        try {
            const res = await fetch(`/api/documents/warranties/${warranty._id}/share`, {
                method: 'POST'
            });

            if (res.ok) {
                const data = await res.json();
                // Use short public link
                const link = `${window.location.origin}/w/${data.token}`;
                const message = `Bonjour, veuillez trouver ci-joint votre certificat de garantie ${warranty.certificateNumber} :\n${link}`;

                window.open(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`, '_blank');
            } else {
                toast.error('Erreur lors de la génération du lien de partage');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erreur lors du partage');
        } finally {
            setProcessingWhatsApp(null);
        }
    };

    return (
        <DashboardLayout>
            <div className="px-4 py-8 sm:px-6 lg:px-8">
                <div className="sm:flex sm:items-center">
                    <div className="sm:flex-auto">
                        <h1 className="text-2xl font-semibold leading-6 text-gray-900 dark:text-white">Garanties</h1>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
                            Liste des certificats de garantie générés.
                        </p>
                    </div>
                    <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                        <Link
                            href="/documents/warranties/new"
                            className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <PlusIcon className="h-4 w-4" />
                                Nouvelle Garantie
                            </span>
                        </Link>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="w-full">
                        <label htmlFor="search" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Recherche</label>
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                id="search"
                                placeholder="Numéro, client..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="block w-full pl-9 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                            />
                        </div>
                    </div>
                    <div className="w-full">
                        <label htmlFor="status" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Statut</label>
                        <select
                            id="status"
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                        >
                            <option value="">Tous les statuts</option>
                            <option value="active">Actif</option>
                            <option value="expired">Expiré</option>
                            <option value="void">Annulé</option>
                        </select>
                    </div>
                </div>

                <div className="mt-8 flow-root">
                    <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                                                Numéro
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Date
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Client
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Modèle
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Statut
                                            </th>
                                            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right font-semibold text-gray-900 dark:text-white sm:pr-6">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="py-10 text-center">
                                                    <div className="flex justify-center">
                                                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : warranties.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-10 text-center text-gray-500 dark:text-gray-400">
                                                    Aucune garantie trouvée.
                                                </td>
                                            </tr>
                                        ) : (
                                            warranties.map((warranty) => (
                                                <tr key={warranty._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-blue-600 dark:text-blue-400 sm:pl-6">
                                                        <Link href={`/documents/warranties/${warranty._id}`}>
                                                            {warranty.certificateNumber}
                                                        </Link>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(warranty.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                        {getCustomerName(warranty.customerId)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                        {warranty.templateId?.name}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                        {getStatusBadge(warranty.status)}
                                                    </td>
                                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                        <div className="flex justify-end gap-3">
                                                            <button
                                                                onClick={() => handleDownloadClick(warranty)}
                                                                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                                                                title="Télécharger PDF"
                                                            >
                                                                <DocumentArrowDownIcon className="h-5 w-5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleWhatsApp(warranty)}
                                                                disabled={processingWhatsApp === warranty._id}
                                                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                                                                title="Envoyer par WhatsApp"
                                                            >
                                                                {processingWhatsApp === warranty._id ? (
                                                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                                                                ) : (
                                                                    <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
                                                                )}
                                                            </button>
                                                            <Link href={`/documents/warranties/${warranty._id}`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                                                                Voir<span className="sr-only">, {warranty.certificateNumber}</span>
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
                    </div>
                </div>
            </div>

            {/* Print Settings Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-l-xl rounded-r-xl sm:rounded-2xl max-w-md w-full shadow-2xl transform transition-all scale-100 opacity-100">
                        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <DocumentArrowDownIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
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
                                        <DocumentArrowDownIcon className="w-4 h-4" />
                                    )}
                                    {isGeneratingPdf ? 'Génération...' : 'Télécharger PDF'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Imports needed: CheckIcon, XMarkIcon which were added in previous edits but might need fresh input if not present */}
        </DashboardLayout>
    );
}
