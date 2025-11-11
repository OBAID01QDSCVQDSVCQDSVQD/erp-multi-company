'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BuildingOfficeIcon, 
  LockClosedIcon, 
  ChartBarIcon, 
  ShoppingBagIcon,
  ArrowRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user is already logged in (client-side only)
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const session = await response.json();
          if (session?.user) {
            router.push('/dashboard');
          }
        }
      } catch (error) {
        // Ignore errors, user is not logged in
      }
    };
    checkAuth();
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6">
              ERP Multi-Entreprises
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
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
              <Link
                href="/auth/signup"
                className="inline-flex items-center px-8 py-4 border-2 border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105"
              >
                Créer une entreprise
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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
            <Link
              href="/auth/signup"
              className="inline-flex items-center px-8 py-4 border-2 border-white text-base font-medium rounded-lg text-blue-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Créer mon entreprise
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
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
