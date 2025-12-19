
'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { toast } from 'react-hot-toast';
import {
    BuildingOfficeIcon,
    TruckIcon,
    MapPinIcon,
    PlusIcon,
    StarIcon as StarIconSolid,
    PencilIcon,
    TrashIcon,
    BuildingStorefrontIcon
} from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';

interface Warehouse {
    _id: string;
    name: string;
    type: 'DEPOT' | 'SHOWROOM' | 'CAMION' | 'OTHER';
    isDefault: boolean;
    address?: {
        street?: string;
        city?: string;
    };
    manager?: {
        name?: string;
        phone?: string;
    };
    isActive: boolean;
}

export default function WarehousesPage() {
    const { tenantId } = useTenantId();
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

    const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm();

    const fetchWarehouses = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/stock/warehouses', {
                headers: { 'X-Tenant-Id': tenantId }
            });
            if (res.ok) {
                const data = await res.json();
                setWarehouses(data);
            }
        } catch (err) {
            toast.error('Erreur chargement entrepôts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tenantId) fetchWarehouses();
    }, [tenantId]);

    const typeIcons = {
        'DEPOT': <BuildingOfficeIcon className="w-6 h-6 text-gray-600" />,
        'SHOWROOM': <BuildingStorefrontIcon className="w-6 h-6 text-blue-600" />,
        'CAMION': <TruckIcon className="w-6 h-6 text-orange-600" />,
        'OTHER': <MapPinIcon className="w-6 h-6 text-purple-600" />,
    };

    const typeLabels = {
        'DEPOT': 'Dépôt principal',
        'SHOWROOM': 'Point de vente / Showroom',
        'CAMION': 'Véhicule / Camion',
        'OTHER': 'Autre lieu'
    };

    const openModal = (warehouse?: Warehouse) => {
        if (warehouse) {
            setEditingWarehouse(warehouse);
            setValue('name', warehouse.name);
            setValue('type', warehouse.type);
            setValue('isDefault', warehouse.isDefault);
            setValue('address.city', warehouse.address?.city);
            setValue('address.street', warehouse.address?.street);
            setValue('manager.name', warehouse.manager?.name);
        } else {
            setEditingWarehouse(null);
            reset({
                name: '',
                type: 'DEPOT',
                isDefault: warehouses.length === 0, // Auto check if first
                address: { city: '', street: '' },
                manager: { name: '' }
            });
        }
        setIsModalOpen(true);
    };

    const onSubmit = async (data: any) => {
        try {
            const url = editingWarehouse
                ? `/api/stock/warehouses/${editingWarehouse._id}`
                : '/api/stock/warehouses';

            const method = editingWarehouse ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Id': tenantId
                },
                body: JSON.stringify(data)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur');
            }

            toast.success(editingWarehouse ? 'Entrepôt modifié' : 'Entrepôt créé');
            setIsModalOpen(false);
            fetchWarehouses();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet entrepôt ?')) return;
        try {
            const res = await fetch(`/api/stock/warehouses/${id}`, {
                method: 'DELETE',
                headers: { 'X-Tenant-Id': tenantId }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }
            toast.success('Supprimé avec succès');
            fetchWarehouses();
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BuildingOfficeIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            Entrepôts & Lieux de Stockage
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Gérez vos dépôts, showrooms et véhicules de livraison.</p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Nouvel Entrepôt
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                                    <div>
                                        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mt-2 animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                    <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : warehouses.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <BuildingOfficeIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Aucun entrepôt défini</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Commencez par créer votre entrepôt principal.</p>
                        <button onClick={() => openModal()} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Créer maintenant</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {warehouses.map((wh) => (
                            <div key={wh._id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-5 relative group transition hover:shadow-md ${wh.isDefault ? 'border-blue-200 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
                                {wh.isDefault && (
                                    <div className="absolute top-4 right-4 text-yellow-400" title="Entrepôt par défaut">
                                        <StarIconSolid className="w-6 h-6" />
                                    </div>
                                )}

                                <div className="flex items-start gap-4 mb-4">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        {/* Icons already have manual color classes, might need adjustment if they are fixed colors. Use helper or adjust directly if needed. 
                                            Currently: text-gray-600, text-blue-600, etc. These should be visible enough or we can add dark variants if needed, but solid icons usually fine. 
                                            Let's check the icon definitions above. They are <Icon className="..." />. 
                                            Refactoring icons to support dark mode better would be ideal but they are hardcoded variables.
                                            Let's leave them as is for now, they are colored. background is dark:bg-gray-700/50 which provides contrast.
                                         */}
                                        {typeIcons[wh.type] || typeIcons['OTHER']}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{wh.name}</h3>
                                        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mt-1">
                                            {typeLabels[wh.type]}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    {wh.address?.city && (
                                        <div className="flex items-center gap-2">
                                            <MapPinIcon className="w-4 h-4 text-gray-400" />
                                            <span>{wh.address.city} {wh.address.street ? `, ${wh.address.street}` : ''}</span>
                                        </div>
                                    )}
                                    {wh.manager?.name && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-xs">Resp:</span>
                                            <span>{wh.manager.name}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t dark:border-gray-700 pt-4 flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openModal(wh)}
                                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Modifier">
                                        <PencilIcon className="w-4 h-4" />
                                    </button>
                                    {!wh.isDefault && (
                                        <button
                                            onClick={() => handleDelete(wh._id)}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Supprimer">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                {editingWarehouse ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de l'entrepôt *</label>
                                <input
                                    {...register('name', { required: 'Le nom est requis' })}
                                    type="text"
                                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ex: Dépôt Principal, Showroom Sfax..."
                                />
                                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                    <select {...register('type')} className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                                        <option value="DEPOT">Dépôt / Stockage</option>
                                        <option value="SHOWROOM">Showroom / Vente</option>
                                        <option value="CAMION">Camion / Mobile</option>
                                        <option value="OTHER">Autre</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ville</label>
                                    <input {...register('address.city')} type="text" className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Tunis..." />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adresse complète</label>
                                <input {...register('address.street')} type="text" className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Rue..." />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsable</label>
                                <input {...register('manager.name')} type="text" className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Nom du responsable" />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    {...register('isDefault')}
                                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                />
                                <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">Définir comme entrepôt par défaut</label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t dark:border-gray-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Annuler</button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </DashboardLayout>
    );
}
