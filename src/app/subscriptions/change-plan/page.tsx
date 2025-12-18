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
        borderColor: 'border-gray-300',
        buttonColor: 'from-gray-600 to-gray-700',
        description: 'Parfait pour tester et démarrer',
      };
    case 'starter':
      return {
        icon: RocketLaunchIcon,
        color: 'from-blue-500 to-indigo-600',
        borderColor: 'border-blue-400',
        buttonColor: 'from-blue-600 to-indigo-700',
        description: 'Idéal pour les petites entreprises',
      };
    case 'premium':
      return {
        icon: TrophyIcon,
        color: 'from-purple-500 to-pink-600',
        borderColor: 'border-purple-400',
        buttonColor: 'from-purple-600 to-pink-700',
        description: 'Pour les entreprises en croissance',
      };
    default:
      return {
        icon: SparklesIcon,
        color: 'from-indigo-500 to-indigo-700',
        borderColor: 'border-indigo-300',
        buttonColor: 'from-indigo-600 to-indigo-800',
        description: 'Plan personnalisé',
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
              Changer de Plan
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choisissez le plan qui correspond le mieux à vos besoins. Vous pouvez changer de plan à tout moment.
            </p>
          </div>

          {/* Current Plan Info */}
          {currentPlan && (
            <div className={`mb-8 bg-white rounded-lg shadow-md p-6 border-2 ${currentPlanStyles.borderColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Plan Actuel: {currentPlan.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {currentPlan.limits?.maxDocuments === -1 ? 'Documents Illimités' : `${currentPlan.limits?.maxDocuments ?? 100} documents`} • {currentPlan.price} {currentPlan.currency}/{currentPlan.interval === 'month' ? 'mois' : 'an'}
                  </p>
                  {currentSubscription.documentsUsed !== undefined && (
                    <p className="text-sm text-gray-500 mt-1">
                      Documents utilisés: {currentSubscription.documentsUsed} / {currentSubscription.documentsLimit === -1 ? 'Illimité' : currentSubscription.documentsLimit}
                    </p>
                  )}
                  {currentSubscription.pendingPlanChange && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm font-medium text-yellow-800">
                        ⏳ Demande en attente: Changement vers {plans.find(p => p.slug === currentSubscription.pendingPlanChange)?.name || currentSubscription.pendingPlanChange}
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        En attente d'approbation de l'administrateur
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center">
                  <CheckCircleIcon className="h-8 w-8 text-green-500" />
                </div>
              </div>
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 mb-8">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlanKey === plan.slug;
              const styles = getPlanStyles(plan.slug);
              const PlanIcon = styles.icon;

              return (
                <div
                  key={plan._id}
                  className={`relative bg-white rounded-2xl shadow-xl border-2 ${isCurrentPlan ? styles.borderColor : 'border-gray-200'
                    } overflow-hidden transition-all duration-200 hover:shadow-2xl hover:scale-105`}
                >
                  {isCurrentPlan && (
                    <div className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${styles.color} text-white text-center py-2 text-sm font-semibold`}>
                      Plan Actuel
                    </div>
                  )}

                  <div className={`${isCurrentPlan ? 'pt-12' : 'pt-8'} pb-8 px-8`}>
                    <div className="text-center mb-6">
                      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${styles.color} mb-4`}>
                        <PlanIcon className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">{styles.description}</p>
                      <div className="mb-4">
                        <span className="text-5xl font-extrabold text-gray-900">{plan.price}</span>
                        <span className="text-xl text-gray-600 ml-1">{plan.currency}</span>
                        <span className="text-gray-600 ml-1">{plan.interval === 'month' ? '/mois' : '/an'}</span>
                      </div>
                      <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${styles.color.includes('gray') ? 'bg-gray-100 text-gray-700' :
                        styles.color.includes('blue') ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                        {plan.limits?.maxDocuments === -1
                          ? 'Documents Illimités'
                          : `${(plan.limits?.maxDocuments ?? 100).toLocaleString()} documents`}
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8">
                      {/* Dynamic Document Limit Feature */}
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-bold text-gray-900 italic">
                          {plan.limits?.maxDocuments === -1
                            ? 'Documents illimités'
                            : `${(plan.limits?.maxDocuments ?? 100).toLocaleString()} documents au total`}
                        </span>
                      </li>

                      {/* Other features from database, filtering out any redundant document limit strings */}
                      {plan.features
                        .filter(f => !f.toLowerCase().includes('document'))
                        .map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">
                              {feature}
                            </span>
                          </li>
                        ))}
                    </ul>

                    <button
                      onClick={() => handleChangePlan(plan)}
                      disabled={isCurrentPlan || submitting || currentSubscription?.pendingPlanChange === plan.slug}
                      className={`block w-full text-center px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r ${styles.buttonColor} hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                    >
                      {isCurrentPlan ? (
                        'Plan Actuel'
                      ) : currentSubscription?.pendingPlanChange === plan.slug ? (
                        'Demande en attente'
                      ) : submitting ? (
                        'Envoi de la demande...'
                      ) : (
                        <>
                          Demander ce plan
                          <ArrowRightIcon className="inline-block ml-2 h-5 w-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start">
              <InformationCircleIcon className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Informations importantes</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Le changement de plan prend effet immédiatement</li>
                  <li>• Les documents déjà utilisés sont conservés</li>
                  <li>• Vous pouvez changer de plan à tout moment</li>
                  <li>• Les fonctionnalités du nouveau plan sont disponibles immédiatement</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

