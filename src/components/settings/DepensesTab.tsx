'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const depensesSchema = z.object({
  autoJusqua: z.number().min(0),
  approbationRequiseAuDela: z.number().min(0),
});

type DepensesForm = z.infer<typeof depensesSchema>;

interface DepensesTabProps {
  tenantId: string;
}

interface ExpenseCategory {
  _id: string;
  code: string;
  nom: string;
  icone?: string;
  typeGlobal?: string;
  _source: 'tenant' | 'global';
}

export default function DepensesTab({ tenantId }: DepensesTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({
    nom: '',
    code: '',
    icone: '',
    typeGlobal: 'exploitation',
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DepensesForm>({
    resolver: zodResolver(depensesSchema),
  });

  useEffect(() => {
    fetchSettings();
    fetchCategories();
  }, [tenantId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        const data = await response.json();
        reset({
          autoJusqua: data.depenses?.politiqueValidation?.autoJusqua || 500,
          approbationRequiseAuDela: data.depenses?.politiqueValidation?.approbationRequiseAuDela || 1000,
        });
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/expense-categories', {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des catégories');
    }
  };

  const onSubmit = async (data: DepensesForm) => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          depenses: {
            politiqueValidation: data,
          },
        }),
      });

      if (response.ok) {
        toast.success('Paramètres de dépenses mis à jour');
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    try {
      const response = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(newCategory),
      });

      if (response.ok) {
        toast.success('Catégorie ajoutée');
        setNewCategory({ nom: '', code: '', icone: '', typeGlobal: 'exploitation' });
        setShowAddCategory(false);
        fetchCategories();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors de l\'ajout');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/expense-categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        toast.success('Catégorie supprimée');
        fetchCategories();
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Politique de validation */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Politique de validation des dépenses
        </h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Validation automatique jusqu'à (TND)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('autoJusqua', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="500"
              />
              {errors.autoJusqua && (
                <p className="mt-1 text-sm text-red-600">{errors.autoJusqua.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approbation requise au-delà de (TND)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('approbationRequiseAuDela', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="1000"
              />
              {errors.approbationRequiseAuDela && (
                <p className="mt-1 text-sm text-red-600">{errors.approbationRequiseAuDela.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>

      {/* Catégories globales */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Catégories globales
          </h3>
          <button
            onClick={() => setShowAddCategory(true)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Ajouter une catégorie globale
          </button>
        </div>

        {showAddCategory && (
          <div className="mb-4 p-4 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Nouvelle catégorie globale</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nom de la catégorie"
                value={newCategory.nom}
                onChange={(e) => setNewCategory({ ...newCategory, nom: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Code (ex: TRANSPORT)"
                value={newCategory.code}
                onChange={(e) => setNewCategory({ ...newCategory, code: e.target.value.toUpperCase() })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Icône (ex: 🚗)"
                value={newCategory.icone}
                onChange={(e) => setNewCategory({ ...newCategory, icone: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <select
                value={newCategory.typeGlobal}
                onChange={(e) => setNewCategory({ ...newCategory, typeGlobal: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="exploitation">Exploitation</option>
                <option value="consommable">Consommable</option>
                <option value="investissement">Investissement</option>
                <option value="financier">Financier</option>
                <option value="exceptionnel">Exceptionnel</option>
              </select>
            </div>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={addCategory}
                className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
              >
                Ajouter
              </button>
              <button
                onClick={() => setShowAddCategory(false)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {categories.filter(cat => cat._source === 'global').map((category) => (
            <div key={category._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{category.icone}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{category.nom}</p>
                  <p className="text-xs text-gray-500">{category.code}</p>
                </div>
              </div>
              <button
                onClick={() => deleteCategory(category._id)}
                className="text-red-600 hover:text-red-800"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Catégories locales */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Catégories locales
        </h3>

        <div className="space-y-2">
          {categories.filter(cat => cat._source === 'tenant').map((category) => (
            <div key={category._id} className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{category.icone}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{category.nom}</p>
                  <p className="text-xs text-gray-500">{category.code}</p>
                </div>
              </div>
              <button
                onClick={() => deleteCategory(category._id)}
                className="text-red-600 hover:text-red-800"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
