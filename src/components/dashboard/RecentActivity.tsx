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
        return format(new Date(dateString), 'dd MMM yyyy');
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
        case 'PAYEE': return 'bg-green-100 text-green-800';
        case 'PARTIELLEMENT_PAYEE': return 'bg-yellow-100 text-yellow-800';
        case 'BROUILLON': return 'bg-gray-100 text-gray-800';
        case 'ANNULEE': return 'bg-red-100 text-red-800';
        default: return 'bg-blue-100 text-blue-800';
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <DocumentTextIcon className="w-5 h-5 text-indigo-500" />
                        Factures Récentes
                    </h3>
                    <Link href="/sales/invoices" className="text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center">
                        Voir tout <ChevronRightIcon className="w-4 h-4 ml-1" />
                    </Link>
                </div>
                <div className="divide-y divide-gray-50">
                    {invoices.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Aucune facture récente</div>
                    ) : (
                        invoices.map((invoice, i) => (
                            <motion.div
                                key={invoice.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 * i }}
                                className="p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                            {invoice.numero.slice(-3)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{invoice.customer}</p>
                                            <p className="text-xs text-gray-500">{invoice.numero} • {formatDate(invoice.date)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">{formatCurrency(invoice.total)}</p>
                                        <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full mt-1 ${getStatusColor(invoice.status)}`}>
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
            >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <BanknotesIcon className="w-5 h-5 text-emerald-500" />
                        Paiements Récents
                    </h3>
                    <Link href="/sales/payments" className="text-sm text-emerald-600 font-medium hover:text-emerald-800 flex items-center">
                        Voir tout <ChevronRightIcon className="w-4 h-4 ml-1" />
                    </Link>
                </div>
                <div className="divide-y divide-gray-50">
                    {payments.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Aucun paiement récent</div>
                    ) : (
                        payments.map((payment, i) => (
                            <motion.div
                                key={payment.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 * i }}
                                className="p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs">
                                            {payment.numero.slice(-3)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{payment.customer}</p>
                                            <p className="text-xs text-gray-500">{payment.numero} • {formatDate(payment.date)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-emerald-600">+{formatCurrency(payment.montant)}</p>
                                        <span className="text-xs text-gray-400">Reçu</span>
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
