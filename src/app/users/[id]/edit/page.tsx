'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Permission {
  id: string;
  label: string;
  description: string;
}

const PERMISSIONS: Permission[] = [
  // Ventes
  { id: 'customers', label: 'Clients', description: 'Gérer les clients et leurs informations' },
  { id: 'quotes', label: 'Devis', description: 'Créer et gérer les devis clients' },
  { id: 'sales_orders', label: 'Commandes clients', description: 'Gérer les commandes clients' },
  { id: 'deliveries', label: 'Bons de livraison', description: 'Créer et gérer les bons de livraison' },
  { id: 'sales_invoices', label: 'Factures clients', description: 'Créer et gérer les factures clients' },
  { id: 'customer_payments', label: 'Paiements clients', description: 'Enregistrer les paiements clients' },
  { id: 'customer_balances', label: 'Soldes clients', description: 'Consulter les soldes clients' },
  
  // Achats
  { id: 'suppliers', label: 'Fournisseurs', description: 'Gérer les fournisseurs et leurs informations' },
  { id: 'purchase_orders', label: 'Commandes d\'achat', description: 'Créer et gérer les commandes d\'achat' },
  { id: 'receipts', label: 'Bons de réception', description: 'Gérer les bons de réception' },
  { id: 'purchase_invoices', label: 'Factures fournisseurs', description: 'Gérer les factures fournisseurs' },
  { id: 'supplier_payments', label: 'Paiements fournisseurs', description: 'Enregistrer les paiements fournisseurs' },
  { id: 'supplier_balances', label: 'Soldes fournisseurs', description: 'Consulter les soldes fournisseurs' },
  
  // Stock
  { id: 'products', label: 'Produits', description: 'Gérer les produits et le catalogue' },
  { id: 'inventory', label: 'Inventaire', description: 'Gérer l\'inventaire et le stock' },
  { id: 'stock_movements', label: 'Mouvements de stock', description: 'Consulter les mouvements de stock' },
  { id: 'stock_alerts', label: 'Alertes stock', description: 'Consulter les alertes de stock minimum' },
  
  // Autres
  { id: 'expenses', label: 'Dépenses', description: 'Gérer les dépenses' },
  { id: 'reports', label: 'Rapports', description: 'Consulter les rapports et statistiques' },
  { id: 'accounting', label: 'Comptabilité', description: 'Accès aux fonctions comptables' },
  { id: 'settings', label: 'Paramètres', description: 'Modifier les paramètres du système' },
  { id: 'users', label: 'Utilisateurs', description: 'Gérer les utilisateurs et leurs permissions' },
];

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'user' as 'admin' | 'manager' | 'user',
    permissions: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const user = await response.json();
        setFormData({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          permissions: user.permissions || [],
          isActive: user.isActive,
        });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'isActive' ? (e.target as HTMLInputElement).checked : value,
    }));

    // Si le rôle est admin, ajouter automatiquement toutes les permissions
    if (name === 'role' && value === 'admin') {
      setFormData((prev) => ({
        ...prev,
        permissions: ['all'],
      }));
    } else if (name === 'role' && value !== 'admin') {
      // Retirer 'all' si on change de admin
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => p !== 'all'),
      }));
    }
  };

  const handlePermissionToggle = (permissionId: string) => {
    if (formData.role === 'admin') {
      toast.error('Les administrateurs ont toutes les permissions');
      return;
    }

    setFormData((prev) => {
      if (permissionId === 'all') {
        return {
          ...prev,
          permissions: prev.permissions.includes('all') ? [] : ['all'],
        };
      }

      const newPermissions = prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId];

      // Si toutes les permissions sont sélectionnées, ajouter 'all'
      if (newPermissions.length === PERMISSIONS.length) {
        return {
          ...prev,
          permissions: ['all'],
        };
      }

      // Retirer 'all' si on désélectionne une permission
      return {
        ...prev,
        permissions: newPermissions.filter((p) => p !== 'all'),
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (formData.role !== 'admin' && formData.permissions.length === 0) {
      toast.error('Veuillez sélectionner au moins une permission');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role: formData.role,
          permissions: formData.role === 'admin' ? ['all'] : formData.permissions,
          isActive: formData.isActive,
        }),
      });

      if (response.ok) {
        toast.success('Utilisateur modifié avec succès');
        router.push(`/users/${userId}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la modification');
      }
    } catch (err) {
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
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

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Modifier l'utilisateur
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Modifiez les informations de l'utilisateur
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
            {/* Informations personnelles */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Informations personnelles
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Rôle et statut */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Rôle et permissions
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rôle *
                  </label>
                  <select
                    id="role"
                    name="role"
                    required
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="manager">Gestionnaire</option>
                    <option value="admin">Administrateur</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formData.role === 'admin' && 'Les administrateurs ont toutes les permissions'}
                    {formData.role === 'manager' && 'Les gestionnaires peuvent gérer la plupart des modules'}
                    {formData.role === 'user' && 'Les utilisateurs ont des permissions limitées'}
                  </p>
                </div>

                {/* Statut */}
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Utilisateur actif
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Les utilisateurs inactifs ne peuvent pas se connecter
                  </p>
                </div>

                {/* Permissions */}
                {formData.role !== 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Permissions *
                    </label>
                    <div className="space-y-4">
                      {/* Ventes */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">💼 Ventes</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {PERMISSIONS.filter(p => ['customers', 'quotes', 'sales_orders', 'deliveries', 'sales_invoices', 'customer_payments', 'customer_balances'].includes(p.id)).map((permission) => (
                            <label
                              key={permission.id}
                              className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.id) || formData.permissions.includes('all')}
                                onChange={() => handlePermissionToggle(permission.id)}
                                className="sr-only"
                              />
                              <div className={`flex-shrink-0 h-5 w-5 border-2 rounded flex items-center justify-center mr-3 ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {(formData.permissions.includes(permission.id) || formData.permissions.includes('all')) && (
                                  <CheckIcon className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {permission.label}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {permission.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Achats */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📦 Achats</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {PERMISSIONS.filter(p => ['suppliers', 'purchase_orders', 'receipts', 'purchase_invoices', 'supplier_payments', 'supplier_balances'].includes(p.id)).map((permission) => (
                            <label
                              key={permission.id}
                              className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.id) || formData.permissions.includes('all')}
                                onChange={() => handlePermissionToggle(permission.id)}
                                className="sr-only"
                              />
                              <div className={`flex-shrink-0 h-5 w-5 border-2 rounded flex items-center justify-center mr-3 ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {(formData.permissions.includes(permission.id) || formData.permissions.includes('all')) && (
                                  <CheckIcon className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {permission.label}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {permission.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Stock */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🏭 Stock</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {PERMISSIONS.filter(p => ['products', 'inventory', 'stock_movements', 'stock_alerts'].includes(p.id)).map((permission) => (
                            <label
                              key={permission.id}
                              className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.id) || formData.permissions.includes('all')}
                                onChange={() => handlePermissionToggle(permission.id)}
                                className="sr-only"
                              />
                              <div className={`flex-shrink-0 h-5 w-5 border-2 rounded flex items-center justify-center mr-3 ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {(formData.permissions.includes(permission.id) || formData.permissions.includes('all')) && (
                                  <CheckIcon className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {permission.label}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {permission.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Autres */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Autres</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {PERMISSIONS.filter(p => ['expenses', 'reports', 'accounting', 'settings', 'users'].includes(p.id)).map((permission) => (
                            <label
                              key={permission.id}
                              className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissions.includes(permission.id) || formData.permissions.includes('all')}
                                onChange={() => handlePermissionToggle(permission.id)}
                                className="sr-only"
                              />
                              <div className={`flex-shrink-0 h-5 w-5 border-2 rounded flex items-center justify-center mr-3 ${
                                formData.permissions.includes(permission.id) || formData.permissions.includes('all')
                                  ? 'border-indigo-500 bg-indigo-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {(formData.permissions.includes(permission.id) || formData.permissions.includes('all')) && (
                                  <CheckIcon className="h-4 w-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {permission.label}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {permission.description}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

