'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  CreditCardIcon,
  CheckCircleIcon,
  XMarkIcon,
  SparklesIcon,
  RocketLaunchIcon,
  TrophyIcon,
  ArrowRightIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Plan {
  _id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  limits: {
    maxUsers: number;
    maxCompanies: number;
    maxDocuments: number;
  };
}

const getPlanStyles = (slug: string) => {
  switch (slug) {
    case 'free':
      return {
        icon: SparklesIcon,
        color: 'from-gray-400 to-gray-600',
        borderColor: 'border-gray-300 dark:border-gray-500',
        buttonColor: 'from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800',
        description: 'Parfait pour tester et démarrer',
        badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
      };
    case 'starter':
      return {
        icon: RocketLaunchIcon,
        color: 'from-blue-500 to-indigo-600',
        borderColor: 'border-blue-400 dark:border-blue-500',
        buttonColor: 'from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
        description: 'Idéal pour les petites entreprises',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      };
    case 'premium':
      return {
        icon: TrophyIcon,
        color: 'from-purple-500 to-pink-600',
        borderColor: 'border-purple-400 dark:border-purple-500',
        buttonColor: 'from-purple-600 to-pink-700 hover:from-purple-700 hover:to-pink-800',
        description: 'Pour les entreprises en croissance',
        badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      };
    default:
      return {
        icon: SparklesIcon,
        color: 'from-indigo-500 to-indigo-700',
        borderColor: 'border-indigo-300 dark:border-indigo-500',
        buttonColor: 'from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900',
        description: 'Plan personnalisé',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      };
  }
};

export default function ChangePlanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCurrentSubscription(),
        fetchPlans()
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

        // Handle plan param from URL
        const planParam = searchParams.get('plan');
        if (planParam && data.some((p: Plan) => p.slug === planParam)) {
          setSelectedPlan(planParam);
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions');
      if (response.ok) {
        const data = await response.json();
        setCurrentSubscription(data.subscription);
        if (!selectedPlan) {
          setSelectedPlan(data.subscription?.plan || 'free');
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast.error('Erreur lors du chargement de l\'abonnement');
    }
  };

  const handleChangePlan = async (plan: Plan) => {
    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    if (currentSubscription?.plan === plan.slug) {
      toast.error('Vous êtes déjà sur ce plan');
      return;
    }

    if (currentSubscription?.pendingPlanChange === plan.slug) {
      toast.error('Vous avez déjà une demande en attente pour ce plan');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: plan.slug,
          status: 'active',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la demande de changement de plan');
      }

      const data = await response.json();

      if (data.pendingApproval) {
        toast.success(`Demande de changement vers ${plan.name} envoyée. En attente d'approbation de l'administrateur.`);
      } else {
        toast.success(`Plan changé avec succès vers ${plan.name}`);
      }

      // Refresh subscription data
      await fetchCurrentSubscription();

      // Redirect to subscriptions page after 2 seconds
      setTimeout(() => {
        router.push('/subscriptions');
      }, 2000);
    } catch (error: any) {
      console.error('Error changing plan:', error);
      toast.error(error.message || 'Erreur lors de la demande de changement de plan');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session?.user) {
    return null;
  }

  const currentPlanKey = currentSubscription?.plan || 'free';
  const currentPlan = plans.find(p => p.slug === currentPlanKey);
  const currentPlanStyles = currentPlan ? getPlanStyles(currentPlan.slug) : getPlanStyles('free');

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
              Changer de Plan
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Choisissez le plan qui correspond le mieux à vos besoins. Vous pouvez changer de plan à tout moment pour adapter votre abonnement à votre croissance.
            </p>
          </div>

          {/* Current Plan Info */}
          {currentPlan && (
            <div className={`mb-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border-2 ${currentPlanStyles.borderColor}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      Plan Actuel: {currentPlan.name}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Actif
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
                    {currentPlan.limits?.maxDocuments === -1 ? 'Documents Illimités' : `${(currentPlan.limits?.maxDocuments ?? 100).toLocaleString()} documents`} • {currentPlan.price} {currentPlan.currency}/{currentPlan.interval === 'month' ? 'mois' : 'an'}
                  </p>
                  {currentSubscription.documentsUsed !== undefined && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        <span>Utilisation des documents</span>
                        <span>{currentSubscription.documentsUsed} / {currentSubscription.documentsLimit === -1 ? '∞' : currentSubscription.documentsLimit}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div
                          className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(((currentSubscription.documentsUsed || 0) / (currentSubscription.documentsLimit || 1)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {currentSubscription.pendingPlanChange && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl">
                      <p className="text-sm font-bold text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                        <span className="animate-pulse">⏳</span> Demande en attente : Changement vers {plans.find(p => p.slug === currentSubscription.pendingPlanChange)?.name || currentSubscription.pendingPlanChange}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1 ml-6">
                        En attente d'approbation de l'administrateur.
                      </p>
                    </div>
                  )}
                </div>
                <div className="hidden md:flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-full">
                  <CheckCircleIcon className="h-10 w-10 text-green-500 dark:text-green-400" />
                </div>
              </div>
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mb-12">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlanKey === plan.slug;
              const styles = getPlanStyles(plan.slug);
              const PlanIcon = styles.icon;

              return (
                <div
                  key={plan._id}
                  className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-xl border-2 ${isCurrentPlan ? styles.borderColor : 'border-gray-100 dark:border-gray-700'
                    } overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group`}
                >
                  {isCurrentPlan && (
                    <div className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${styles.color} text-white text-center py-2 text-xs font-bold uppercase tracking-wider`}>
                      Plan Actuel
                    </div>
                  )}

                  <div className={`flex-1 ${isCurrentPlan ? 'pt-12' : 'pt-8'} p-8`}>
                    <div className="text-center mb-6">
                      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${styles.color} mb-6 shadow-lg shadow-indigo-500/20 transform group-hover:scale-110 transition-transform duration-300`}>
                        <PlanIcon className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{plan.name}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 min-h-[40px]">{styles.description}</p>
                      <div className="mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-baseline justify-center">
                          <span className="text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">{plan.price}</span>
                          <span className="text-xl font-medium text-gray-500 dark:text-gray-400 ml-1">{plan.currency}</span>
                        </div>
                        <span className="text-sm text-gray-400 dark:text-gray-500 block mt-1">{plan.interval === 'month' ? '/mois' : '/an'}</span>
                      </div>
                      <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${styles.badgeColor}`}>
                        {plan.limits?.maxDocuments === -1
                          ? 'Illimité'
                          : `${(plan.limits?.maxDocuments ?? 100).toLocaleString()} documents`}
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8">
                      {/* Dynamic Document Limit Feature */}
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-bold text-gray-900 dark:text-white italic">
                          {plan.limits?.maxDocuments === -1
                            ? 'Documents illimités'
                            : `${(plan.limits?.maxDocuments ?? 100).toLocaleString()} documents au total`}
                        </span>
                      </li>

                      {/* Other features from database */}
                      {plan.features
                        .filter(f => !f.toLowerCase().includes('document'))
                        .map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {feature}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>

                  <div className="p-8 pt-0 mt-auto">
                    <button
                      onClick={() => handleChangePlan(plan)}
                      disabled={isCurrentPlan || submitting || currentSubscription?.pendingPlanChange === plan.slug}
                      className={`block w-full text-center px-6 py-4 rounded-xl font-bold text-white bg-gradient-to-r ${styles.buttonColor} shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none`}
                    >
                      {isCurrentPlan ? (
                        'Plan Actuel'
                      ) : currentSubscription?.pendingPlanChange === plan.slug ? (
                        'Demande envoyée'
                      ) : submitting ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Traitement...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Choisir ce plan</span>
                          <ArrowRightIcon className="h-5 w-5" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-full flex-shrink-0">
                <InformationCircleIcon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2 text-lg">Informations importantes</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-blue-800 dark:text-blue-200/80">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500"></span>
                    Le changement est immédiat
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500"></span>
                    Les documents existants sont conservés
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500"></span>
                    Changement possible à tout moment
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500"></span>
                    Nouvelles fonctionnalités débloquées
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
