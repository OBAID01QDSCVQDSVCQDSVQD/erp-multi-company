'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import {
    MagnifyingGlassIcon,
    CalendarIcon,
    ArrowDownTrayIcon,
    EyeIcon,
    DocumentTextIcon,
    BanknotesIcon,
    CreditCardIcon,
    ArrowLeftIcon,
    ShoppingCartIcon,
    ArchiveBoxIcon,
    TruckIcon
} from '@heroicons/react/24/outline';

interface Transaction {
    id: string;
    type: 'facture' | 'paiement' | 'avoir' | 'commande' | 'reception';
    numero: string;
    reference: string;
    date: string;
    dateEcheance: string | null;
    montant: number;
    montantPaye: number;
    soldeRestant: number;
    statut: string;
    devise: string;
    notes?: string;
    conditionsPaiement?: string;
    modePaiement?: string;
    documentType: string;
    isPaymentOnAccount?: boolean;
    lignes?: Array<{
        factureNumero: string;
        montantPaye: number;
    }>;
}

interface Summary {
    totalFactures: number;
    totalPaiements: number;
    totalAvoirs: number;
    soldeActuel: number;
    facturesOuvertes: number;
    soldeAvanceDisponible?: number;
}

export default function SupplierDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { tenantId } = useTenantId();
    const supplierId = params.id as string;

    const [supplier, setSupplier] = useState<any>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });

    // Filters
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all'); // Default to all? Or dashboard view with tables?
    // Let's keep 'facture' as default if they come from dashboard, but search link might want 'all' or specific tab.
    // Actually, let's defaults to 'facture' but allow switching.

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);


    useEffect(() => {
        if (tenantId && supplierId) {
            setCurrentPage(1); // Reset to first page when filters change
        }
    }, [tenantId, supplierId, dateDebut, dateFin, typeFilter, searchTerm]);

    useEffect(() => {
        if (tenantId && supplierId) {
            fetchTransactions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantId, supplierId, dateDebut, dateFin, typeFilter, searchTerm, currentPage]);

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            setError('');
            if (!tenantId) return;

            const params = new URLSearchParams();
            if (dateDebut) params.append('dateDebut', dateDebut);
            if (dateFin) params.append('dateFin', dateFin);
            if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
            if (searchTerm) params.append('search', searchTerm);
            params.append('page', currentPage.toString());
            params.append('limit', '50');

            const response = await fetch(`/api/suppliers/${supplierId}/transactions?${params.toString()}`, {
                headers: { 'X-Tenant-Id': tenantId },
            });

            if (response.ok) {
                const data = await response.json();
                setSupplier(data.supplier);
                setTransactions(data.transactions || []);
                setSummary(data.summary || null);
                if (data.pagination) {
                    setPagination(data.pagination);
                }
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Erreur lors du chargement des transactions');
            }
        } catch (err) {
            setError('Erreur de connexion');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'TND',
            minimumFractionDigits: 3,
        }).format(amount);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('fr-FR');
    };

    const getTransactionTypeLabel = (type: string) => {
        switch (type) {
            case 'facture': return 'Facture';
            case 'paiement': return 'Paiement';
            case 'avoir': return 'Avoir';
            case 'commande': return 'Commande';
            case 'reception': return 'Réception';
            default: return type;
        }
    };

    const getTransactionTypeIcon = (type: string) => {
        switch (type) {
            case 'facture': return <DocumentTextIcon className="w-5 h-5 text-blue-600" />;
            case 'paiement': return <BanknotesIcon className="w-5 h-5 text-green-600" />;
            case 'avoir': return <CreditCardIcon className="w-5 h-5 text-orange-600" />;
            case 'commande': return <ShoppingCartIcon className="w-5 h-5 text-indigo-600" />;
            case 'reception': return <ArchiveBoxIcon className="w-5 h-5 text-teal-600" />;
            default: return null;
        }
    };

    const getStatusBadge = (statut: string, type: string) => {
        const baseClasses = 'px-2 py-1 rounded text-xs font-medium';
        if (type === 'paiement') {
            if (statut === 'PAYE_SUR_COMPTE') {
                return <span className={`${baseClasses} bg-purple-100 text-purple-800`}>Paiement sur compte</span>;
            }
            return <span className={`${baseClasses} bg-green-100 text-green-800`}>Payé</span>;
        }

        switch (statut) {
            case 'PAYEE':
            case 'LIVREE':
            case 'VALIDEE':
            case 'ACCEPTE':
            case 'RECU':
                return <span className={`${baseClasses} bg-green-100 text-green-800`}>{statut}</span>;
            case 'PARTIELLEMENT_PAYEE':
            case 'EN_COURS':
            case 'EN_ATTENTE':
            case 'PARTIEL':
                return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>{statut}</span>;
            case 'BROUILLON':
                return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{statut}</span>;
            case 'ANNULEE':
            case 'REFUSE':
                return <span className={`${baseClasses} bg-red-100 text-red-800`}>{statut}</span>;
            default:
                return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{statut}</span>;
        }
    };

    const handleExport = async () => {
        // Export logic to be updated if needed for other types, keeping simple for now
        alert("Export functionality handles current view.");
    };

    const handleViewDocument = (transaction: Transaction) => {
        if (transaction.type === 'commande') {
            router.push(`/purchases/orders/${transaction.id}`);
        } else if (transaction.type === 'reception') {
            router.push(`/purchases/receptions/${transaction.id}`);
        } else if (transaction.type === 'facture' || transaction.type === 'avoir' || transaction.documentType === 'PurchaseInvoice') {
            router.push(`/purchases/invoices/${transaction.id}`);
        } else if (transaction.type === 'paiement' || transaction.documentType === 'PaiementFournisseur') {
            router.push(`/purchases/payments/${transaction.id}`);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Détails Fournisseur</h1>
                            {supplier && (
                                <div className="flex flex-col">
                                    <span className="text-lg font-medium text-gray-900 dark:text-white">{supplier.nom}</span>
                                    <span className="text-sm text-gray-500">{supplier.email} {supplier.telephone ? `• ${supplier.telephone}` : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={() => { }}
                        className="hidden flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Exporter CSV
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 space-y-4">
                    {/* Type Tabs */}
                    <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            {['facture', 'paiement', 'commande', 'reception'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setTypeFilter(type)}
                                    className={`${typeFilter === type
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200'
                                        } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2 capitalize`}
                                >
                                    {getTransactionTypeIcon(type)}
                                    {type === 'facture' ? 'Factures' : type === 'paiement' ? 'Paiements' : type === 'commande' ? 'Commandes' : 'Réceptions'}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Search and Date Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Date Début */}
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                            <input
                                type="date"
                                value={dateDebut}
                                onChange={(e) => setDateDebut(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Date Fin */}
                        <div className="relative">
                            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                            <input
                                type="date"
                                value={dateFin}
                                onChange={(e) => setDateFin(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Transactions Content */}
                {loading ? (
                    <div className="text-center py-12">Chargement...</div>
                ) : error ? (
                    <div className="text-red-600 py-4">{error}</div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        Aucun document trouvé
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Référence
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Montant
                                            </th>
                                            {['facture', 'paiement'].includes(typeFilter) && (
                                                <>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        Payé
                                                    </th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                        Reste
                                                    </th>
                                                </>
                                            )}
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Statut
                                            </th>
                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {transactions.map((transaction) => (
                                            <tr key={`${transaction.type}-${transaction.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                                        {transaction.type === 'paiement' && transaction.isPaymentOnAccount
                                                            ? 'Paiement sur compte'
                                                            : transaction.reference || transaction.numero || '-'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-600 dark:text-gray-300">{formatDate(transaction.date)}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {formatCurrency(transaction.montant)}
                                                    </div>
                                                </td>
                                                {['facture', 'paiement'].includes(typeFilter) && (
                                                    <>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                                                {formatCurrency(transaction.montantPaye)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                                            <div className={`text-sm font-medium ${transaction.soldeRestant > 0
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : transaction.soldeRestant < 0
                                                                    ? 'text-green-600 dark:text-green-400'
                                                                    : 'text-gray-600 dark:text-gray-400'
                                                                }`}>
                                                                {transaction.soldeRestant > 0 ? '+' : ''}
                                                                {formatCurrency(Math.abs(transaction.soldeRestant))}
                                                            </div>
                                                        </td>
                                                    </>
                                                )}
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {getStatusBadge(transaction.statut, transaction.type)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <button
                                                        onClick={() => handleViewDocument(transaction)}
                                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-sm font-medium"
                                                    >
                                                        Voir
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4">
                            {transactions.map((transaction) => (
                                <div
                                    key={`${transaction.type}-${transaction.id}`}
                                    className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 flex flex-col gap-3"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            {getTransactionTypeIcon(transaction.type)}
                                            <div>
                                                <div className="text-sm font-medium text-blue-600 dark:text-blue-400 break-all">
                                                    {transaction.type === 'paiement' && transaction.isPaymentOnAccount
                                                        ? 'Paiement sur compte'
                                                        : transaction.reference || transaction.numero || '-'}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatDate(transaction.date)}
                                                </div>
                                            </div>
                                        </div>
                                        {getStatusBadge(transaction.statut, transaction.type)}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-gray-500 dark:text-gray-400 text-xs text-left">Montant total</span>
                                            <span className="font-semibold text-gray-900 dark:text-white text-left">{formatCurrency(transaction.montant)}</span>
                                        </div>
                                        {['facture', 'paiement'].includes(typeFilter) && (
                                            <div className="flex flex-col items-end">
                                                <span className="text-gray-500 dark:text-gray-400 text-xs text-right">Reste à payer</span>
                                                <span className={`font-semibold text-right ${transaction.soldeRestant > 0
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : transaction.soldeRestant < 0
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                    {transaction.soldeRestant > 0 ? '+' : ''}
                                                    {formatCurrency(Math.abs(transaction.soldeRestant))}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t dark:border-gray-700 flex justify-end">
                                        <button
                                            onClick={() => handleViewDocument(transaction)}
                                            className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                            Voir détails
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Pagination - Reuse existing logic */}
                {pagination.totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                        <p className="text-sm text-gray-500">Pagination en cours d'implémentation complète...</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
