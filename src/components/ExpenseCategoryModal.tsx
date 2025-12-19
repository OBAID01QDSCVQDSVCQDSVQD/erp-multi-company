'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const categorySchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  code: z.string().min(1, 'Le code est requis').regex(/^[A-Z_]+$/, 'Le code doit contenir uniquement des lettres majuscules et des underscores'),
  typeGlobal: z.enum(['exploitation', 'consommable', 'investissement', 'financier', 'exceptionnel']),
  icone: z.string().optional(),
  description: z.string().optional(),
  portee: z.enum(['tenant', 'globale']).optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;

interface ExpenseCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (error: string) => void;
  editingCategory?: any;
  suggestionData?: any;
  tenantId?: string;
}

const typeGlobalOptions = [
  { value: 'exploitation', label: 'Exploitation' },
  { value: 'consommable', label: 'Consommable' },
  { value: 'investissement', label: 'Investissement' },
  { value: 'financier', label: 'Financier' },
  { value: 'exceptionnel', label: 'Exceptionnel' },
];

function ExpenseCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  editingCategory,
  suggestionData,
  tenantId
}: ExpenseCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      typeGlobal: 'exploitation',
      portee: 'tenant',
    },
  });

  const watchedNom = watch('nom');
  const watchedPortee = watch('portee');
  const watchedCode = watch('code');
  const watchedDescription = watch('description');
  const watchedIcone = watch('icone');
  const watchedTypeGlobal = watch('typeGlobal');

  // Auto-générer le code à partir du nom
  useEffect(() => {
    if (watchedNom && !editingCategory) {
      const code = watchedNom
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      setValue('code', code);
    }
  }, [watchedNom, setValue, editingCategory]);

  // Réinitialiser le formulaire quand la modale s'ouvre
  useEffect(() => {
    if (isOpen) {
      if (editingCategory) {
        reset({
          nom: editingCategory.nom,
          code: editingCategory.code,
          typeGlobal: editingCategory.typeGlobal,
          icone: editingCategory.icone || '',
          description: editingCategory.description || '',
          portee: editingCategory._source === 'global' ? 'globale' : 'tenant',
        });
      } else if (suggestionData) {
        reset({
          nom: suggestionData.nom,
          code: suggestionData.code,
          typeGlobal: suggestionData.typeGlobal,
          icone: suggestionData.icone || '',
          description: suggestionData.description || '',
          portee: 'tenant',
        });
      } else {
        reset({
          nom: '',
          code: '',
          typeGlobal: 'exploitation',
          icone: '',
          description: '',
          portee: 'tenant',
        });
      }
      setError('');
    }
  }, [isOpen, editingCategory, suggestionData, reset]);

  const onSubmit = async (data: CategoryForm) => {
    setLoading(true);
    setError('');

    try {
      if (!tenantId) {
        setError('Erreur: Tenant ID manquant');
        setLoading(false);
        return;
      }

      const url = editingCategory
        ? `/api/expense-categories/${editingCategory._id}`
        : '/api/expense-categories';

      const method = editingCategory ? 'PATCH' : 'POST';

      const apiData = {
        nom: data.nom,
        code: data.code,
        typeGlobal: data.typeGlobal,
        icone: data.icone,
        description: data.description,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(apiData),
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || 'Erreur lors de la sauvegarde';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = 'Erreur de connexion';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" onClick={onClose}>
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                  {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
                </h3>

                {error && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nom *
                    </label>
                    <input
                      {...register('nom')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Ex: Transport & Déplacements"
                    />
                    {errors.nom && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.nom.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Code *
                    </label>
                    <input
                      {...register('code')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Ex: DEP_TRANSPORT"
                    />
                    {errors.code && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.code.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type global *
                    </label>
                    <select
                      {...register('typeGlobal')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {typeGlobalOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.typeGlobal && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.typeGlobal.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Icône
                    </label>
                    <input
                      {...register('icone')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Ex: 🚗"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      {...register('description')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Description de la catégorie"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t dark:border-gray-600">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : (editingCategory ? 'Modifier' : 'Créer')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-600 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ExpenseCategoryModal;
