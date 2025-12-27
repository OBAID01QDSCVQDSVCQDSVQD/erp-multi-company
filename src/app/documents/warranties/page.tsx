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
    CheckIcon,
    PhoneIcon
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

    // WhatsApp Modal State
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsAppNumber, setWhatsAppNumber] = useState('');
    const [selectedWarrantyForWhatsApp, setSelectedWarrantyForWhatsApp] = useState<Warranty | null>(null);
    const [clientSearchQuery, setClientSearchQuery] = useState('');
    const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
    const [searchingClients, setSearchingClients] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

    // Client Search Effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (clientSearchQuery.trim()) {
                setSearchingClients(true);
                try {
                    const res = await fetch(`/api/search?q=${encodeURIComponent(clientSearchQuery)}&type=client`, {
                        headers: { 'X-Tenant-Id': (session?.user as any)?.companyId || '' }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setClientSearchResults(Array.isArray(data) ? data : data.results || []);
                    }
                } catch (error) {
                    console.error("Error searching clients", error);
                } finally {
                    setSearchingClients(false);
                }
            } else {
                setClientSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [clientSearchQuery, session]);

    const handleWhatsAppClick = (warranty: Warranty) => {
        setSelectedWarrantyForWhatsApp(warranty);
        setWhatsAppNumber('');
        setIncludeStamp(true);

        // Pre-fill number if available
        if (warranty.customerId) {
            const customer = warranty.customerId as any;
            let phone = customer.mobile || customer.telephone || '';
            let clean = phone.replace(/\D/g, '');
            if (clean.length === 8) clean = '216' + clean;
            setWhatsAppNumber(clean);
        }

        setShowWhatsAppModal(true);
    };

    const confirmWhatsAppSend = async () => {
        if (!selectedWarrantyForWhatsApp || !whatsAppNumber) return;

        setIsSendingWhatsApp(true);
        try {
            // Clean number
            let numberToSend = whatsAppNumber.replace(/\D/g, '');
            if (numberToSend.length === 8) numberToSend = '216' + numberToSend;

            // Generate public link
            const res = await fetch(`/api/documents/warranties/${selectedWarrantyForWhatsApp._id}/share`, {
                method: 'POST',
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });

            if (res.ok) {
                const data = await res.json();
                const link = `${window.location.origin}/w/${data.token}?withStamp=${includeStamp}`;

                // Construct message
                const customer = selectedWarrantyForWhatsApp.customerId as any;
                const customerName = customer ? (customer.raisonSociale || `${customer.nom} ${customer.prenom}`) : 'Client';
                const message = `Bonjour ${customerName}, veuillez trouver ci-joint votre certificat de garantie ${selectedWarrantyForWhatsApp.certificateNumber} :\n${link}`;

                // Open WhatsApp
                window.open(`https://wa.me/${numberToSend}?text=${encodeURIComponent(message)}`, '_blank');
                setShowWhatsAppModal(false);
            } else {
                toast.error('Erreur lors de la génération du lien');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erreur lors de l\'envoi');
        } finally {
            setIsSendingWhatsApp(false);
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
                                                                onClick={() => handleWhatsAppClick(warranty)}
                                                                disabled={isSendingWhatsApp && selectedWarrantyForWhatsApp?._id === warranty._id}
                                                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                                                                title="Envoyer par WhatsApp"
                                                            >
                                                                {isSendingWhatsApp && selectedWarrantyForWhatsApp?._id === warranty._id ? (
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

            {/* WhatsApp Modal */}
            {showWhatsAppModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowWhatsAppModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                            <div className="absolute top-0 right-0 pt-4 pr-4">
                                <button
                                    type="button"
                                    className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    onClick={() => setShowWhatsAppModal(false)}
                                >
                                    <span className="sr-only">Fermer</span>
                                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                </button>
                            </div>

                            <div>
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                                    <ChatBubbleLeftEllipsisIcon className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
                                </div>
                                <div className="mt-3 text-center sm:mt-5">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                                        Envoyer par WhatsApp
                                    </h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Confirmez le numéro ou recherchez un autre client.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 space-y-4">
                                <div>
                                    <label htmlFor="wa-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Numéro de téléphone
                                    </label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <PhoneIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                        </div>
                                        <input
                                            type="text"
                                            name="wa-number"
                                            id="wa-number"
                                            className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                                            placeholder="216..."
                                            value={whatsAppNumber}
                                            onChange={(e) => setWhatsAppNumber(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="relative flex py-1 items-center">
                                    <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OU RECHERCHER UN CLIENT</span>
                                    <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                                </div>

                                <div className="relative">
                                    <label htmlFor="search-client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Rechercher un autre client
                                    </label>
                                    <div className="mt-1 relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                        </div>
                                        <input
                                            type="text"
                                            id="search-client"
                                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                                            placeholder="Nom du client..."
                                            value={clientSearchQuery}
                                            onChange={(e) => setClientSearchQuery(e.target.value)}
                                            autoComplete="off"
                                        />
                                        {searchingClients && (
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                                            </div>
                                        )}
                                    </div>

                                    {clientSearchResults.length > 0 && (
                                        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                            {clientSearchResults.map((client) => (
                                                <li
                                                    key={client._id}
                                                    className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 dark:hover:bg-gray-600"
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        try {
                                                            const res = await fetch(`/api/customers/${client._id}`, { headers: { 'X-Tenant-Id': (session?.user as any)?.companyId || '' } });
                                                            if (res.ok) {
                                                                const data = await res.json();
                                                                const phone = data.mobile || data.telephone || '';
                                                                let clean = phone.replace(/\D/g, '');
                                                                if (clean.length === 8) clean = '216' + clean;

                                                                if (clean) {
                                                                    setWhatsAppNumber(clean);
                                                                    setClientSearchQuery(client.title);
                                                                    setClientSearchResults([]);
                                                                } else {
                                                                    toast.error(`Aucun numéro trouvé pour ${client.title}`);
                                                                }
                                                            }
                                                        } catch (err) {
                                                            console.error(err);
                                                            toast.error("Erreur lors de la récupération du numéro");
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center">
                                                        <span className="font-medium block truncate text-gray-900 dark:text-white">
                                                            {client.title}
                                                        </span>
                                                    </div>
                                                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                                                        {client.subtitle}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Include Stamp Checkbox */}
                            <div
                                className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                onClick={() => setIncludeStamp(!includeStamp)}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeStamp ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white dark:bg-gray-800'}`}>
                                    {includeStamp && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                                    Inclure le cachet
                                </label>
                            </div>

                            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                                    onClick={confirmWhatsAppSend}
                                >
                                    Envoyer
                                </button>
                                <button
                                    type="button"
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                                    onClick={() => setShowWhatsAppModal(false)}
                                >
                                    Annuler
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
