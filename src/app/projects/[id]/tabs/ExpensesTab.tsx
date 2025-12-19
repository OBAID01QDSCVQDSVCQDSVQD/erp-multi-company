'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BanknotesIcon } from '@heroicons/react/24/outline';

interface ExpensesTabProps {
    projectId: string;
    currency: string;
    tenantId: string;
}

export default function ExpensesTab({ projectId, currency, tenantId }: ExpensesTabProps) {
    const router = useRouter();
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCost, setTotalCost] = useState(0);

    useEffect(() => {
        fetchExpenses();
    }, [projectId, tenantId]);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/expenses?projetId=${projectId}`, {
                headers: { 'X-Tenant-Id': tenantId }
            });

            if (response.ok) {
                const data = await response.json();
                const expensesList = data.expenses || [];
                setExpenses(expensesList);

                // Calculate total cost
                const total = expensesList.reduce((sum: number, exp: any) => {
                    return sum + (exp.totalTTC || exp.totalHT || 0);
                }, 0);
                setTotalCost(total);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency || 'TND',
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
        }).format(amount);
    };

    const formatDate = (dateString: string | Date | undefined) => {
        if (!dateString) return 'N/A';
        try {
            const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch (error) {
            return 'N/A';
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: { [key: string]: string } = {
            brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
            en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
            valide: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
            paye: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
            rejete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        };
        const labels: { [key: string]: string } = {
            brouillon: 'Brouillon',
            en_attente: 'En attente',
            valide: 'Validé',
            paye: 'Payé',
            rejete: 'Rejeté',
        };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.brouillon}`}>
                {labels[status] || status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="flex items-center justify-between">
                    <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-7 gap-4">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-2"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                        </div>
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-7 gap-4">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-2"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (expenses.length === 0) {
        return (
            <div className="text-center py-12">
                <BanknotesIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Dépenses</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Aucune dépense liée à ce projet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Coût total: {formatPrice(totalCost)}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dépenses liées au projet</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{expenses.length}</span> dépense(s) •
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{formatPrice(totalCost)}</span>
                </div>
            </div>

            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Numéro</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Catégorie</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total TTC</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Statut</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {expenses.map((expense) => (
                            <tr key={expense._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{expense.numero}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm text-gray-900 dark:text-gray-200">{formatDate(expense.date)}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center">
                                        {expense.categorieId?.icone && (
                                            <span className="mr-2">{expense.categorieId.icone}</span>
                                        )}
                                        <span className="text-sm text-gray-900 dark:text-gray-200">
                                            {expense.categorieId?.nom || 'N/A'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-sm text-gray-900 dark:text-gray-200 max-w-xs truncate">
                                        {expense.description || '-'}
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                                    {formatPrice(expense.totalTTC || expense.totalHT || 0)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {getStatusBadge(expense.statut || 'brouillon')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    <button
                                        onClick={() => router.push(`/expenses/${expense._id}`)}
                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                    >
                                        Voir →
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                Total:
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                                {formatPrice(totalCost)}
                            </td>
                            <td colSpan={2}></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
