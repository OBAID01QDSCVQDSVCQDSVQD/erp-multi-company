'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/Layout/AdminLayout';
import {
    MagnifyingGlassIcon,
    ClockIcon,
    UserCircleIcon,
    TagIcon,
    ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface AuditLog {
    _id: string;
    userName: string;
    userEmail: string;
    action: string;
    resource: string;
    details: string;
    ipAddress: string;
    createdAt: string;
    metadata?: any;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [searchUser, setSearchUser] = useState('');

    useEffect(() => {
        fetchLogs();
    }, [filterType]); // Refetch when filter changes

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLogs();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchUser]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (filterType !== 'all') queryParams.append('type', filterType);
            if (searchUser) queryParams.append('user', searchUser);

            const res = await fetch(`/api/admin/audit-logs?${queryParams.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            } else {
                toast.error("Impossible de charger les logs");
            }
        } catch (e) {
            toast.error("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'bg-red-100 text-red-800';
        if (action.includes('CREATE')) return 'bg-green-100 text-green-800';
        if (action.includes('UPDATE')) return 'bg-blue-100 text-blue-800';
        if (action.includes('LOGIN')) return 'bg-purple-100 text-purple-800';
        if (action.includes('IMPERSONATE')) return 'bg-amber-100 text-amber-800';
        return 'bg-gray-100 text-gray-800';
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Journal d'Audit (Audit Logs)</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Historique complet des actions sensibles effectuées sur la plateforme.
                    </p>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserCircleIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Utilisateur (Nom ou Email)"
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white sm:text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                            />
                        </div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="block w-full md:w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            <option value="all">Toutes les actions</option>
                            <option value="LOGIN">Connexions</option>
                            <option value="CREATE_COMPANY">Création Entreprise</option>
                            <option value="DELETE_COMPANY">Suppression Entreprise</option>
                            <option value="IMPERSONATE">Impersonation</option>
                            <option value="UPDATE_SETTINGS">Réglages Système</option>
                        </select>
                    </div>
                    <button onClick={() => fetchLogs()} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                        Actualiser
                    </button>
                </div>

                {/* Logs Table */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Heure</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Détails</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {logs.map((log) => (
                                        <tr key={log._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center gap-2">
                                                    <ClockIcon className="h-4 w-4 text-gray-400" />
                                                    {new Date(log.createdAt).toLocaleString('fr-FR')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{log.userName}</div>
                                                <div className="text-xs text-gray-500">{log.userEmail}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate" title={log.details}>
                                                {log.details}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <TagIcon className="h-4 w-4 text-gray-400" />
                                                    {log.resource || '-'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                Aucun historique trouvé.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
