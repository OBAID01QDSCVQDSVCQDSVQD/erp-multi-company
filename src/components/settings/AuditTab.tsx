
'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    ClockIcon,
    UserIcon,
    ComputerDesktopIcon,
    DocumentMagnifyingGlassIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';

interface AuditLog {
    _id: string;
    createdAt: string;
    userName: string;
    userEmail: string;
    action: string;
    resource: string;
    details: string;
    ipAddress: string;
    location?: string;
}

export default function AuditTab({ tenantId }: { tenantId: string }) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/settings/audit?page=${page}&limit=20`, {
                headers: { 'X-Tenant-Id': tenantId }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Erreur chargement logs', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, tenantId]);

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        if (action.includes('CREATE')) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
        if (action.includes('UPDATE')) return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
        if (action.includes('LOGIN')) return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
        return 'text-gray-600 bg-gray-50 dark:bg-gray-800';
    };

    const translateLog = (log: AuditLog) => {
        let action = log.action;
        let resource = log.resource;
        let details = log.details;

        // Translate Action
        if (action.includes('CREATE')) action = action.replace('CREATE', 'CRÉATION').replace('_', ' ');
        else if (action.includes('UPDATE')) action = action.replace('UPDATE', 'MODIFICATION').replace('_', ' ');
        else if (action.includes('DELETE')) action = action.replace('DELETE', 'SUPPRESSION').replace('_', ' ');
        else if (action.includes('LOGIN')) action = 'CONNEXION';

        // Translate Resource
        const resources: { [key: string]: string } = {
            'Customer': 'Client',
            'Quote': 'Devis',
            'Invoice': 'Facture',
            'Product': 'Produit',
            'User': 'Utilisateur',
            'Settings': 'Paramètres',
            'Company': 'Société',
            'Sales': 'Ventes'
        };

        // Try exact match or partial match
        if (resources[resource]) {
            resource = resources[resource];
        } else {
            // Fallback partial translation
            Object.keys(resources).forEach(key => {
                if (resource.includes(key)) resource = resource.replace(key, resources[key]);
            });
        }

        // Translate Details (Basic pattern matching)
        if (details) {
            details = details
                .replace('Created customer', 'Création du client')
                .replace('Updated customer', 'Modification du client')
                .replace('Deleted customer', 'Suppression du client')
                .replace('Created Quote', 'Création du devis')
                .replace('Updated Quote', 'Modification du devis')
                .replace('Deleted Quote', 'Suppression du devis')
                .replace('User logged in', 'Utilisateur connecté');
        }

        return { ...log, action, resource, details };
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <DocumentMagnifyingGlassIcon className="w-6 h-6 text-indigo-500" />
                        Journal d'activité
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Trace complète des actions effectuées sur le système.
                    </p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="p-2 text-gray-500 hover:text-indigo-600 transition-colors"
                    title="Actualiser"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Utilisateur</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Détails</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source (IP)</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                        Chargement...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                                        Aucune activité enregistrée.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((rawLog) => {
                                    const log = translateLog(rawLog);
                                    return (
                                        <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                <div className="flex items-center gap-1.5">
                                                    <ClockIcon className="w-4 h-4 text-gray-400" />
                                                    {format(new Date(log.createdAt), 'dd MMM HH:mm', { locale: fr })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                                        {log.userName?.charAt(0) || 'U'}
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{log.userName}</p>
                                                        <p className="text-xs text-gray-500">{log.userEmail}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(rawLog.action)}`}>
                                                    {log.action}
                                                </span>
                                                <div className="text-xs text-gray-400 mt-1 ml-1">{log.resource}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate" title={log.details}>
                                                {log.details || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                                <div className="flex flex-col">
                                                    <span className="font-mono">{log.ipAddress}</span>
                                                    <span className="text-gray-400">{log.location || 'Local'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50">
                    {loading && logs.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">Chargement...</div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">Aucune activité.</div>
                    ) : (
                        logs.map((rawLog) => {
                            const log = translateLog(rawLog);
                            return (
                                <div key={log._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                                {log.userName?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white capitalize leading-tight">{log.userName}</p>
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                                    <ClockIcon className="w-3 h-3" />
                                                    {format(new Date(log.createdAt), 'dd MMM HH:mm', { locale: fr })}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${getActionColor(rawLog.action)}`}>
                                            {log.action}
                                        </span>
                                    </div>

                                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium break-all">
                                            {log.details || '-'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                                            {log.resource}
                                        </p>
                                    </div>

                                    <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{log.ipAddress}</span>
                                        <span>{log.location || 'Local'}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination Simple */}
                {pagination && pagination.pages > 1 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="text-sm text-indigo-600 disabled:text-gray-400 font-medium"
                        >
                            Précédent
                        </button>
                        <span className="text-xs text-gray-500">Page {page} sur {pagination.pages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                            disabled={page === pagination.pages}
                            className="text-sm text-indigo-600 disabled:text-gray-400 font-medium"
                        >
                            Suivant
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
