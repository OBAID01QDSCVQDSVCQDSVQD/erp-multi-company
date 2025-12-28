'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/Layout/AdminLayout';
import {
    MagnifyingGlassIcon,
    TrashIcon,
    PowerIcon,
    CheckCircleIcon,
    XCircleIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface User {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    isActive: boolean;
    companyName: string;
    createdAt: string;
}

export default function AdminUsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        filterUsers();
    }, [users, searchQuery, roleFilter]);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/admin/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
                setFilteredUsers(data);
            } else {
                toast.error("Erreur lors du chargement des utilisateurs");
            }
        } catch (error) {
            console.error(error);
            toast.error("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    const filterUsers = () => {
        let result = [...users];

        // Search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(u =>
                u.firstName?.toLowerCase().includes(query) ||
                u.lastName?.toLowerCase().includes(query) ||
                u.email?.toLowerCase().includes(query) ||
                u.companyName?.toLowerCase().includes(query)
            );
        }

        // Role Filter
        if (roleFilter !== 'all') {
            result = result.filter(u => u.role === roleFilter);
        }

        setFilteredUsers(result);
    };

    const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentStatus })
            });

            if (response.ok) {
                toast.success(`Utilisateur ${!currentStatus ? 'activé' : 'désactivé'}`);
                // Optimistic update
                setUsers(users.map(u => u._id === userId ? { ...u, isActive: !currentStatus } : u));
            } else {
                toast.error("Erreur lors de la mise à jour");
            }
        } catch (error) {
            toast.error("Erreur de connexion");
        }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ?")) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                toast.success("Utilisateur supprimé");
                setUsers(users.filter(u => u._id !== userId));
            } else {
                toast.error("Erreur lors de la suppression");
            }
        } catch (error) {
            toast.error("Erreur de connexion");
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">Admin</span>;
            case 'manager': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Manager</span>;
            case 'user': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Utilisateur</span>;
            default: return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{role}</span>;
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestion des Utilisateurs</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Vue globale de tous les utilisateurs du système.
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="Rechercher (Nom, Email, Entreprise)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            <option value="all">Tous les rôles</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="user">Utilisateur</option>
                        </select>
                        <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {filteredUsers.length} utilisateurs
                        </div>
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Utilisateur</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entreprise</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rôle</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Statut</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Créé le</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredUsers.map((user) => (
                                    <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                                    {user.firstName?.charAt(0) || <UserCircleIcon className="h-6 w-6" />}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 dark:text-white font-medium">{user.companyName}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getRoleBadge(user.role)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.isActive ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                                    <CheckCircleIcon className="w-4 h-4 mr-1" /> Actif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                                    <XCircleIcon className="w-4 h-4 mr-1" /> Inactif
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => toggleUserStatus(user._id, user.isActive)}
                                                    className={`p-1 rounded-md transition-colors ${user.isActive ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                                    title={user.isActive ? "Désactiver" : "Activer"}
                                                >
                                                    <PowerIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteUser(user._id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                            Aucun utilisateur trouvé.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                    {filteredUsers.map((user) => (
                        <div key={user._id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                                        {user.firstName?.charAt(0) || <UserCircleIcon className="h-6 w-6" />}
                                    </div>
                                    <div className="ml-3">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                    </div>
                                </div>
                                <div>
                                    {getRoleBadge(user.role)}
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Entreprise:</span>
                                    <span className="text-gray-900 dark:text-white font-medium">{user.companyName}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Statut:</span>
                                    {user.isActive ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                            <CheckCircleIcon className="w-3 h-3 mr-1" /> Actif
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                            <XCircleIcon className="w-3 h-3 mr-1" /> Inactif
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Créé le:</span>
                                    <span className="text-gray-900 dark:text-white font-medium">{new Date(user.createdAt).toLocaleDateString('fr-FR')}</span>
                                </div>
                            </div>

                            <div className="border-t dark:border-gray-700 pt-3 flex gap-2">
                                <button
                                    onClick={() => toggleUserStatus(user._id, user.isActive)}
                                    className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border transition-colors text-sm ${user.isActive
                                        ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20'
                                        : 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-900/30 dark:text-green-400 dark:hover:bg-green-900/20'
                                        }`}
                                >
                                    <PowerIcon className="h-4 w-4" />
                                    <span className="sr-only sm:not-sr-only">{user.isActive ? "Désactiver" : "Activer"}</span>
                                </button>
                                <button
                                    onClick={() => deleteUser(user._id)}
                                    className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors text-sm"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    <span className="sr-only sm:not-sr-only">Supprimer</span>
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredUsers.length === 0 && (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            Aucun utilisateur trouvé.
                        </div>
                    )}
                </div>
            </div>

        </AdminLayout >
    );
}
