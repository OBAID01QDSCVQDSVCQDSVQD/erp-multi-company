'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  BuildingOfficeIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowRightIcon,
  SparklesIcon,
  RocketLaunchIcon,
  TrophyIcon,
  ChevronDownIcon,
  Bars3Icon,
  CreditCardIcon,
  CurrencyEuroIcon,
  CogIcon,
  UserCircleIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pricingMenuOpen, setPricingMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userMenuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (userMenuTimeoutRef.current) {
        clearTimeout(userMenuTimeoutRef.current);
      }
    };
  }, []);

  const handleUserMenuMouseLeave = () => {
    userMenuTimeoutRef.current = setTimeout(() => {
      setUserMenuOpen(false);
    }, 150);
  };

  const handleUserMenuMouseEnter = () => {
    if (userMenuTimeoutRef.current) {
      clearTimeout(userMenuTimeoutRef.current);
      userMenuTimeoutRef.current = null;
    }
    setUserMenuOpen(true);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  const plans = [
    {
      name: 'Gratuit',
      price: '0',
      currency: 'DT',
      period: '/mois',
      description: 'Parfait pour tester et démarrer',
      icon: SparklesIcon,
      color: 'from-gray-400 to-gray-600',
      borderColor: 'border-gray-300',
      buttonColor: 'from-gray-600 to-gray-700',
      popular: false,
      features: [
        { text: '100 documents par an', included: true },
        { text: 'Gestion multi-entreprises', included: true },
        { text: 'Clients et fournisseurs illimités', included: true },
        { text: 'Gestion du stock', included: true },
        { text: 'Facturation de base', included: true },
        { text: 'Rapports basiques', included: true },
        { text: 'Support par email', included: true },
        { text: 'Plus de 100 documents/an', included: false },
        { text: 'Rapports avancés', included: false },
        { text: 'Support prioritaire', included: false },
        { text: 'API access', included: false },
      ],
      limit: '100 documents/an'
    },
    {
      name: 'Starter',
      price: '20',
      currency: 'DT',
      period: '/mois',
      description: 'Idéal pour les petites entreprises',
      icon: RocketLaunchIcon,
      color: 'from-blue-500 to-indigo-600',
      borderColor: 'border-blue-400',
      buttonColor: 'from-blue-600 to-indigo-700',
      popular: true,
      features: [
        { text: '1,000 documents par an', included: true },
        { text: 'Gestion multi-entreprises', included: true },
        { text: 'Clients et fournisseurs illimités', included: true },
        { text: 'Gestion du stock avancée', included: true },
        { text: 'Facturation complète', included: true },
        { text: 'Rapports détaillés', included: true },
        { text: 'Support prioritaire', included: true },
        { text: 'Export de données', included: true },
        { text: 'Personnalisation des documents', included: true },
        { text: 'Plus de 1,000 documents/an', included: false },
        { text: 'API access', included: false },
      ],
      limit: '1,000 documents/an'
    },
    {
      name: 'Premium',
      price: '40',
      currency: 'DT',
      period: '/mois',
      description: 'Pour les entreprises en croissance',
      icon: TrophyIcon,
      color: 'from-purple-500 to-pink-600',
      borderColor: 'border-purple-400',
      buttonColor: 'from-purple-600 to-pink-700',
      popular: false,
      features: [
        { text: 'Documents illimités', included: true },
        { text: 'Gestion multi-entreprises', included: true },
        { text: 'Clients et fournisseurs illimités', included: true },
        { text: 'Gestion du stock avancée', included: true },
        { text: 'Facturation complète', included: true },
        { text: 'Rapports avancés et analytics', included: true },
        { text: 'Support prioritaire 24/7', included: true },
        { text: 'Export de données illimité', included: true },
        { text: 'Personnalisation complète', included: true },
        { text: 'API access', included: true },
        { text: 'Intégrations tierces', included: true },
        { text: 'Formation personnalisée', included: true },
      ],
      limit: 'Illimité'
    }
  ];

  const faqs = [
    {
      question: 'Qu\'est-ce qu\'un document ?',
      answer: 'Un document correspond à un devis, bon de livraison, facture, commande d\'achat, bon de réception, ou facture fournisseur créé dans le système.'
    },
    {
      question: 'Puis-je changer de plan à tout moment ?',
      answer: 'Oui, vous pouvez mettre à niveau ou rétrograder votre plan à tout moment. Les changements prennent effet immédiatement.'
    },
    {
      question: 'Que se passe-t-il si j\'atteins ma limite de documents ?',
      answer: 'Vous recevrez une notification lorsque vous approchez de votre limite. Vous pourrez alors mettre à niveau votre plan pour continuer à utiliser le service.'
    },
    {
      question: 'Les données sont-elles sauvegardées ?',
      answer: 'Oui, toutes vos données sont sauvegardées automatiquement et de manière sécurisée. Vous pouvez exporter vos données à tout moment.'
    },
    {
      question: 'Y a-t-il des frais cachés ?',
      answer: 'Non, les prix affichés sont les prix finaux. Aucun frais caché, aucune surprise.'
    },
    {
      question: 'Puis-je annuler mon abonnement ?',
      answer: 'Oui, vous pouvez annuler votre abonnement à tout moment. Vous continuerez à avoir accès jusqu\'à la fin de la période payée.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center">
                <BuildingOfficeIcon className="h-8 w-8 text-indigo-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">ERP Multi</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex lg:items-center lg:space-x-8">
              <Link
                href="/features"
                className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Fonctionnalités
              </Link>

              {/* Pricing Dropdown */}
              <div 
                className="relative pb-2"
                onMouseEnter={() => setPricingMenuOpen(true)}
                onMouseLeave={() => setPricingMenuOpen(false)}
              >
                <button
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium flex items-center transition-colors"
                >
                  Tarifs & Plans
                  <ChevronDownIcon className="ml-1 h-4 w-4" />
                </button>
                {pricingMenuOpen && (
                  <div
                    className="absolute left-0 top-full w-64 z-50"
                  >
                    <div className="bg-white rounded-lg shadow-xl py-2 border border-gray-200 mt-1">
                    <Link
                      href="/pricing"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      <div className="flex items-center">
                        <CreditCardIcon className="h-5 w-5 mr-3 text-indigo-600" />
                        <div>
                          <div className="font-medium">Plans & Tarifs</div>
                          <div className="text-xs text-gray-500">Voir tous les plans disponibles</div>
                        </div>
                      </div>
                    </Link>
                    <Link
                      href="/subscriptions"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      <div className="flex items-center">
                        <CurrencyEuroIcon className="h-5 w-5 mr-3 text-indigo-600" />
                        <div>
                          <div className="font-medium">Gérer l'abonnement</div>
                          <div className="text-xs text-gray-500">Abonnements actifs</div>
                        </div>
                      </div>
                    </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Dropdown - Only for admins */}
              {session?.user?.role === 'admin' && (
                <div 
                  className="relative pb-2"
                  onMouseEnter={() => setAdminMenuOpen(true)}
                  onMouseLeave={() => setAdminMenuOpen(false)}
                >
                  <button
                    className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium flex items-center transition-colors"
                  >
                    Administration
                    <ChevronDownIcon className="ml-1 h-4 w-4" />
                  </button>
                  {adminMenuOpen && (
                    <div
                      className="absolute left-0 top-full w-64 z-50"
                    >
                      <div className="bg-white rounded-lg shadow-xl py-2 border border-gray-200 mt-1">
                      <Link
                        href="/companies"
                        className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        <div className="flex items-center">
                          <BuildingOfficeIcon className="h-5 w-5 mr-3 text-indigo-600" />
                          <div>
                            <div className="font-medium">Gérer les entreprises</div>
                            <div className="text-xs text-gray-500">Contrôler les inscriptions</div>
                          </div>
                        </div>
                      </Link>
                      <Link
                        href="/subscriptions/manage"
                        className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      >
                        <div className="flex items-center">
                          <CogIcon className="h-5 w-5 mr-3 text-indigo-600" />
                          <div>
                            <div className="font-medium">Gérer les abonnements</div>
                            <div className="text-xs text-gray-500">Activer/Désactiver</div>
                          </div>
                        </div>
                      </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {status === 'loading' ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
              ) : session?.user ? (
                <div 
                  ref={userMenuContainerRef}
                  className="relative"
                  style={{ zIndex: 1000, overflow: 'visible' }}
                  onMouseEnter={handleUserMenuMouseEnter}
                  onMouseLeave={handleUserMenuMouseLeave}
                >
                  <button
                    type="button"
                    className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    <UserCircleIcon className="h-6 w-6" />
                    <span className="hidden sm:inline">{session.user.name}</span>
                  </button>
                  {userMenuOpen && (
                    <div
                      className="absolute right-0 bg-white rounded-lg shadow-xl py-2 border border-gray-200"
                      style={{
                        top: 'calc(100% + 4px)',
                        width: '224px',
                        zIndex: 1001
                      }}
                      onMouseEnter={handleUserMenuMouseEnter}
                      onMouseLeave={handleUserMenuMouseLeave}
                    >
                      <div className="px-4 py-2 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
                        <p className="text-xs text-gray-500">{session.user.email}</p>
                        <p className="text-xs text-gray-500">{session.user.companyName}</p>
                        {session.user.role === 'admin' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                            Admin Système
                          </span>
                        )}
                      </div>
                      <Link
                        href="/dashboard"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <ChartBarIcon className="h-5 w-5 mr-2" />
                          Tableau de bord
                        </div>
                      </Link>
                      <Link
                        href="/subscriptions"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <CreditCardIcon className="h-5 w-5 mr-2" />
                          Mon abonnement
                        </div>
                      </Link>
                      <Link
                        href="/settings"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <div className="flex items-center">
                          <CogIcon className="h-5 w-5 mr-2" />
                          Paramètres
                        </div>
                      </Link>
                      <button
                        onClick={async () => {
                          await signOut({ redirect: false });
                          setUserMenuOpen(false);
                          router.refresh();
                        }}
                        className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <div className="flex items-center">
                          <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                          Déconnexion
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="ml-4 inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Créer un compte
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-indigo-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200 py-4">
              <div className="space-y-1">
                <Link
                  href="/features"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Fonctionnalités
                </Link>
                
                <div className="px-3 py-2">
                  <div className="text-base font-medium text-gray-700 mb-2">Tarifs & Plans</div>
                  <div className="pl-4 space-y-1">
                    <Link
                      href="/pricing"
                      className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Plans & Tarifs
                    </Link>
                    <Link
                      href="/subscriptions"
                      className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Gérer l'abonnement
                    </Link>
                  </div>
                </div>

                {session?.user?.role === 'admin' && (
                  <div className="px-3 py-2">
                    <div className="text-base font-medium text-gray-700 mb-2">Administration</div>
                    <div className="pl-4 space-y-1">
                      <Link
                        href="/companies"
                        className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Gérer les entreprises
                      </Link>
                      <Link
                        href="/subscriptions/manage"
                        className="block px-3 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Gérer les abonnements
                      </Link>
                    </div>
                  </div>
                )}

                {status === 'loading' ? null : session?.user ? (
                  <>
                    <div className="px-3 py-2 border-t border-gray-200 mt-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <UserCircleIcon className="h-8 w-8 text-indigo-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
                          <p className="text-xs text-gray-500">{session.user.email}</p>
                          {session.user.role === 'admin' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                              Admin Système
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <ChartBarIcon className="h-5 w-5 mr-2" />
                        Tableau de bord
                      </div>
                    </Link>
                    <Link
                      href="/subscriptions"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <CreditCardIcon className="h-5 w-5 mr-2" />
                        Mon abonnement
                      </div>
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center">
                        <CogIcon className="h-5 w-5 mr-2" />
                        Paramètres
                      </div>
                    </Link>
                    <button
                      onClick={async () => {
                        await signOut({ redirect: false });
                        setMobileMenuOpen(false);
                        router.refresh();
                      }}
                      className="w-full text-left block px-3 py-2 text-base font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <div className="flex items-center">
                        <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                        Déconnexion
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth/signin"
                      className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50 rounded-md"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Connexion
                    </Link>
                    <Link
                      href="/auth/signup"
                      className="block mx-3 mt-4 px-4 py-2.5 text-center text-base font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Créer un compte
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6">
              Tarifs & Plans
            </h1>
            <p className="text-xl sm:text-2xl text-indigo-100 max-w-3xl mx-auto">
              Choisissez le plan qui correspond le mieux à vos besoins. Tous les plans incluent toutes les fonctionnalités.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <section className="py-16 -mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-white rounded-2xl shadow-xl border-2 ${
                  plan.popular ? plan.borderColor : 'border-gray-200'
                } overflow-hidden transition-all duration-200 hover:shadow-2xl hover:scale-105`}
              >
                {plan.popular && (
                  <div className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${plan.color} text-white text-center py-2 text-sm font-semibold`}>
                    Le plus populaire
                  </div>
                )}
                
                <div className={`pt-${plan.popular ? '12' : '8'} pb-8 px-8`}>
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${plan.color} mb-4`}>
                      <plan.icon className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                    <div className="mb-4">
                      <span className="text-5xl font-extrabold text-gray-900">{plan.price}</span>
                      <span className="text-xl text-gray-600 ml-1">{plan.currency}</span>
                      <span className="text-gray-600 ml-1">{plan.period}</span>
                    </div>
                    <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                      plan.color.includes('gray') ? 'bg-gray-100 text-gray-700' :
                      plan.color.includes('blue') ? 'bg-blue-100 text-blue-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {plan.limit}
                    </div>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        {feature.included ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XMarkIcon className="h-6 w-6 text-gray-300 mr-3 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${feature.included ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/auth/signup"
                    className={`block w-full text-center px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r ${plan.buttonColor} hover:shadow-lg transition-all duration-200 transform hover:scale-105`}
                  >
                    {plan.name === 'Gratuit' ? 'Commencer gratuitement' : 'Choisir ce plan'}
                    <ArrowRightIcon className="inline-block ml-2 h-5 w-5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Comparaison des plans
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Comparez les fonctionnalités de chaque plan
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Fonctionnalité</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Gratuit</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Starter</th>
                  <th className="text-center py-4 px-6 font-semibold text-gray-900">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-4 px-6 text-gray-700">Documents par an</td>
                  <td className="py-4 px-6 text-center">100</td>
                  <td className="py-4 px-6 text-center">1,000</td>
                  <td className="py-4 px-6 text-center font-semibold text-purple-600">Illimité</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-4 px-6 text-gray-700">Multi-entreprises</td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-gray-700">Clients & Fournisseurs</td>
                  <td className="py-4 px-6 text-center font-semibold text-green-600">Illimité</td>
                  <td className="py-4 px-6 text-center font-semibold text-green-600">Illimité</td>
                  <td className="py-4 px-6 text-center font-semibold text-green-600">Illimité</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-4 px-6 text-gray-700">Gestion du stock</td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-gray-700">Rapports avancés</td>
                  <td className="py-4 px-6 text-center"><XMarkIcon className="h-6 w-6 text-gray-300 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-4 px-6 text-gray-700">Support prioritaire</td>
                  <td className="py-4 px-6 text-center"><XMarkIcon className="h-6 w-6 text-gray-300 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-4 px-6 text-gray-700">API Access</td>
                  <td className="py-4 px-6 text-center"><XMarkIcon className="h-6 w-6 text-gray-300 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><XMarkIcon className="h-6 w-6 text-gray-300 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-4 px-6 text-gray-700">Intégrations tierces</td>
                  <td className="py-4 px-6 text-center"><XMarkIcon className="h-6 w-6 text-gray-300 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><XMarkIcon className="h-6 w-6 text-gray-300 mx-auto" /></td>
                  <td className="py-4 px-6 text-center"><CheckCircleIcon className="h-6 w-6 text-green-500 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Questions fréquentes
            </h2>
            <p className="text-lg text-gray-600">
              Tout ce que vous devez savoir sur nos tarifs
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {faq.question}
                </h3>
                <p className="text-gray-600">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à commencer ?
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Commencez gratuitement dès aujourd'hui. Aucune carte bancaire requise.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Commencer gratuitement
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200"
            >
              Voir les fonctionnalités
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm mb-4 md:mb-0">
              © {new Date().getFullYear()} ERP Multi-Entreprises. Tous droits réservés.
            </p>
            <div className="flex space-x-6">
              <Link href="/" className="text-sm hover:text-white transition-colors">
                Accueil
              </Link>
              <Link href="/features" className="text-sm hover:text-white transition-colors">
                Fonctionnalités
              </Link>
              <Link href="/pricing" className="text-sm hover:text-white transition-colors">
                Tarifs
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

