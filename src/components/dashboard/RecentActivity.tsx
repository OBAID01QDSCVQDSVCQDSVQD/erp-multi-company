'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { DocumentTextIcon, BanknotesIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface RecentInvoice {
    id: string;
    numero: string;
    date: string;
    customer: string;
    total: number;
    status?: string;
}

interface RecentPayment {
    id: string;
    numero: string;
    date: string;
    customer: string;
    montant: number;
}

interface RecentActivityProps {
    invoices: RecentInvoice[];
    payments: RecentPayment[];
}

const formatDate = (dateString: string) => {
    try {
        return format(new Date(dateString), 'dd/MM/yy');
    } catch {
        return dateString;
    }
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-TN', {
        style: 'currency',
        currency: 'TND',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    }).format(amount);
};

const getStatusColor = (status?: string) => {
    switch (status) {
        case 'PAYEE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
        case 'PARTIELLEMENT_PAYEE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
        case 'BROUILLON': return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
        case 'ANNULEE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
};

const getStatusLabel = (status?: string) => {
    switch (status) {
        case 'PAYEE': return 'Payée';
        case 'PARTIELLEMENT_PAYEE': return 'Partielle';
        case 'BROUILLON': return 'Brouillon';
        case 'ANNULEE': return 'Annulée';
        case 'VALIDEE': return 'Validée';
        default: return status || 'N/A';
    }
};

export default function RecentActivity({ invoices, payments }: RecentActivityProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-0">
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-xs">
                        <DocumentTextIcon className="w-3.5 h-3.5 text-indigo-500" />
                        Factures Récentes
                    </h3>
                    <Link href="/sales/invoices" className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center">
                        Voir tout <ChevronRightIcon className="w-2.5 h-2.5 ml-0.5" />
                    </Link>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {invoices.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-[10px]">Aucune facture récente</div>
                    ) : (
                        invoices.map((invoice, i) => (
                            <motion.div
                                key={invoice.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.05 * i }}
                                className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-[9px]">
                                            {invoice.numero.slice(-3)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{invoice.customer}</p>
                                            <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate">{invoice.numero} • {formatDate(invoice.date)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-[10px] font-bold text-gray-900 dark:text-white">{formatCurrency(invoice.total)}</p>
                                        <span className={`inline-block px-1.5 py-0 text-[8px] rounded mt-0.5 ${getStatusColor(invoice.status)}`}>
                                            {getStatusLabel(invoice.status)}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-xs">
                        <BanknotesIcon className="w-3.5 h-3.5 text-emerald-500" />
                        Paiements Récents
                    </h3>
                    <Link href="/sales/payments" className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center">
                        Voir tout <ChevronRightIcon className="w-2.5 h-2.5 ml-0.5" />
                    </Link>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {payments.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-[10px]">Aucun paiement récent</div>
                    ) : (
                        payments.map((payment, i) => (
                            <motion.div
                                key={payment.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.05 * i }}
                                className="px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-[9px]">
                                            {payment.numero.slice(-3)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-gray-900 dark:text-white truncate max-w-[120px]">{payment.customer}</p>
                                            <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate">{payment.numero} • {formatDate(payment.date)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(payment.montant)}</p>
                                        <span className="text-[9px] text-gray-400 dark:text-gray-500">Reçu</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
}
