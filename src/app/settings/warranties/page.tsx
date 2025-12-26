'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';

interface WarrantyTemplate {
    _id: string;
    name: string;
    isActive: boolean;
    fields: any[];
}

export default function WarrantyTemplatesPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const [templates, setTemplates] = useState<WarrantyTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session) {
            fetchTemplates();
        }
    }, [session]);

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/settings/warranty-templates', {
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            toast.error('Erreur lors du chargement des modèles');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce modèle ?')) return;

        try {
            const res = await fetch(`/api/settings/warranty-templates/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-Tenant-Id': (session?.user as any)?.companyId || ''
                }
            });

            if (res.ok) {
                toast.success('Modèle supprimé');
                fetchTemplates();
            } else {
                toast.error('Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="px-4 py-8 sm:px-6 lg:px-8">
                {/* ... existing content ... */}
                <div className="sm:flex sm:items-center">
                    <div className="sm:flex-auto">
                        <h1 className="text-2xl font-semibold leading-6 text-gray-900 dark:text-white">Modèles de Garantie</h1>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
                            Gérez ici les différents types de garanties proposés à vos clients.
                        </p>
                    </div>
                    <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                        <Link
                            href="/settings/warranties/new"
                            className="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <PlusIcon className="h-4 w-4" />
                                Nouveau Modèle
                            </span>
                        </Link>
                    </div>
                </div>

                <div className="mt-8 flow-root">
                    <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                                                Nom
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Statut
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                                Champs dynamiques
                                            </th>
                                            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                                <span className="sr-only">Actions</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                        {templates.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-4 text-center text-gray-500 dark:text-gray-400">
                                                    Aucun modèle défini. Créez-en un nouveau pour commencer.
                                                </td>
                                            </tr>
                                        ) : (
                                            templates.map((template) => (
                                                <tr key={template._id}>
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                                                        {template.name}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                        {template.isActive ? (
                                                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400">
                                                                Actif
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-900/20 dark:text-gray-400">
                                                                Inactif
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                        {template.fields?.length || 0} champs
                                                    </td>
                                                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                        <div className="flex justify-end gap-2">
                                                            <Link
                                                                href={`/settings/warranties/${template._id}`}
                                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                            >
                                                                <PencilSquareIcon className="h-5 w-5" />
                                                                <span className="sr-only">Modifier, {template.name}</span>
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(template._id)}
                                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                            >
                                                                <TrashIcon className="h-5 w-5" />
                                                                <span className="sr-only">Supprimer, {template.name}</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
