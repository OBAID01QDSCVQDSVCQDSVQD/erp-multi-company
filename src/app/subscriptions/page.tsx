'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  CheckCircleIcon,
  XMarkIcon,
  ArrowRightIcon,
  CreditCardIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Subscription {
  _id: string;
  plan: 'free' | 'starter' | 'premium';
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  startDate: string;
  renewalDate?: string;
  documentsUsed: number;
  documentsLimit: number;
  price: number;
  currency: string;
  autoRenew: boolean;
  pendingPlanChange?: 'free' | 'starter' | 'premium';
  pendingPlanChangeDate?: string;
  pendingPlanChangeReason?: string;
}

interface UsageHistoryItem {
  month: string;
  monthNumber: number;
  year: number;
  documents: number;
  salesDocuments: number;
  purchaseDocuments: number;
}

export default function SubscriptionsPage() {
  const { data: session, status } = useSession();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchData();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setLoadingHistory(false);
    }
  }, [session, status]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSubscription(),
        fetchPlans(),
        fetchUsageHistory()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement de l\'abonnement');
      }
      const data = await response.json();
      setSubscription(data.subscription);
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      toast.error('Erreur lors du chargement de l\'abonnement');
    }
  };

  const fetchUsageHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await fetch('/api/subscriptions/usage-history');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement de l\'historique');
      }
      const data = await response.json();
      setUsageHistory(data.usageHistory || []);
    } catch (error: any) {
      console.error('Error fetching usage history:', error);
      toast.error('Erreur lors du chargement de l\'historique d\'utilisation');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getPlanName = (slug: string) => {
    const plan = plans.find(p => p.slug === slug);
    return plan ? plan.name : slug;
  };

  const currentPlanObj = subscription ? plans.find(p => p.slug === subscription.plan) : null;

  const currentPlan = subscription ? {
    name: getPlanName(subscription.plan),
    price: currentPlanObj ? currentPlanObj.price.toString() : subscription.price.toString(),
    currency: currentPlanObj ? currentPlanObj.currency : subscription.currency,
    period: currentPlanObj && currentPlanObj.interval === 'year' ? '/an' : '/mois',
    limit: subscription.documentsLimit === -1 ? 'Illimité' : `${subscription.documentsLimit} documents aux total`,
    used: subscription.documentsUsed,
    remaining: subscription.documentsLimit === -1 ? -1 : subscription.documentsLimit - subscription.documentsUsed,
    renewalDate: subscription.renewalDate || '',
    status: subscription.status
  } : {
    name: 'Gratuit',
    price: '0',
    currency: 'TND',
    period: '/mois',
    limit: '100 documents au total',
    used: 0,
    remaining: 100,
    renewalDate: '',
    status: 'active'
  };

  const usagePercentage = subscription && subscription.documentsLimit !== -1
    ? (subscription.documentsUsed / subscription.documentsLimit) * 100
    : 0;

  // Calculate monthly average limit
  const monthlyLimit = subscription && subscription.documentsLimit !== -1
    ? subscription.documentsLimit / 12
    : 100 / 12;

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg mt-8"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
              Mon abonnement 💎
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Gérez votre abonnement et consultez votre utilisation
            </p>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link
              href="/subscriptions/change-plan"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:-translate-y-0.5"
            >
              Changer de plan
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Current Plan Section */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 space-y-6 animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className={`text-white text-center py-4 text-sm font-bold uppercase tracking-widest ${currentPlan.name === 'Gratuit'
              ? 'bg-gradient-to-r from-gray-500 to-gray-700'
              : currentPlan.name === 'Starter'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
                : 'bg-gradient-to-r from-purple-600 to-pink-700'
              }`}>
              Plan actuel : {currentPlan.name}
            </div>

            <div className="p-8">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCardIcon className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                    <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white">{currentPlan.name}</h2>
                  </div>

                  <div className="flex items-baseline mt-2">
                    <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tight">{currentPlan.price}</span>
                    <span className="text-2xl font-bold text-gray-500 dark:text-gray-400 ml-2">{currentPlan.currency}</span>
                    <span className="text-lg text-gray-400 dark:text-gray-500 ml-2">{currentPlan.period}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-3 flex items-center">
                    <ShieldCheckIcon className="h-4 w-4 mr-2" />
                    {currentPlan.limit}
                  </p>
                </div>

                <div className="mt-4 lg:mt-0 flex flex-col items-end gap-3">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold shadow-sm ${currentPlan.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800'
                    : currentPlan.status === 'cancelled'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                    }`}>
                    {currentPlan.status === 'active' ? (
                      <>
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Abonnement Actif
                      </>
                    ) : currentPlan.status === 'cancelled' ? (
                      <>
                        <XMarkIcon className="h-5 w-5 mr-2" />
                        Abonnement Annulé
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="h-5 w-5 mr-2" />
                        Inactif
                      </>
                    )}
                  </span>
                  {currentPlan.renewalDate && (
                    <div className="flex items-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                      <CalendarIcon className="h-4 w-4 mr-2 text-indigo-500" />
                      <span className="text-xs">
                        Renouvellement: <strong>{new Date(currentPlan.renewalDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Usage Bar */}
              {subscription && subscription.documentsLimit !== -1 && (
                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Utilisation des documents</span>
                    </div>
                    <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                      <span className="font-bold text-gray-900 dark:text-white">{currentPlan.used}</span> / {currentPlan.limit.replace(' documents/an', '')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${usagePercentage >= 90 ? 'bg-red-500 dark:bg-red-600' :
                        usagePercentage >= 75 ? 'bg-yellow-500 dark:bg-yellow-600' :
                          'bg-gradient-to-r from-green-400 to-green-600'
                        }`}
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center">
                      <CheckCircleIcon className="h-3 w-3 mr-1 text-green-500" />
                      {currentPlan.remaining === -1 ? 'Illimité' : `${currentPlan.remaining} documents restants`}
                    </span>
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow-sm">
                      {usagePercentage.toFixed(1)}% utilisé
                    </span>
                  </div>
                </div>
              )}

              {/* Pending Plan Change */}
              {subscription?.pendingPlanChange && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-400">
                        Demande de changement de plan en attente
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300/80">
                        <p>
                          Changement demandé vers: <strong>{getPlanName(subscription.pendingPlanChange)}</strong>
                        </p>
                        {subscription.pendingPlanChangeDate && (
                          <p className="mt-1 text-xs opacity-75">
                            Date de la demande: {new Date(subscription.pendingPlanChangeDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        )}
                        <p className="mt-2 text-xs font-semibold text-yellow-600 dark:text-yellow-500">
                          ⏳ En attente d'approbation de l'administrateur
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-6 mt-6">
                <button
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium hover:underline transition-colors"
                >
                  Annuler l'abonnement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Usage History Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              <ChartBarIcon className="h-6 w-6 mr-3 text-indigo-500" />
              Historique d'utilisation
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 ml-9">
              Consultez votre consommation mensuelle de documents
            </p>
          </div>

          <div className="p-8">
            {loadingHistory ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                ))}
              </div>
            ) : usageHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ChartBarIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Aucun historique disponible</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vos données d'utilisation apparaîtront ici.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {usageHistory.map((item, index) => {
                  const itemPercentage = monthlyLimit > 0
                    ? (item.documents / monthlyLimit) * 100
                    : 0;
                  return (
                    <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900 transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <DocumentTextIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">{item.documents}</span>
                      </div>

                      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">{item.month}</h3>

                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full ${itemPercentage >= 90 ? 'bg-red-500' :
                            itemPercentage >= 75 ? 'bg-yellow-500' :
                              'bg-indigo-500'
                            }`}
                          style={{ width: `${Math.min(itemPercentage, 100)}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-4">
                        <span>{itemPercentage.toFixed(1)}% <span className="hidden sm:inline">limite</span></span>
                        <span className="font-semibold">{Math.ceil(monthlyLimit)} max</span>
                      </div>

                      <div className="pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-center">
                          <span className="block text-gray-500 dark:text-gray-400 mb-1">Ventes</span>
                          <span className="font-bold text-gray-900 dark:text-white">{item.salesDocuments}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded text-center">
                          <span className="block text-gray-500 dark:text-gray-400 mb-1">Achats</span>
                          <span className="font-bold text-gray-900 dark:text-white">{item.purchaseDocuments}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
