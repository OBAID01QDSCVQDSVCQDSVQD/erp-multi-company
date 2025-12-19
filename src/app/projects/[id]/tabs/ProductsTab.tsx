'use client';

import { useState, useEffect } from 'react';
import { CubeIcon } from '@heroicons/react/24/outline';

interface ProductsTabProps {
    projectId: string;
    currency: string;
    tenantId: string;
}

export default function ProductsTab({ projectId, currency, tenantId }: ProductsTabProps) {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCostTTC, setTotalCostTTC] = useState(0);

    useEffect(() => {
        fetchProducts();
    }, [projectId]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/projects/${projectId}/products`, {
                headers: { 'X-Tenant-Id': tenantId }
            });

            if (response.ok) {
                const data = await response.json();
                const productsList = data.products || [];
                setProducts(productsList);
                const ttc =
                    typeof data.totalTTC === 'number'
                        ? data.totalTTC
                        : typeof data.total === 'number'
                            ? data.total
                            : productsList.reduce(
                                (sum: number, item: any) => sum + (item.totalCostTTC || item.totalCost || 0),
                                0
                            );
                setTotalCostTTC(ttc);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

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

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="flex items-center justify-between">
                    <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-6 gap-4">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                        </div>
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-6 gap-4">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded col-span-1"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-center py-12">
                <CubeIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Produits</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Aucun produit consommé pour ce projet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Coût total TTC: {formatPrice(totalCostTTC)}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Produits consommés</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">{products.length}</span> produit(s) •
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{formatPrice(totalCostTTC)}</span>
                </div>
            </div>

            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Produit</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Quantité</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Coût unitaire HT</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Coût unitaire TTC</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Coût total TTC</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Documents</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {products.map((item) => (
                            <tr key={item.productId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{item.product.nom}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.product.sku}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-200">
                                    {Number(item.quantity || 0).toLocaleString('fr-FR')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-200">
                                    {formatPrice(item.movements[0]?.unitCostHT || 0)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-gray-200">
                                    {formatPrice(item.movements[0]?.unitCostTTC || 0)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                                    {formatPrice(item.totalCostTTC || item.totalCost || 0)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                    <div className="space-y-1">
                                        {item.movements.map((movement: any, idx: number) => (
                                            <div key={idx} className="text-xs">
                                                {/* Afficher toujours le numéro du BL / document, jamais l'ID */}
                                                {movement.documentType} {movement.documentNumero || movement.documentNumber} • {formatDate(movement.date)}
                                            </div>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                                Total TTC:
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                                {formatPrice(totalCostTTC)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
