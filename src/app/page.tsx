'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  BuildingOfficeIcon, 
  LockClosedIcon, 
  ChartBarIcon, 
  ShoppingBagIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  CreditCardIcon,
  UserGroupIcon,
  CogIcon,
  CurrencyEuroIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';

export default function Home() {
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
    // Removed automatic redirect to allow users to visit the home page even when logged in
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
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

              {/* Admin Dropdown - Only for admin@entreprise-demo.com */}
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
      <div id="hero" className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6">
              ERP Multi-Entreprises
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Solution complète de gestion d'entreprise pour plusieurs sociétés
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/auth/signin"
                className="inline-flex items-center px-8 py-4 border border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Se connecter
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              {session?.user ? (
                <button
                  onClick={async () => {
                    await signOut({ redirect: false });
                    router.push('/auth/signup');
                  }}
                  className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105"
                >
                  Créer une entreprise
                </button>
              ) : (
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105"
                >
                  Créer une entreprise
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Fonctionnalités principales
          </h2>
          <p className="text-lg text-gray-600">
            Tout ce dont vous avez besoin pour gérer votre entreprise
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
              <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Multi-Entreprises
            </h3>
            <p className="text-gray-600">
              Gérez plusieurs entreprises depuis une seule plateforme avec isolation complète des données
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
              <ShoppingBagIcon className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Gestion Complète
            </h3>
            <p className="text-gray-600">
              Ventes, achats, stock, facturation et comptabilité dans une solution intégrée
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
              <ChartBarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Rapports Avancés
            </h3>
            <p className="text-gray-600">
              Tableaux de bord interactifs et rapports détaillés pour une meilleure prise de décision
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mb-4">
              <LockClosedIcon className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Sécurisé
            </h3>
            <p className="text-gray-600">
              Données protégées avec authentification sécurisée et isolation par entreprise
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mb-4">
              <CheckCircleIcon className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Facile à utiliser
            </h3>
            <p className="text-gray-600">
              Interface intuitive et moderne pour une prise en main rapide
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Rapide et Performant
            </h3>
            <p className="text-gray-600">
              Technologie moderne pour des performances optimales et une expérience fluide
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Prêt à commencer ?
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Créez votre compte gratuitement et commencez à gérer votre entreprise dès aujourd'hui
            </p>
            {session?.user ? (
              <button
                onClick={async () => {
                  await signOut({ redirect: false });
                  router.push('/auth/signup');
                }}
                className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Créer mon entreprise
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </button>
            ) : (
              <Link
                href="/auth/signup"
                className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Créer mon entreprise
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} ERP Multi-Entreprises. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
