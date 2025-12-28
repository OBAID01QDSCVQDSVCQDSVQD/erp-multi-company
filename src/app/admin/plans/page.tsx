'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import AdminLayout from '@/components/Layout/AdminLayout';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    CheckIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';

interface Plan {
    _id: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
    isActive: boolean;
    features: string[];
    limits: {
        maxUsers: number;
        maxCompanies: number;
        maxDocuments: number;
        maxStorageMB: number;
    };
    sortOrder: number;
}

export default function PlansManagementPage() {
    const { data: session } = useSession();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

    // Simplified flat form state to avoid React nesting bugs
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [price, setPrice] = useState(0);
    const [currency, setCurrency] = useState('TND');
    const [interval, setInterval] = useState<'month' | 'year'>('month');
    const [isActive, setIsActive] = useState(true);
    const [maxUsers, setMaxUsers] = useState(1);
    const [maxCompanies, setMaxCompanies] = useState(1);
    const [maxDocuments, setMaxDocuments] = useState(100);
    const [featuresInput, setFeaturesInput] = useState('');

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            // Add a timestamp to bypass any caching
            const res = await fetch(`/api/admin/plans?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                console.log('Fetched plans:', data); // Just for internal debug if we could see it
                setPlans(data);
            }
        } catch (error) {
            console.error('Error fetching plans:', error);
            toast.error('Erreur lors du chargement des plans');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = editingPlan
                ? `/api/admin/plans/${editingPlan._id}`
                : '/api/admin/plans';

            const method = editingPlan ? 'PUT' : 'POST';

            const payload = {
                name,
                slug,
                price: Number(price),
                currency,
                interval,
                isActive,
                features: featuresInput.split('\n').filter(f => f.trim() !== ''),
                limits: {
                    maxUsers: Number(maxUsers),
                    maxCompanies: Number(maxCompanies),
                    maxDocuments: Number(maxDocuments),
                }
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(editingPlan ? 'Plan mis à jour' : 'Plan créé');
                await fetchPlans();
                closeModal();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Une erreur est survenue');
            }
        } catch (error) {
            console.error('Error saving plan:', error);
            toast.error('Erreur lors de la sauvegarde');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce plan ?')) return;

        try {
            const res = await fetch(`/api/admin/plans/${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                toast.success('Plan supprimé');
                fetchPlans();
            } else {
                toast.error('Erreur lors de la suppression');
            }
        } catch (error) {
            console.error('Error deleting plan:', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    const openModal = (plan?: Plan) => {
        if (plan) {
            setEditingPlan(plan);
            setName(plan.name || '');
            setSlug(plan.slug || '');
            setPrice(plan.price || 0);
            setCurrency(plan.currency || 'TND');
            setInterval(plan.interval || 'month');
            setIsActive(plan.isActive ?? true);
            setMaxUsers(plan.limits?.maxUsers ?? 1);
            setMaxCompanies(plan.limits?.maxCompanies ?? 1);
            setMaxDocuments(plan.limits?.maxDocuments ?? 100);
            setFeaturesInput(plan.features?.join('\n') || '');
        } else {
            setEditingPlan(null);
            setName('');
            setSlug('');
            setPrice(0);
            setCurrency('TND');
            setInterval('month');
            setIsActive(true);
            setMaxUsers(1);
            setMaxCompanies(1);
            setMaxDocuments(100);
            setFeaturesInput('');
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPlan(null);
    };

    if (loading) return (
        <AdminLayout>
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        </AdminLayout>
    );

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100/50 dark:border-gray-700/50">
                    <div>
                        <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                            Gestion des Plans
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                            Configurez et gérez les offres d'abonnement visibles par vos clients.
                        </p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none hover:shadow-indigo-200 transform transition-all hover:scale-[1.03] active:scale-95 font-bold text-lg"
                    >
                        <PlusIcon className="w-6 h-6 mr-2" />
                        Nouveau Plan
                    </button>
                </div>

                {/* Plans Grid */}
                {plans.length === 0 ? (
                    <div className="text-center py-32 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                            <PlusIcon className="w-12 h-12 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Aucun plan configuré</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Commencez par créer votre premier plan d'abonnement.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {plans.map((plan) => (
                            <div
                                key={plan._id}
                                className={`group relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border transition-all hover:shadow-xl hover:-translate-y-1 ${plan.isActive ? 'border-gray-100 dark:border-gray-700' : 'border-gray-50 dark:border-gray-800 opacity-80'
                                    }`}
                            >
                                <div className="absolute top-6 right-6 flex space-x-2">
                                    <button
                                        onClick={() => openModal(plan)}
                                        className="p-3 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-2xl transition-all"
                                    >
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan._id)}
                                        className="p-3 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-2xl transition-all"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mb-6">
                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${plan.isActive
                                        ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50'
                                        : 'bg-gray-50 text-gray-700 border border-gray-100 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                                        }`}>
                                        {plan.isActive ? 'Actif' : 'Inactif'}
                                    </span>
                                </div>

                                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-1">{plan.name}</h3>
                                <p className="text-sm text-gray-400 dark:text-gray-500 font-mono mb-4">{plan.slug}</p>

                                <div className="mb-8 flex items-baseline">
                                    <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                                        {plan.price}
                                    </span>
                                    <span className="ml-1 text-xl font-bold text-indigo-400 dark:text-indigo-300">{plan.currency}</span>
                                    <span className="ml-1 text-gray-400 dark:text-gray-500 font-medium">/{plan.interval === 'month' ? 'mois' : 'an'}</span>
                                </div>

                                <div className="space-y-4 py-6 border-t border-gray-100/60 dark:border-gray-700/60">
                                    <div className="flex items-center justify-between text-base">
                                        <span className="text-gray-500 dark:text-gray-400 font-medium">Documents (Quota)</span>
                                        <span className={`font-bold px-3 py-1 rounded-lg ${plan.limits?.maxDocuments === -1 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-white'}`}>
                                            {plan.limits?.maxDocuments === -1 ? 'Illimité' : (plan.limits?.maxDocuments !== undefined && plan.limits?.maxDocuments !== null ? plan.limits.maxDocuments : '100')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-base">
                                        <span className="text-gray-500 dark:text-gray-400">Utilisateurs</span>
                                        <span className="font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-lg">{plan.limits?.maxUsers || 1}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-base">
                                        <span className="text-gray-500 dark:text-gray-400">Sociétés</span>
                                        <span className="font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-1 rounded-lg">{plan.limits?.maxCompanies || 1}</span>
                                    </div>
                                </div>

                                {plan.features?.length > 0 && (
                                    <div className="mt-6 pt-6 border-t border-gray-100/60 dark:border-gray-700/60">
                                        <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Fonctionnalités incluses</p>
                                        <ul className="space-y-3">
                                            {plan.features.slice(0, 4).map((feature, i) => (
                                                <li key={i} className="text-gray-600 dark:text-gray-300 flex items-start text-sm font-medium">
                                                    <CheckIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400 mr-2 shrink-0 border border-indigo-100 dark:border-indigo-900 rounded-md p-1 bg-indigo-50/50 dark:bg-indigo-900/20" />
                                                    {feature}
                                                </li>
                                            ))}
                                            {plan.features.length > 4 && (
                                                <li className="text-xs text-indigo-500 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/30 inline-block px-3 py-1 rounded-full mt-2">
                                                    +{plan.features.length - 4} autres
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity" aria-hidden="true" onClick={closeModal}></div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-[2rem] text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full border border-gray-100 dark:border-gray-700">
                            <div className="p-8 sm:p-10">
                                <div className="flex justify-between items-center mb-10">
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                            {editingPlan ? 'Modifier le Plan' : 'Nouveau Plan'}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium italic">Configurez les droits et tarifs de cette offre</p>
                                    </div>
                                    <button onClick={closeModal} className="w-12 h-12 flex items-center justify-center bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-600 rounded-2xl transition-all">
                                        <XMarkIcon className="w-6 h-6" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="col-span-1">
                                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Nom du Plan</label>
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => {
                                                    setName(e.target.value);
                                                    if (!editingPlan) {
                                                        setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                                                    }
                                                }}
                                                placeholder="ex: Pro Plus"
                                                className="w-full rounded-2xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-700 font-bold py-4 px-5 border transition-all text-lg"
                                            />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Slug (Auto)</label>
                                            <input
                                                type="text"
                                                required
                                                value={slug}
                                                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                                placeholder="ex: pro-plus"
                                                className="w-full rounded-2xl border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 font-mono py-4 px-5 border text-base"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Prix de vente</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                    value={price}
                                                    onChange={(e) => setPrice(parseFloat(e.target.value))}
                                                    className="w-full rounded-2xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-700 font-black py-4 px-5 border pr-20 text-xl"
                                                />
                                                <div className="absolute inset-y-0 right-4 flex items-center">
                                                    <select
                                                        value={currency}
                                                        onChange={(e) => setCurrency(e.target.value)}
                                                        className="h-10 py-0 pl-2 pr-2 border-transparent bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-200 font-bold rounded-xl focus:ring-0 focus:border-transparent text-sm"
                                                    >
                                                        <option value="TND">TND</option>
                                                        <option value="USD">$ USD</option>
                                                        <option value="EUR">€ EUR</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Périodicité</label>
                                            <select
                                                value={interval}
                                                // @ts-ignore
                                                onChange={(e) => setInterval(e.target.value)}
                                                className="w-full rounded-2xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-700 font-bold py-4 px-5 border text-lg appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] dark:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%239ca3af%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_1.25rem_center]"
                                            >
                                                <option value="month">Facturation Mensuelle</option>
                                                <option value="year">Facturation Annuelle</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-gray-700/50 p-8 rounded-[2rem] border border-slate-100/50 dark:border-gray-600/50 space-y-6">
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center">
                                            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 text-xs shadow-lg shadow-indigo-100 dark:shadow-none">
                                                <CheckIcon className="w-4 h-4" />
                                            </span>
                                            Quotas & Limites Techniques
                                        </h4>
                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1 tracking-wider">Quota Documents (-1 = ∞)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={maxDocuments}
                                                    onChange={(e) => setMaxDocuments(e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                    className="w-full rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white shadow-inner focus:border-indigo-500 focus:ring-0 text-slate-900 font-black py-4 px-5 border text-lg"
                                                />
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic">* Use -1 for unlimited</p>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1 tracking-wider">Collaborateurs Max</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={maxUsers}
                                                    onChange={(e) => setMaxUsers(e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                    className="w-full rounded-xl border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white shadow-inner focus:border-indigo-500 focus:ring-0 text-slate-900 font-black py-4 px-5 border text-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Avantages & Services (un par ligne)</label>
                                        <textarea
                                            value={featuresInput}
                                            onChange={(e) => setFeaturesInput(e.target.value)}
                                            className="w-full rounded-2xl border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-600 font-medium py-4 px-5 border text-base"
                                            rows={4}
                                            placeholder="ex: Support VIP&#10;Espace 10Go&#10;Multi-devises"
                                        />
                                    </div>

                                    <div className="flex items-center p-6 bg-slate-900 dark:bg-black/50 rounded-[1.5rem] text-white shadow-xl">
                                        <div className="flex items-center h-6">
                                            <input
                                                id="isActive"
                                                name="isActive"
                                                type="checkbox"
                                                checked={isActive}
                                                onChange={(e) => setIsActive(e.target.checked)}
                                                className="focus:ring-indigo-500 h-6 w-6 text-indigo-500 border-none rounded-lg cursor-pointer bg-slate-800"
                                            />
                                        </div>
                                        <div className="ml-4">
                                            <label htmlFor="isActive" className="font-black text-lg cursor-pointer">Rendre ce plan visible</label>
                                            <p className="text-slate-400 text-sm">Les clients pourront choisir cette offre dès validation.</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            className="flex-1 py-5 rounded-2xl bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-black hover:bg-slate-100 dark:hover:bg-slate-600 transition-all text-lg"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-[2] py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black hover:shadow-2xl hover:shadow-indigo-200 dark:hover:shadow-none transform transition-all hover:scale-[1.02] text-xl"
                                        >
                                            {editingPlan ? 'Mettre à jour l\'offre' : 'Confirmer la création'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
