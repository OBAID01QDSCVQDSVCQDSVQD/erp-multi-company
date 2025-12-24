'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import Link from 'next/link';
import {
    MagnifyingGlassIcon,
    UserGroupIcon,
    BuildingOfficeIcon,
    DocumentTextIcon,
    CubeIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function SearchPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams.get('q') || '';
    const { tenantId } = useTenantId();

    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('All');

    useEffect(() => {
        if (query) {
            fetchResults();
        }
    }, [query, tenantId]);

    const fetchResults = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=50`, {
                headers: { 'X-Tenant-Id': tenantId || '' }
            });
            if (res.ok) {
                const data = await res.json();
                setResults(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { id: 'All', label: 'Tout', icon: MagnifyingGlassIcon },
        { id: 'Client', label: 'Clients', icon: UserGroupIcon },
        { id: 'Fournisseur', label: 'Fournisseurs', icon: BuildingOfficeIcon },
        { id: 'Produit', label: 'Produits', icon: CubeIcon },
        { id: 'Document', label: 'Documents', icon: DocumentTextIcon }, // Group documents
    ];

    const filteredResults = activeTab === 'All'
        ? results
        : activeTab === 'Document'
            ? results.filter(r => !['Client', 'Fournisseur', 'Produit'].includes(r.type))
            : results.filter(r => r.type === activeTab);

    const getIcon = (type: string) => {
        switch (type) {
            case 'Client': return UserGroupIcon;
            case 'Fournisseur': return BuildingOfficeIcon;
            case 'Produit': return CubeIcon;
            default: return DocumentTextIcon;
        }
    };

    const getColor = (type: string) => {
        switch (type) {
            case 'Client': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
            case 'Fournisseur': return 'text-purple-500 bg-purple-50 dark:bg-purple-900/20';
            case 'Produit': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
            default: return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
        }
    };

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 pb-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <Link
                            href="/dashboard"
                            className="text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 mb-2 inline-flex items-center gap-1"
                        >
                            ← Retour au tableau de bord
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Résultats de recherche
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            Résultats pour "<span className="font-semibold text-gray-900 dark:text-white">{query}</span>"
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
                        {categories.map((cat) => {
                            const Icon = cat.icon;
                            const isActive = activeTab === cat.id;
                            const count = cat.id === 'All'
                                ? results.length
                                : cat.id === 'Document'
                                    ? results.filter(r => !['Client', 'Fournisseur', 'Produit'].includes(r.type)).length
                                    : results.filter(r => r.type === cat.id).length;

                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
                                        ${isActive
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none'
                                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'}
                                    `}
                                >
                                    <Icon className="w-4 h-4" />
                                    {cat.label}
                                    <span className={`ml-1 text-xs py-0.5 px-1.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Results Grid */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            <p className="mt-4 text-gray-500 animate-pulse">Recherche en cours...</p>
                        </div>
                    ) : filteredResults.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredResults.map((result, i) => {
                                const Icon = getIcon(result.type);
                                const colorClass = getColor(result.type);

                                return (
                                    <motion.div
                                        key={result._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: i * 0.05 }}
                                    >
                                        <Link
                                            href={result.url}
                                            className="group block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all h-full"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className={`p-2 rounded-lg ${colorClass}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${colorClass.replace('text-', 'text-opacity-80 text-').replace('bg-', 'bg-opacity-50 bg-')}`}>
                                                    {result.type}
                                                </span>
                                            </div>

                                            <h3 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {result.title}
                                            </h3>

                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                                                {result.subtitle}
                                            </p>

                                            {result.meta && (
                                                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                                    <span className="text-xs font-mono font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 px-2 py-0.5 rounded">
                                                        {result.meta}
                                                    </span>
                                                    <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                                </div>
                                            )}
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                            <MagnifyingGlassIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Aucun résultat trouvé</h3>
                            <p className="text-gray-500 dark:text-gray-400">Essayez avec d'autres mots-clés ou vérifiez l'orthographe.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
