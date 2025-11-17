'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  BuildingOfficeIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BanknotesIcon,
  TruckIcon,
  CubeIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CogIcon,
  ShieldCheckIcon,
  ClockIcon,
  CurrencyEuroIcon,
  ClipboardDocumentListIcon,
  ChartBarSquareIcon,
  ArrowPathIcon,
  BellIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
  CreditCardIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

export default function FeaturesPage() {
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
  const features = [
    {
      title: 'Gestion Multi-Entreprises',
      icon: BuildingOfficeIcon,
      description: 'Gérez plusieurs entreprises depuis une seule plateforme',
      details: [
        'Création et gestion illimitée d\'entreprises',
        'Isolation complète des données entre entreprises',
        'Basculement facile entre les différentes entreprises',
        'Paramètres personnalisés par entreprise'
      ],
      color: 'blue'
    },
    {
      title: 'Gestion des Clients',
      icon: UserGroupIcon,
      description: 'Gérez votre base de données clients efficacement',
      details: [
        'Création et édition de fiches clients complètes',
        'Gestion des contacts et adresses',
        'Suivi des soldes et échéances',
        'Historique complet des transactions',
        'Alertes de paiement en retard'
      ],
      color: 'green'
    },
    {
      title: 'Gestion des Ventes',
      icon: ShoppingBagIcon,
      description: 'Parcours de vente complet de A à Z',
      details: [
        'Création de devis professionnels',
        'Conversion de devis en bons de livraison',
        'Génération de factures clients',
        'Suivi des paiements clients',
        'Gestion des avoirs et remboursements',
        'Export PDF pour tous les documents'
      ],
      color: 'purple'
    },
    {
      title: 'Gestion des Achats',
      icon: ClipboardDocumentListIcon,
      description: 'Optimisez vos achats et relations fournisseurs',
      details: [
        'Création de commandes d\'achat',
        'Gestion des bons de réception',
        'Suivi des factures fournisseurs',
        'Gestion des paiements fournisseurs',
        'Suivi des soldes fournisseurs',
        'Alertes d\'échéances de paiement'
      ],
      color: 'orange'
    },
    {
      title: 'Gestion du Stock',
      icon: CubeIcon,
      description: 'Contrôle total sur votre inventaire',
      details: [
        'Gestion complète des produits et articles',
        'Suivi des mouvements de stock en temps réel',
        'Alertes de stock minimum',
        'Gestion des entrées et sorties',
        'Traçabilité complète des mouvements',
        'Rapports d\'inventaire détaillés'
      ],
      color: 'indigo'
    },
    {
      title: 'Facturation & Paiements',
      icon: BanknotesIcon,
      description: 'Facturation professionnelle et suivi des paiements',
      details: [
        'Génération automatique de factures',
        'Calcul automatique de la TVA',
        'Gestion des remises et promotions',
        'Suivi des paiements partiels',
        'Gestion des avances clients/fournisseurs',
        'Rapports de trésorerie'
      ],
      color: 'yellow'
    },
    {
      title: 'Rapports & Statistiques',
      icon: ChartBarSquareIcon,
      description: 'Tableaux de bord et analyses détaillées',
      details: [
        'Tableau de bord personnalisable',
        'Rapports de ventes et achats',
        'Analyse de rentabilité',
        'Statistiques de stock',
        'Rapports TVA',
        'Export des données en CSV/PDF'
      ],
      color: 'pink'
    },
    {
      title: 'Gestion des Utilisateurs',
      icon: UserGroupIcon,
      description: 'Contrôle d\'accès et permissions granulaires',
      details: [
        'Création et gestion des utilisateurs',
        'Système de rôles (Admin, Manager, User)',
        'Permissions granulaires par fonctionnalité',
        'Suivi des connexions',
        'Sécurité renforcée avec authentification'
      ],
      color: 'red'
    }
  ];

  const steps = [
    {
      number: '01',
      title: 'Créer votre entreprise',
      description: 'Inscrivez-vous et créez votre première entreprise en quelques minutes. Remplissez les informations de base et configurez vos paramètres.',
      icon: BuildingOfficeIcon,
      color: 'from-blue-500 to-blue-600'
    },
    {
      number: '02',
      title: 'Configurer vos paramètres',
      description: 'Personnalisez votre ERP : définissez vos taux de TVA, vos modes de paiement, vos unités de mesure et vos préférences.',
      icon: CogIcon,
      color: 'from-purple-500 to-purple-600'
    },
    {
      number: '03',
      title: 'Ajouter vos données',
      description: 'Importez ou créez vos produits, clients, fournisseurs et autres données essentielles pour démarrer.',
      icon: ClipboardDocumentListIcon,
      color: 'from-green-500 to-green-600'
    },
    {
      number: '04',
      title: 'Commencer à utiliser',
      description: 'Créez vos premiers documents : devis, factures, commandes. Le système calcule automatiquement tous les totaux.',
      icon: ArrowRightIcon,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  const benefits = [
    {
      icon: ClockIcon,
      title: 'Gain de temps',
      description: 'Automatisation des calculs et génération automatique des documents'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Sécurité',
      description: 'Données protégées avec isolation complète entre entreprises'
    },
    {
      icon: ChartBarIcon,
      title: 'Visibilité',
      description: 'Tableaux de bord et rapports pour une meilleure prise de décision'
    },
    {
      icon: DevicePhoneMobileIcon,
      title: 'Accessible partout',
      description: 'Interface responsive accessible depuis n\'importe quel appareil'
    },
    {
      icon: ArrowPathIcon,
      title: 'Synchronisation',
      description: 'Données synchronisées en temps réel sur tous vos appareils'
    },
    {
      icon: BellIcon,
      title: 'Alertes intelligentes',
      description: 'Notifications pour les échéances, stocks faibles et événements importants'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: { [key: string]: { bg: string; text: string; border: string } } = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200' },
      yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
      pink: { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
      red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' }
    };
    return colors[color] || colors.blue;
  };

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
              {session?.user?.email === 'admin@entreprise-demo.com' && (
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
                        {session.user.email === 'admin@entreprise-demo.com' && (
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

                {session?.user?.email === 'admin@entreprise-demo.com' && (
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
                          {session.user.email === 'admin@entreprise-demo.com' && (
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
              Fonctionnalités & Guide d'utilisation
            </h1>
            <p className="text-xl sm:text-2xl text-indigo-100 max-w-3xl mx-auto">
              Découvrez toutes les fonctionnalités de notre ERP et apprenez à les utiliser efficacement
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Steps */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Démarrage rapide
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              En 4 étapes simples, vous serez opérationnel
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className={`bg-gradient-to-br ${step.color} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow duration-200 h-full`}>
                  <div className="text-4xl font-bold opacity-50 mb-4">{step.number}</div>
                  <div className="mb-4">
                    <step.icon className="h-10 w-10 mb-4" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-white/90 text-sm leading-relaxed">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRightIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Fonctionnalités détaillées
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Explorez toutes les capacités de notre solution ERP
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {features.map((feature, index) => {
              const colors = getColorClasses(feature.color);
              return (
                <div
                  key={index}
                  className={`bg-white rounded-xl shadow-lg border-2 ${colors.border} hover:shadow-xl transition-all duration-200 overflow-hidden`}
                >
                  <div className="p-6">
                    <div className="flex items-start">
                      <div className={`${colors.bg} rounded-lg p-3 mr-4 flex-shrink-0`}>
                        <feature.icon className={`h-8 w-8 ${colors.text}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          {feature.description}
                        </p>
                        <ul className="space-y-2">
                          {feature.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start">
                              <CheckCircleIcon className={`h-5 w-5 ${colors.text} mr-2 flex-shrink-0 mt-0.5`} />
                              <span className="text-gray-700 text-sm">{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Pourquoi choisir notre ERP ?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Des avantages concrets pour votre entreprise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow duration-200"
              >
                <div className="bg-indigo-100 rounded-lg p-3 w-fit mb-4">
                  <benefit.icon className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-gray-600">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Usage Guide Section */}
      <section className="py-16 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Guide d'utilisation par module
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Apprenez à utiliser chaque fonctionnalité étape par étape
            </p>
          </div>

          <div className="space-y-8">
            {/* Module 1: Ventes */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center mb-6">
                <div className="bg-purple-100 rounded-lg p-3 mr-4">
                  <ShoppingBagIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Module Ventes</h3>
                  <p className="text-gray-600">Gestion complète du cycle de vente</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">1. Créer un Devis</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Allez dans <strong>Ventes → Devis → Nouveau</strong>. Sélectionnez un client, ajoutez des produits, définissez les quantités et remises. Le système calcule automatiquement les totaux HT, TVA et TTC.
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">2. Convertir en Bon de Livraison</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Depuis le devis validé, cliquez sur <strong>"Convertir en BL"</strong>. Le stock sera automatiquement déduit pour les produits stockés. Vous pouvez générer un PDF du BL.
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">3. Créer une Facture</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Vous pouvez créer une facture directement ou convertir un BL/Devis. La facture inclut automatiquement la TVA, FODEC et timbre fiscal selon vos paramètres.
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">4. Enregistrer un Paiement</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Depuis la facture ou <strong>Ventes → Paiements</strong>, enregistrez les paiements clients. Vous pouvez utiliser les avances clients si disponibles.
                  </p>
                </div>
              </div>
            </div>

            {/* Module 2: Achats */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center mb-6">
                <div className="bg-orange-100 rounded-lg p-3 mr-4">
                  <ClipboardDocumentListIcon className="h-8 w-8 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Module Achats</h3>
                  <p className="text-gray-600">Gestion des achats et fournisseurs</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">1. Créer une Commande d'Achat</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Allez dans <strong>Achats → Commandes d'achat → Nouveau</strong>. Sélectionnez un fournisseur, ajoutez les produits à commander avec les quantités et prix.
                  </p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">2. Enregistrer la Réception</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Lors de la réception des marchandises, créez un <strong>Bon de Réception</strong> depuis la commande. Le stock sera automatiquement mis à jour.
                  </p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">3. Saisir la Facture Fournisseur</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Enregistrez la facture fournisseur dans <strong>Achats → Factures fournisseurs</strong>. Le système calcule automatiquement les totaux et la TVA déductible.
                  </p>
                </div>
                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">4. Effectuer le Paiement</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Enregistrez les paiements fournisseurs depuis la facture ou <strong>Achats → Paiements fournisseurs</strong>. Suivez les soldes et échéances.
                  </p>
                </div>
              </div>
            </div>

            {/* Module 3: Stock */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center mb-6">
                <div className="bg-indigo-100 rounded-lg p-3 mr-4">
                  <CubeIcon className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Module Stock</h3>
                  <p className="text-gray-600">Gestion de l'inventaire</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-indigo-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">1. Créer un Produit</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Allez dans <strong>Stock → Produits → Nouveau</strong>. Définissez le SKU, nom, catégorie, prix, stock minimum et maximum. Activez le suivi de stock si nécessaire.
                  </p>
                </div>
                <div className="border-l-4 border-indigo-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">2. Suivre les Mouvements</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Consultez <strong>Stock → Mouvements de stock</strong> pour voir tous les mouvements (entrées, sorties) générés automatiquement lors des BL et factures.
                  </p>
                </div>
                <div className="border-l-4 border-indigo-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">3. Alertes Stock</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Le système vous alerte automatiquement dans <strong>Stock → Alertes stock</strong> lorsque le stock est en dessous du minimum défini.
                  </p>
                </div>
                <div className="border-l-4 border-indigo-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">4. Inventaire</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Utilisez <strong>Stock → Inventaire</strong> pour effectuer des inventaires physiques et ajuster les quantités en stock.
                  </p>
                </div>
              </div>
            </div>

            {/* Module 4: Clients & Fournisseurs */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center mb-6">
                <div className="bg-green-100 rounded-lg p-3 mr-4">
                  <UserGroupIcon className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Clients & Fournisseurs</h3>
                  <p className="text-gray-600">Gestion de la relation client/fournisseur</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">1. Créer un Client</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Allez dans <strong>Ventes → Clients → Nouveau</strong>. Remplissez les informations (nom, adresse, contacts, conditions de paiement). Le système génère automatiquement un solde.
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">2. Suivre les Soldes</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Consultez <strong>Ventes → Soldes clients</strong> pour voir tous les soldes avec le vieillissement (0-30, 31-60, 61-90, &gt;90 jours).
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">3. Historique des Transactions</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Cliquez sur <strong>"Voir détails"</strong> depuis les soldes pour voir toutes les transactions (factures, paiements, avoirs) d'un client ou fournisseur.
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-gray-900 mb-2">4. Gérer les Fournisseurs</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Même processus pour les fournisseurs dans <strong>Achats → Fournisseurs</strong>. Suivez les soldes et échéances de paiement.
                  </p>
                </div>
              </div>
            </div>
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
            Créez votre compte gratuitement et découvrez toutes ces fonctionnalités par vous-même
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Créer mon compte
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/auth/signin"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200"
            >
              Se connecter
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

