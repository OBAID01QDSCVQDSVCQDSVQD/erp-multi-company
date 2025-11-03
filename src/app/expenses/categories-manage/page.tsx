'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ExpenseCategoryModal from '@/components/ExpenseCategoryModal';
import { useTenantId } from '@/hooks/useTenantId';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface ExpenseCategory {
  _id: string;
  code: string;
  nom: string;
  description?: string;
  icone?: string;
  typeGlobal: string;
  isActive: boolean;
  createdAt: string;
  _source?: 'tenant' | 'global';
}

const typeGlobalLabels = {
  exploitation: 'Exploitation',
  consommable: 'Consommable',
  investissement: 'Investissement',
  financier: 'Financier',
  exceptionnel: 'Exceptionnel',
};

const typeGlobalColors = {
  exploitation: 'bg-blue-100 text-blue-800',
  consommable: 'bg-green-100 text-green-800',
  investissement: 'bg-purple-100 text-purple-800',
  financier: 'bg-yellow-100 text-yellow-800',
  exceptionnel: 'bg-red-100 text-red-800',
};

export default function ExpenseCategoriesManagePage() {
  const { tenantId } = useTenantId();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  useEffect(() => {
    if (tenantId) {
      fetchCategories();
    }
  }, [tenantId]);

  useEffect(() => {
    // Filtrer les catégories côté client
    if (Array.isArray(categories)) {
      const filtered = categories.filter(category =>
        category.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
  }, [categories, searchTerm]);

  const fetchCategories = async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/expense-categories', {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []); // Utiliser data.data au lieu de data
      } else {
        const errorData = await response.json();
        setError(`Erreur lors du chargement des catégories: ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/expense-categories/${categoryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchCategories();
      } else {
        const errorData = await response.json();
        if (errorData.message?.includes('utilisée par des dépenses')) {
          const forceDelete = confirm(
            'Cette catégorie est utilisée par des dépenses. Voulez-vous la supprimer quand même ?'
          );
          if (forceDelete) {
            await fetch(`/api/expense-categories/${categoryId}?force=true`, {
              method: 'DELETE',
            });
            await fetchCategories();
          }
        } else {
          setError(errorData.message || 'Erreur lors de la suppression');
        }
      }
    } catch (err) {
      setError('Erreur de connexion');
    }
  };

  const handleCategorySuccess = () => {
    fetchCategories();
    setShowForm(false);
    setEditingCategory(null);
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setShowForm(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des catégories</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérez les catégories de dépenses de votre entreprise
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={handleCreateCategory}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nouvelle catégorie
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher par nom ou code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Categories list */}
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {searchTerm ? 'Aucune catégorie trouvée' : 'Aucune catégorie'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm 
                ? 'Essayez avec d\'autres termes de recherche'
                : 'Commencez par créer votre première catégorie de dépenses.'
              }
            </p>
            {!searchTerm && (
              <div className="mt-6">
                <button
                  onClick={handleCreateCategory}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Nouvelle catégorie
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredCategories.map((category) => (
                <li key={category._id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 text-lg">
                            {category.icone || '📁'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {category.nom}
                          </p>
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {category.code}
                          </span>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeGlobalColors[category.typeGlobal as keyof typeof typeGlobalColors]}`}>
                            {typeGlobalLabels[category.typeGlobal as keyof typeof typeGlobalColors]}
                          </span>
                          {category._source === 'global' && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Globale
                            </span>
                          )}
                        </div>
                        {category.description && (
                          <p className="mt-1 text-sm text-gray-500">
                            {category.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        Créée le {new Date(category.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                      <button
                        onClick={() => handleEdit(category)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Modifier"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      {category._source !== 'global' && (
                        <button
                          onClick={() => handleDelete(category._id)}
                          className="text-red-600 hover:text-red-900"
                          title="Supprimer"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Modale de catégorie */}
        <ExpenseCategoryModal
          isOpen={showForm}
          onClose={() => {
            setShowForm(false);
            setEditingCategory(null);
          }}
          onSuccess={handleCategorySuccess}
          onError={(error) => setError(error)}
          editingCategory={editingCategory}
          tenantId={tenantId}
        />
      </div>
    </DashboardLayout>
  );
}
