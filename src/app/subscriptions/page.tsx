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
    limit: subscription.documentsLimit === -1 ? 'Illimité' : `${subscription.documentsLimit} documents au total`,
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mon abonnement</h1>
          <p className="mt-2 text-sm text-gray-600">
            Gérez votre abonnement et consultez votre utilisation
          </p>
        </div>

        {/* Current Plan Section */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement de l'abonnement...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden border-2 border-gray-300">
            <div className={`text-white text-center py-3 text-sm font-semibold ${currentPlan.name === 'Gratuit'
                ? 'bg-gradient-to-r from-gray-400 to-gray-600'
                : currentPlan.name === 'Starter'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  : 'bg-gradient-to-r from-purple-500 to-pink-600'
              }`}>
              Plan actuel
            </div>

            <div className="p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentPlan.name}</h2>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-extrabold text-gray-900">{currentPlan.price}</span>
                    <span className="text-xl text-gray-600 ml-2">{currentPlan.currency}</span>
                    <span className="text-gray-600 ml-2">{currentPlan.period}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{currentPlan.limit}</p>
                </div>
                <div className="mt-4 md:mt-0">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${currentPlan.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : currentPlan.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                    {currentPlan.status === 'active' ? (
                      <>
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Actif
                      </>
                    ) : currentPlan.status === 'cancelled' ? (
                      <>
                        <XMarkIcon className="h-5 w-5 mr-2" />
                        Annulé
                      </>
                    ) : (
                      <>
                        <XMarkIcon className="h-5 w-5 mr-2" />
                        Inactif
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Usage Bar */}
              {subscription && subscription.documentsLimit !== -1 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Utilisation des documents</span>
                    <span className="text-sm text-gray-600">
                      {currentPlan.used} / {currentPlan.limit.replace(' documents/an', '')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${usagePercentage >= 90 ? 'bg-red-500' :
                          usagePercentage >= 75 ? 'bg-yellow-500' :
                            'bg-green-500'
                        }`}
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">
                      {currentPlan.remaining === -1 ? 'Illimité' : `${currentPlan.remaining} documents restants`}
                    </span>
                    <span className="text-xs text-gray-500">
                      {usagePercentage.toFixed(1)}% utilisé
                    </span>
                  </div>
                </div>
              )}

              {/* Renewal Date */}
              {currentPlan.renewalDate && (
                <div className="flex items-center text-gray-600 mb-6">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  <span className="text-sm">
                    Prochain renouvellement: <strong>{new Date(currentPlan.renewalDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </span>
                </div>
              )}

              {/* Pending Plan Change */}
              {subscription?.pendingPlanChange && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <ClockIcon className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Demande de changement de plan en attente
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Changement demandé vers: <strong>{getPlanName(subscription.pendingPlanChange)}</strong>
                        </p>
                        {subscription.pendingPlanChangeDate && (
                          <p className="mt-1 text-xs">
                            Date de la demande: {new Date(subscription.pendingPlanChangeDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-yellow-600">
                          ⏳ En attente d'approbation de l'administrateur
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/subscriptions/change-plan"
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 border-2 border-indigo-600 text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                >
                  Changer de plan
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Link>
                <button
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 border-2 border-red-600 text-base font-medium rounded-lg text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                >
                  Annuler l'abonnement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Usage History Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Historique d'utilisation
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Consultez votre consommation mensuelle de documents
            </p>
          </div>

          <div className="p-6">
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-600">Chargement de l'historique...</p>
              </div>
            ) : usageHistory.length === 0 ? (
              <div className="text-center py-8">
                <ChartBarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600">Aucun historique disponible</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {usageHistory.map((item, index) => {
                  const itemPercentage = monthlyLimit > 0
                    ? (item.documents / monthlyLimit) * 100
                    : 0;
                  return (
                    <div key={index} className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <ChartBarIcon className="h-6 w-6 text-indigo-600" />
                        <span className="text-2xl font-bold text-gray-900">{item.documents}</span>
                      </div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">{item.month}</h3>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full ${itemPercentage >= 90 ? 'bg-red-500' :
                              itemPercentage >= 75 ? 'bg-yellow-500' :
                                'bg-indigo-500'
                            }`}
                          style={{ width: `${Math.min(itemPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{itemPercentage.toFixed(1)}% de la limite mensuelle</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                        <div>Ventes: {item.salesDocuments}</div>
                        <div>Achats: {item.purchaseDocuments}</div>
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
