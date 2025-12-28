'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import AdminLayout from '@/components/Layout/AdminLayout';
import {
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  PowerIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Company {
  _id: string;
  name: string;
  code: string;
  address?: {
    city?: string;
    country?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
  };
  isActive: boolean;
  createdAt: string;
}

export default function CompaniesPage() {
  const { data: session } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = session?.user?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      fetchCompanies();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCompanies(companies);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredCompanies(
        companies.filter(
          (c) =>
            c.name.toLowerCase().includes(lowerQuery) ||
            c.code.toLowerCase().includes(lowerQuery) ||
            c.contact?.email?.toLowerCase().includes(lowerQuery)
        )
      );
    }
  }, [searchQuery, companies]);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
        setFilteredCompanies(data);
      } else {
        toast.error('Erreur lors du chargement des entreprises');
      }
    } catch (err) {
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompanyStatus = async (companyId: string, currentStatus: boolean) => {
    if (!confirm("Êtes-vous sûr de vouloir changer le statut de cette entreprise ?")) return;

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (!response.ok) throw new Error("Erreur serveur");

      toast.success("Statut mis à jour");
      setCompanies(prev => prev.map(c => c._id === companyId ? { ...c, isActive: !currentStatus } : c));
    } catch (e) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const deleteCompany = async (companyId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette entreprise DÉFINITIVEMENT ? Cette action est irréversible.")) return;

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error("Erreur serveur");

      toast.success("Entreprise supprimée");
      setCompanies(prev => prev.filter(c => c._id !== companyId));
    } catch (e) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleImpersonate = async (companyId: string) => {
    try {
      const loadingToast = toast.loading("Connexion à l'entreprise...");

      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Impossible de se connecter");
      }

      const { impersonationToken } = await response.json();
      const { signIn } = await import('next-auth/react');

      const result = await signIn('credentials', {
        redirect: false,
        impersonationToken,
        callbackUrl: '/dashboard'
      });

      toast.dismiss(loadingToast);

      if (result?.error) {
        throw new Error("Échec de l'authentification");
      }

      toast.success("Connexion réussie");
      window.location.href = '/dashboard';

    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || "Erreur lors de la connexion");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  // Not Admin ? AdminLayout handles redirect usually, but let's be safe
  if (!isAdmin) {
    return (
      <AdminLayout>
        <div>Checking permissions...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestion des Entreprises</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Administration globale de toutes les entreprises enregistrées.
            </p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Rechercher (Nom, Code, Email)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{filteredCompanies.length} entreprises trouvées</span>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Entreprise
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date de création
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredCompanies.map((company) => (
                  <tr key={company._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                          {company.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{company.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">Code: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{company.code}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {company.contact?.email || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {company.contact?.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {company.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(company.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleCompanyStatus(company._id, company.isActive)}
                          className={`p-1 rounded-md transition-colors ${company.isActive ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                          title={company.isActive ? "Désactiver" : "Activer"}
                        >
                          <PowerIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleImpersonate(company._id)}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                          title="Se connecter en tant que (Impersonate)"
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deleteCompany(company._id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
                          title="Supprimer (Attention)"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCompanies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      Aucune entreprise trouvée pour "{searchQuery}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden space-y-4">
          {filteredCompanies.map((company) => (
            <div key={company._id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{company.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Code: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{company.code}</span></div>
                  </div>
                </div>
                {company.isActive ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircleIcon className="w-3 h-3 mr-1" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    <XCircleIcon className="w-3 h-3 mr-1" />
                    Inactive
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Email:</span>
                  <span className="text-gray-900 dark:text-white font-medium">{company.contact?.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tél:</span>
                  <span className="text-gray-900 dark:text-white font-medium">{company.contact?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Créée le:</span>
                  <span className="text-gray-900 dark:text-white font-medium">{new Date(company.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-3 flex justify-end gap-2">
                <button
                  onClick={() => toggleCompanyStatus(company._id, company.isActive)}
                  className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border transition-colors text-sm ${company.isActive
                    ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20'
                    : 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-900/30 dark:text-green-400 dark:hover:bg-green-900/20'
                    }`}
                >
                  <PowerIcon className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">{company.isActive ? "Désactiver" : "Activer"}</span>
                </button>
                <button
                  onClick={() => handleImpersonate(company._id)}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">Se connecter</span>
                </button>
                <button
                  onClick={() => deleteCompany(company._id)}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors text-sm"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only">Supprimer</span>
                </button>
              </div>
            </div>
          ))}
          {filteredCompanies.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              Aucune entreprise trouvée pour "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
