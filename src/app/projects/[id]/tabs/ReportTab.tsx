'use client';

import { useState, useEffect, useRef } from 'react';
import { ChartBarIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';

interface ReportTabProps {
    projectId: string;
    tenantId: string;
    currency: string;
    budget: number;
}

export default function ReportTab({ projectId, tenantId, currency, budget }: ReportTabProps) {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [labor, setLabor] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<any>(null);
    const [downloading, setDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchReportData();
    }, [projectId, tenantId]);

    const formatPrice = (amount: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency || 'TND',
            minimumFractionDigits: 2,
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

    const handleExportPdf = async () => {
        if (!summary || !reportRef.current) return;
        try {
            setDownloading(true);
            const [{ default: jsPDF }, html2canvasModule] = await Promise.all([
                import('jspdf'),
                import('html2canvas'),
            ]);
            const html2canvas = html2canvasModule.default;
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff', // Ensure white background for PDF
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            let position = 0;
            let heightLeft = pdfHeight;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();

            while (heightLeft > 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pdf.internal.pageSize.getHeight();
            }

            pdf.save(`rapport-projet-${projectId}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setDownloading(false);
        }
    };

    const fetchReportData = async () => {
        try {
            setLoading(true);

            const [expensesRes, laborRes, productsRes] = await Promise.all([
                fetch(`/api/projects/${projectId}/expenses`, {
                    headers: { 'X-Tenant-Id': tenantId }
                }),
                fetch(`/api/projects/${projectId}/labor`, {
                    headers: { 'X-Tenant-Id': tenantId }
                }),
                fetch(`/api/projects/${projectId}/products`, {
                    headers: { 'X-Tenant-Id': tenantId }
                })
            ]);

            const expensesData = expensesRes.ok ? await expensesRes.json() : { expenses: [], total: 0 };
            const laborData = laborRes.ok ? await laborRes.json() : { labor: [], summary: null };
            const productsData = productsRes.ok ? await productsRes.json() : { products: [], total: 0 };

            setExpenses(expensesData.expenses || []);
            setLabor(laborData.labor || []);

            const normalizedProducts = (productsData.products || []).map((item: any) => ({
                ...item,
                totalCostTTC: item.totalCostTTC ?? item.totalCost ?? 0,
            }));
            setProducts(normalizedProducts);

            const totalExpensesTTC = (expensesData.expenses || []).reduce(
                (sum: number, e: any) => sum + (e.totalTTC || e.totalHT || 0),
                0
            );
            const totalLaborCost = (laborData.labor || []).reduce(
                (sum: number, l: any) => sum + (l.laborCost || 0),
                0
            );
            const totalProductsTTC =
                typeof productsData.totalTTC === 'number'
                    ? productsData.totalTTC
                    : typeof productsData.total === 'number'
                        ? productsData.total
                        : normalizedProducts.reduce(
                            (sum: number, product: any) => sum + (product.totalCostTTC ?? 0),
                            0
                        );

            const totalCostTTC = totalExpensesTTC + totalLaborCost + totalProductsTTC;
            const profit = budget - totalCostTTC;
            const profitMargin = budget > 0 ? (profit / budget) * 100 : 0;

            setSummary({
                budget,
                totalExpensesTTC,
                totalLaborCost,
                totalProductsTTC,
                totalCostTTC,
                profit,
                profitMargin,
                totalEmployees: laborData.labor?.length || 0,
                totalDays: (laborData.labor || []).reduce((sum: number, l: any) => sum + (l.daysWorked || 0), 0),
                totalHours: (laborData.labor || []).reduce((sum: number, l: any) => sum + (l.totalHours || 0), 0),
            });
        } catch (error) {
            console.error('Error fetching report data:', error);
        } finally {
            setLoading(false);
        }
    };


    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="flex justify-between items-center">
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="p-10 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 space-y-8">
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        ))}
                    </div>
                    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="space-y-4">
                        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="text-center py-12">
                <ChartBarIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Rapport complet</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Aucune donnée disponible</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rapport détaillé</h3>
                <button
                    onClick={handleExportPdf}
                    disabled={downloading}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${downloading ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
                        }`}
                >
                    <DocumentArrowDownIcon className="w-5 h-5" />
                    {downloading ? 'Génération...' : 'Télécharger PDF'}
                </button>
            </div>
            <div
                ref={reportRef}
                className="space-y-6 bg-white dark:bg-gray-800 p-6 md:p-10 rounded-2xl shadow border border-gray-100 dark:border-gray-700"
            >
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border-l-4 border-blue-400 dark:border-blue-500 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-300">Budget</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatPrice(summary.budget)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">Montant alloué</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-gray-800 border-l-4 border-red-400 dark:border-red-500 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-300">Coût total TTC</p>
                        <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{formatPrice(summary.totalCostTTC)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">Tous frais inclus</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 border-l-4 border-green-400 dark:border-green-500 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-300">Profit / Perte</p>
                        <p className={`text-2xl font-semibold ${summary.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatPrice(summary.profit)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">Marge: {summary.profitMargin.toFixed(1)}%</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 border-l-4 border-purple-400 dark:border-purple-500 rounded-lg p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-300">Équipe</p>
                        <p className="text-2xl font-semibold text-gray-900 dark:text-white">{summary.totalEmployees}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                            {summary.totalDays} jours • {summary.totalHours.toFixed(1)}h
                        </p>
                    </div>
                </div>

                {/* Cost Breakdown */}
                <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800 rounded-lg shadow p-6 border border-indigo-100 dark:border-indigo-900/30">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Répartition des coûts (TTC)</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Dépenses</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(summary.totalExpensesTTC)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Main d'œuvre</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(summary.totalLaborCost)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-sm text-gray-600 dark:text-gray-300">Produits</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(summary.totalProductsTTC)}</span>
                        </div>
                        <div className="border-t border-indigo-100 dark:border-indigo-700 pt-4 flex items-center justify-between">
                            <span className="text-base font-semibold text-gray-900 dark:text-white">Total coûts TTC</span>
                            <span className="text-base font-bold text-gray-900 dark:text-white">{formatPrice(summary.totalCostTTC)}</span>
                        </div>
                    </div>
                </div>

                {/* Expenses Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-pink-100 dark:border-pink-900/30">
                    <div className="px-6 py-4 border-b border-pink-100 dark:border-pink-900/30 bg-pink-50/60 dark:bg-pink-900/20">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dépenses ({expenses.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-pink-50 dark:bg-pink-900/10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Numéro</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Catégorie</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Description</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Montant TTC</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {expenses.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Aucune dépense
                                        </td>
                                    </tr>
                                ) : (
                                    expenses.map((expense) => (
                                        <tr key={expense._id}>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{expense.numero}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{formatDate(expense.date)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">
                                                {expense.categorieId?.nom || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200 max-w-xs truncate">
                                                {expense.description || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                                {formatPrice(expense.totalTTC || expense.totalHT || 0)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        Total:
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                                        {formatPrice(summary.totalExpensesTTC)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Labor Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-blue-100 dark:border-blue-900/30">
                    <div className="px-6 py-4 border-b border-blue-100 dark:border-blue-900/30 bg-blue-50/60 dark:bg-blue-900/20">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Main d'œuvre ({labor.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-blue-50 dark:bg-blue-900/10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Employé</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Rôle</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Jours</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Heures</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Coût</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {labor.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Aucune main d'œuvre
                                        </td>
                                    </tr>
                                ) : (
                                    labor.map((item) => (
                                        <tr key={item.employee?._id}>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                {item.employee?.firstName} {item.employee?.lastName}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{item.role || '-'}</td>
                                            <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                                {item.daysWorked || 0}
                                            </td>
                                            <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                                                {(item.totalHours || 0).toFixed(1)} h
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                                {formatPrice(item.laborCost || 0)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        Total:
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                                        {formatPrice(summary.totalLaborCost)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Products Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-green-100 dark:border-green-900/30">
                    <div className="px-6 py-4 border-b border-green-100 dark:border-green-900/30 bg-green-50/60 dark:bg-green-900/20">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Produits consommés ({products.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-green-50 dark:bg-green-900/10">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Produit</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Quantité</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Coût unitaire TTC</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Coût total TTC</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {products.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Aucun produit
                                        </td>
                                    </tr>
                                ) : (
                                    products.map((item) => (
                                        <tr key={item.productId}>
                                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                <div>
                                                    <div className="font-medium">{item.product.nom}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.product.sku}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-200">
                                                {Number(item.quantity || 0).toLocaleString('fr-FR')}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-gray-200">
                                                {formatPrice(item.movements?.[0]?.unitCostTTC || 0)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                                {formatPrice(item.totalCostTTC ?? item.totalCost ?? 0)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                        Total TTC:
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                                        {formatPrice(summary.totalProductsTTC)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
