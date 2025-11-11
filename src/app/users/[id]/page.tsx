'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { 
  ArrowLeftIcon, 
  PencilIcon,
  KeyIcon,
  CalendarIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  permissions?: string[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  companyId?: {
    _id: string;
    name: string;
  };
}

const PERMISSIONS_LABELS: { [key: string]: string } = {
  all: 'Toutes les permissions',
  // Ventes
  customers: 'Clients',
  quotes: 'Devis',
  sales_orders: 'Commandes clients',
  deliveries: 'Bons de livraison',
  sales_invoices: 'Factures clients',
  customer_payments: 'Paiements clients',
  customer_balances: 'Soldes clients',
  // Achats
  suppliers: 'Fournisseurs',
  purchase_orders: 'Commandes d\'achat',
  receipts: 'Bons de réception',
  purchase_invoices: 'Factures fournisseurs',
  supplier_payments: 'Paiements fournisseurs',
  supplier_balances: 'Soldes fournisseurs',
  // Stock
  products: 'Produits',
  inventory: 'Inventaire',
  stock_movements: 'Mouvements de stock',
  stock_alerts: 'Alertes stock',
  // Autres
  expenses: 'Dépenses',
  reports: 'Rapports',
  accounting: 'Comptabilité',
  settings: 'Paramètres',
  users: 'Utilisateurs',
};

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        toast.error('Erreur lors du chargement de l\'utilisateur');
        router.push('/users');
      }
    } catch (err) {
      toast.error('Erreur de connexion');
      router.push('/users');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setResettingPassword(true);
    try {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        toast.success('Mot de passe réinitialisé avec succès');
        setShowResetModal(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la réinitialisation');
      }
    } catch (err) {
      toast.error('Erreur de connexion');
    } finally {
      setResettingPassword(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'manager':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'user':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'manager':
        return 'Gestionnaire';
      case 'user':
        return 'Utilisateur';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {user.firstName} {user.lastName}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Détails de l'utilisateur
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/users/${userId}/edit`)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <PencilIcon className="h-5 w-5 mr-2" />
            Modifier
          </button>
        </div>

        {/* User Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Informations personnelles
                </h2>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Prénom
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {user.firstName}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Nom
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {user.lastName}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                      <EnvelopeIcon className="h-4 w-4 mr-1" />
                      Email
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Rôle et statut
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Rôle
                    </label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Statut
                    </label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {user.isActive ? (
                          <>
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            Actif
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="h-4 w-4 mr-1" />
                            Inactif
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 mr-2" />
                  Permissions
                </h2>
                {user.role === 'admin' || (user.permissions && user.permissions.includes('all')) ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Toutes les permissions (Administrateur)
                  </p>
                ) : user.permissions && user.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                      >
                        {PERMISSIONS_LABELS[perm] || perm}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Aucune permission spécifique
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Informations de connexion
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Date de création
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Dernière connexion
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Jamais'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reset Password Button */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <button
                  onClick={() => setShowResetModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <KeyIcon className="h-5 w-5 mr-2" />
                  Réinitialiser le mot de passe
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Réinitialiser le mot de passe
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nouveau mot de passe *
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="Minimum 6 caractères"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="Confirmer le mot de passe"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resettingPassword ? 'Réinitialisation...' : 'Réinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

