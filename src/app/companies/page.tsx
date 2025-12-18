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
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Entreprises</h1>
            <p className="mt-1 text-sm text-gray-500">
              Administration globale de toutes les entreprises enregistrées.
            </p>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Rechercher (Nom, Code, Email)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{filteredCompanies.length} entreprises trouvées</span>
          </div>
        </div>

        {/* Companies Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entreprise
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de création
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCompanies.map((company) => (
                  <tr key={company._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-lg">
                          {company.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{company.name}</div>
                          <div className="text-sm text-gray-500">Code: <span className="font-mono bg-gray-100 px-1 rounded">{company.code}</span></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {company.contact?.email || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {company.contact?.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {company.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(company.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleCompanyStatus(company._id, company.isActive)}
                          className={`p-1 rounded-md transition-colors ${company.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                          title={company.isActive ? "Désactiver" : "Activer"}
                        >
                          <PowerIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleImpersonate(company._id)}
                          className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title="Se connecter en tant que (Impersonate)"
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deleteCompany(company._id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Aucune entreprise trouvée pour "{searchQuery}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
