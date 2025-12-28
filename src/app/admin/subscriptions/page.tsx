'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AdminLayout from '@/components/Layout/AdminLayout';
import {
    BuildingOfficeIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowPathIcon,
    PencilIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Subscription {
    _id: string;
    companyId: {
        _id: string;
        name: string;
        code: string;
        contact?: {
            email: string;
        };
    };
    plan: 'free' | 'starter' | 'premium';
    status: 'active' | 'inactive' | 'cancelled' | 'expired';
    startDate: string;
    renewalDate?: string;
    documentsUsed: number;
    documentsLimit: number;
    price: number;
    currency: string;
    autoRenew: boolean;
    cancelledAt?: string;
    pendingPlanChange?: 'free' | 'starter' | 'premium';
    pendingPlanChangeDate?: string;
    pendingPlanChangeReason?: string;
}

interface Stats {
    total: number;
    active: number;
    inactive: number;
    cancelled: number;
    free: number;
    starter: number;
    premium: number;
    pendingRequests?: number;
}

interface Plan {
    _id: string;
    name: string;
    slug: string;
    price: number;
    currency: string;
}

export default function ManageSubscriptionsPage() {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [showPendingOnly, setShowPendingOnly] = useState(false);
    const [editingPlan, setEditingPlan] = useState<string | null>(null);

    useEffect(() => {
        if (session?.user?.role === 'admin') {
            fetchPlans();
            fetchSubscriptions();
        }
    }, [session, statusFilter, planFilter, showPendingOnly]);

    const fetchPlans = async () => {
        try {
            const res = await fetch('/api/plans');
            if (res.ok) {
                const data = await res.json();
                setPlans(data);
            }
        } catch (error) {
            console.error('Error fetching plans', error);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (planFilter !== 'all') params.append('plan', planFilter);
            if (search) params.append('search', search);

            const response = await fetch(`/api/subscriptions/manage?${params.toString()}`);
            if (!response.ok) {
                throw new Error('Erreur lors du chargement des abonnements');
            }

            const data = await response.json();
            let subs = data.subscriptions || [];

            // Filter pending requests if needed
            if (showPendingOnly) {
                subs = subs.filter((sub: Subscription) => sub.pendingPlanChange);
            }

            setSubscriptions(subs);
            setStats(data.stats || null);
        } catch (error: any) {
            console.error('Error fetching subscriptions:', error);
            toast.error('Erreur lors du chargement des abonnements');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchSubscriptions();
    };

    const handleApprovePlanChange = async (subscriptionId: string, approve: boolean) => {
        try {
            console.log('Approving/rejecting plan change:', { subscriptionId, approve });

            const response = await fetch('/api/subscriptions/approve-plan-change', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscriptionId,
                    approve,
                }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error('API Error:', responseData);
                throw new Error(responseData.error || 'Erreur lors du traitement de la demande');
            }

            console.log('Success:', responseData);
            toast.success(responseData.message || (approve ? 'Changement de plan approuvé' : 'Demande rejetée'));
            fetchSubscriptions();
        } catch (error: any) {
            console.error('Error approving/rejecting plan change:', error);
            toast.error(error.message || 'Erreur lors du traitement de la demande');
        }
    };

    const updateSubscriptionStatus = async (subscriptionId: string, status: string) => {
        try {
            const response = await fetch('/api/subscriptions/manage', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscriptionId,
                    status,
                }),
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la mise à jour');
            }

            toast.success('Abonnement mis à jour avec succès');
            fetchSubscriptions();
        } catch (error: any) {
            console.error('Error updating subscription:', error);
            toast.error('Erreur lors de la mise à jour de l\'abonnement');
        }
    };

    const handleChangePlan = async (subscriptionId: string, newPlan: string) => {
        try {
            // Get the subscription to find companyId
            const subscription = subscriptions.find(s => s._id === subscriptionId);
            if (!subscription) {
                throw new Error('Abonnement non trouvé');
            }

            // Use the approve-plan-change API but with direct approval
            const response = await fetch('/api/subscriptions/approve-plan-change', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subscriptionId,
                    approve: true,
                    directChange: true, // Flag to indicate direct admin change
                    newPlan: newPlan, // The new plan to set
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors du changement de plan');
            }

            toast.success(`Plan changé avec succès vers ${getPlanName(newPlan)}`);
            setEditingPlan(null);
            fetchSubscriptions();
        } catch (error: any) {
            console.error('Error changing plan:', error);
            toast.error(error.message || 'Erreur lors du changement de plan');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'inactive':
                return 'bg-gray-100 text-gray-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            case 'expired':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'active':
                return 'Actif';
            case 'inactive':
                return 'Inactif';
            case 'cancelled':
                return 'Annulé';
            case 'expired':
                return 'Expiré';
            default:
                return status;
        }
    };

    const getPlanLabel = (planSlug: string) => {
        const plan = plans.find(p => p.slug === planSlug);
        return plan ? plan.name : planSlug;
    };

    const getPlanName = (planSlug: string) => {
        return getPlanLabel(planSlug);
    };

    const getPlanColor = (plan: string) => {
        switch (plan) {
            case 'free':
                return 'bg-gray-100 text-gray-800';
            case 'starter':
                return 'bg-blue-100 text-blue-800';
            case 'premium':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatCurrency = (amount: number, currency: string = 'TND') => {
        return new Intl.NumberFormat('fr-TN', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
        }).format(amount);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const getUsagePercentage = (used: number, limit: number) => {
        if (limit === -1) return 0; // Unlimited
        return Math.min((used / limit) * 100, 100);
    };

    if (session?.user?.role !== 'admin') {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">Vérification des droits...</div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestion des abonnements</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Gérez tous les abonnements des entreprises
                    </p>
                </div>

                {/* Statistics */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <BuildingOfficeIcon className="h-8 w-8 text-gray-400" />
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <CheckCircleIcon className="h-8 w-8 text-green-400" />
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Actifs</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <XCircleIcon className="h-8 w-8 text-red-400" />
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Annulés</p>
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.cancelled}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <ClockIcon className="h-8 w-8 text-yellow-400" />
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Inactifs</p>
                                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.inactive}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow p-6">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <ClockIcon className="h-8 w-8 text-white" />
                                </div>
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-white">Demandes en attente</p>
                                    <p className="text-2xl font-bold text-white">{subscriptions.filter(s => s.pendingPlanChange).length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pending Requests Section */}
                {subscriptions.filter(s => s.pendingPlanChange).length > 0 && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-700/50 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-500 mr-2" />
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Demandes de changement de plan en attente ({subscriptions.filter(s => s.pendingPlanChange).length})
                                </h2>
                            </div>
                            <button
                                onClick={() => setShowPendingOnly(!showPendingOnly)}
                                className={`px-4 py-2 text-sm font-medium rounded-lg ${showPendingOnly
                                    ? 'bg-yellow-600 text-white'
                                    : 'bg-white dark:bg-gray-800 text-yellow-600 dark:text-yellow-500 border border-yellow-600 dark:border-yellow-500'
                                    } hover:bg-yellow-600 hover:text-white transition-colors`}
                            >
                                {showPendingOnly ? 'Afficher tous' : 'Afficher uniquement les demandes'}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {subscriptions
                                .filter(s => s.pendingPlanChange)
                                .map((subscription) => (
                                    <div key={subscription._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border-2 border-yellow-300 dark:border-yellow-600">
                                        <div className="mb-3">
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                {typeof subscription.companyId === 'object' && subscription.companyId
                                                    ? subscription.companyId.name
                                                    : 'N/A'}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {typeof subscription.companyId === 'object' && subscription.companyId
                                                    ? subscription.companyId.contact?.email || subscription.companyId.code
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Plan actuel:</span>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPlanColor(subscription.plan)}`}>
                                                    {getPlanLabel(subscription.plan)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-600 dark:text-gray-400">Demande:</span>
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPlanColor(subscription.pendingPlanChange!)}`}>
                                                    {getPlanName(subscription.pendingPlanChange!)}
                                                </span>
                                            </div>
                                        </div>
                                        {subscription.pendingPlanChangeDate && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                                Date: {formatDate(subscription.pendingPlanChangeDate)}
                                            </p>
                                        )}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleApprovePlanChange(subscription._id, true)}
                                                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                                            >
                                                ✓ Approuver
                                            </button>
                                            <button
                                                onClick={() => handleApprovePlanChange(subscription._id, false)}
                                                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                                            >
                                                ✗ Rejeter
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <form onSubmit={handleSearch} className="flex-1">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Rechercher par entreprise ou email..."
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </form>
                        <div className="flex gap-4">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="active">Actif</option>
                                <option value="inactive">Inactif</option>
                                <option value="cancelled">Annulé</option>
                                <option value="expired">Expiré</option>
                            </select>
                            <select
                                value={planFilter}
                                onChange={(e) => setPlanFilter(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="all">Tous les plans</option>
                                {plans.map(plan => (
                                    <option key={plan._id} value={plan.slug}>{plan.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={fetchSubscriptions}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <ArrowPathIcon className="h-5 w-5 mr-2" />
                                Actualiser
                            </button>
                        </div>
                    </div>
                </div>

                {/* Subscriptions Table (Desktop) */}
                <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Entreprise
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Plan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Statut
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Utilisation
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Prix
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Renouvellement
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Demande de changement
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Chargement...
                                        </td>
                                    </tr>
                                ) : subscriptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                            Aucun abonnement trouvé
                                        </td>
                                    </tr>
                                ) : (
                                    subscriptions.map((subscription) => (
                                        <tr key={subscription._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {typeof subscription.companyId === 'object' && subscription.companyId
                                                            ? subscription.companyId.name
                                                            : 'N/A'}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {typeof subscription.companyId === 'object' && subscription.companyId
                                                            ? subscription.companyId.contact?.email || subscription.companyId.code
                                                            : 'N/A'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPlanColor(subscription.plan)}`}>
                                                    {getPlanLabel(subscription.plan)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(subscription.status)}`}>
                                                    {getStatusLabel(subscription.status)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">
                                                    {subscription.documentsUsed} / {subscription.documentsLimit === -1 ? '∞' : subscription.documentsLimit}
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                                                    <div
                                                        className={`h-2 rounded-full ${getUsagePercentage(subscription.documentsUsed, subscription.documentsLimit) >= 90
                                                            ? 'bg-red-500'
                                                            : getUsagePercentage(subscription.documentsUsed, subscription.documentsLimit) >= 75
                                                                ? 'bg-yellow-500'
                                                                : 'bg-green-500'
                                                            }`}
                                                        style={{
                                                            width: `${getUsagePercentage(subscription.documentsUsed, subscription.documentsLimit)}%`,
                                                        }}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatCurrency(subscription.price, subscription.currency)} / mois
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {formatDate(subscription.renewalDate)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {subscription.pendingPlanChange ? (
                                                    <div className="bg-yellow-50 dark:bg-yellow-900/10 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg p-3 min-w-[200px]">
                                                        <div className="flex items-center mb-2">
                                                            <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mr-2 flex-shrink-0" />
                                                            <div>
                                                                <div className="font-medium text-yellow-800 dark:text-yellow-400 text-xs">
                                                                    Demande: {getPlanName(subscription.pendingPlanChange)}
                                                                </div>
                                                                <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                                                                    Depuis: {subscription.pendingPlanChangeDate ? formatDate(subscription.pendingPlanChangeDate) : 'N/A'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 mt-2">
                                                            <button
                                                                onClick={() => handleApprovePlanChange(subscription._id, true)}
                                                                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
                                                            >
                                                                ✓ Approuver
                                                            </button>
                                                            <button
                                                                onClick={() => handleApprovePlanChange(subscription._id, false)}
                                                                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                                                            >
                                                                ✗ Rejeter
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-gray-500 text-xs">Aucune demande</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex flex-col gap-2">
                                                    {editingPlan === subscription._id ? (
                                                        <div className="flex gap-1 mb-2">
                                                            <select
                                                                defaultValue={subscription.plan}
                                                                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                onChange={(e) => {
                                                                    if (e.target.value !== subscription.plan) {
                                                                        handleChangePlan(subscription._id, e.target.value);
                                                                    } else {
                                                                        setEditingPlan(null);
                                                                    }
                                                                }}
                                                                onBlur={() => setEditingPlan(null)}
                                                                autoFocus
                                                            >
                                                                {plans.map(plan => (
                                                                    <option key={plan._id} value={plan.slug}>{plan.name}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => setEditingPlan(null)}
                                                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setEditingPlan(subscription._id)}
                                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 flex items-center gap-1"
                                                            title="Changer le plan"
                                                        >
                                                            <PencilIcon className="h-4 w-4" />
                                                            Changer plan
                                                        </button>
                                                    )}

                                                    <div className="flex gap-2">
                                                        {subscription.status === 'active' ? (
                                                            <button
                                                                onClick={() => updateSubscriptionStatus(subscription._id, 'inactive')}
                                                                className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300"
                                                            >
                                                                Désactiver
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => updateSubscriptionStatus(subscription._id, 'active')}
                                                                className="text-xs text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                                                            >
                                                                Activer
                                                            </button>
                                                        )}
                                                        {subscription.status !== 'cancelled' && (
                                                            <button
                                                                onClick={() => updateSubscriptionStatus(subscription._id, 'cancelled')}
                                                                className="text-xs text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                                            >
                                                                Annuler
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-4">
                    {loading ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            Chargement...
                        </div>
                    ) : subscriptions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            Aucun abonnement trouvé
                        </div>
                    ) : (
                        subscriptions.map((subscription) => (
                            <div key={subscription._id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex flex-col">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {typeof subscription.companyId === 'object' && subscription.companyId
                                                ? subscription.companyId.name
                                                : 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {typeof subscription.companyId === 'object' && subscription.companyId
                                                ? subscription.companyId.contact?.email || subscription.companyId.code
                                                : 'N/A'}
                                        </div>
                                    </div>
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(subscription.status)}`}>
                                        {getStatusLabel(subscription.status)}
                                    </span>
                                </div>

                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Plan:</span>
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPlanColor(subscription.plan)}`}>
                                            {getPlanLabel(subscription.plan)}
                                        </span>
                                    </div>

                                    {/* Usage Bar Mobile */}
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500 dark:text-gray-400">Utilisation:</span>
                                            <span className="text-gray-900 dark:text-white">{subscription.documentsUsed} / {subscription.documentsLimit === -1 ? '∞' : subscription.documentsLimit}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full ${getUsagePercentage(subscription.documentsUsed, subscription.documentsLimit) >= 90
                                                    ? 'bg-red-500'
                                                    : getUsagePercentage(subscription.documentsUsed, subscription.documentsLimit) >= 75
                                                        ? 'bg-yellow-500'
                                                        : 'bg-green-500'
                                                    }`}
                                                style={{
                                                    width: `${getUsagePercentage(subscription.documentsUsed, subscription.documentsLimit)}%`,
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Prix:</span>
                                        <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(subscription.price, subscription.currency)} / mois</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Renouvellement:</span>
                                        <span className="text-gray-900 dark:text-white">{formatDate(subscription.renewalDate)}</span>
                                    </div>
                                </div>

                                <div className="border-t dark:border-gray-700 pt-3 flex flex-wrap gap-2">
                                    {editingPlan === subscription._id ? (
                                        <div className="flex gap-1 w-full mb-2">
                                            <select
                                                defaultValue={subscription.plan}
                                                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                onChange={(e) => {
                                                    if (e.target.value !== subscription.plan) {
                                                        handleChangePlan(subscription._id, e.target.value);
                                                    } else {
                                                        setEditingPlan(null);
                                                    }
                                                }}
                                                onBlur={() => setEditingPlan(null)}
                                            >
                                                {plans.map(plan => (
                                                    <option key={plan._id} value={plan.slug}>{plan.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => setEditingPlan(null)}
                                                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setEditingPlan(subscription._id)}
                                            className="flex-1 py-1.5 px-3 rounded text-xs font-medium border border-indigo-200 text-indigo-600 dark:border-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                        >
                                            Changer plan
                                        </button>
                                    )}

                                    {subscription.status === 'active' ? (
                                        <button
                                            onClick={() => updateSubscriptionStatus(subscription._id, 'inactive')}
                                            className="flex-1 py-1.5 px-3 rounded text-xs font-medium border border-yellow-200 text-yellow-600 dark:border-yellow-800 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                                        >
                                            Désactiver
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => updateSubscriptionStatus(subscription._id, 'active')}
                                            className="flex-1 py-1.5 px-3 rounded text-xs font-medium border border-green-200 text-green-600 dark:border-green-800 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        >
                                            Activer
                                        </button>
                                    )}
                                    {subscription.status !== 'cancelled' && (
                                        <button
                                            onClick={() => updateSubscriptionStatus(subscription._id, 'cancelled')}
                                            className="flex-1 py-1.5 px-3 rounded text-xs font-medium border border-red-200 text-red-600 dark:border-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            Annuler
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
