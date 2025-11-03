'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const expenseSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  categorieId: z.string().min(1, 'La catégorie est requise'),
  description: z.string().min(1, 'La description est requise'),
  montant: z.number().min(0.01, 'Le montant doit être supérieur à 0'),
  devise: z.string().min(1, 'La devise est requise'),
  taxCode: z.string().min(1, 'Le code TVA est requis'),
  modePaiement: z.enum(['especes', 'cheque', 'virement', 'carte', 'autre']),
  fournisseurId: z.string().optional(),
  employeId: z.string().optional(),
  projetId: z.string().optional(),
  interventionId: z.string().optional(),
  notesInterne: z.string().optional(),
  statut: z.enum(['brouillon', 'en_attente', 'valide', 'paye', 'rejete']),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

interface ExpenseCategory {
  _id: string;
  code: string;
  nom: string;
  icone?: string;
}

interface Supplier {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
}

interface Project {
  _id: string;
  name: string;
}

interface TaxRate {
  _id: string;
  code: string;
  libelle: string;
  tauxPct: number;
  applicableA: string;
}

interface UploadedFile {
  nom: string;
  url: string;
  type: string;
  taille: number;
  uploadedAt: string;
}

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [expense, setExpense] = useState<any>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
  });

  const watchedCategorieId = watch('categorieId');

  useEffect(() => {
    if (params.id && tenantId) {
      fetchData();
    }
  }, [params.id, tenantId]);

  const fetchData = async () => {
    if (!tenantId) return;
    
    try {
      setInitialLoading(true);
      
      // Charger la dépense
      const expenseResponse = await fetch(`/api/expenses/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!expenseResponse.ok) {
        throw new Error('Erreur lors du chargement de la dépense');
      }

      const expenseData = await expenseResponse.json();
      setExpense(expenseData);
      setUploadedFiles(expenseData.piecesJointes || []);

      // Pré-remplir le formulaire
      reset({
        date: new Date(expenseData.date).toISOString().split('T')[0],
        categorieId: expenseData.categorieId._id,
        description: expenseData.description,
        montant: expenseData.montant,
        devise: expenseData.devise,
        taxCode: expenseData.taxCode || '',
        modePaiement: expenseData.modePaiement,
        fournisseurId: expenseData.fournisseurId?._id || '',
        employeId: expenseData.employeId?._id || '',
        projetId: expenseData.projetId?._id || '',
        interventionId: expenseData.interventionId?._id || '',
        notesInterne: expenseData.notesInterne || '',
        statut: expenseData.statut,
      });

      // Charger les données de référence
      const [categoriesRes, suppliersRes, usersRes, taxRatesRes] = await Promise.all([
        fetch('/api/expense-categories', {
          headers: { 'X-Tenant-Id': tenantId },
        }),
        fetch('/api/suppliers', {
          headers: { 'X-Tenant-Id': tenantId },
        }),
        fetch('/api/users', {
          headers: { 'X-Tenant-Id': tenantId },
        }),
        fetch('/api/tva/rates?actif=true', {
          headers: { 'X-Tenant-Id': tenantId },
        }),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.data || []);
      }

      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (taxRatesRes.ok) {
        const taxRatesData = await taxRatesRes.json();
        setTaxRates(taxRatesData.data || []);
      }

    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error('Error loading data:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setUploadedFiles(prev => [...prev, data.file]);
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Erreur lors de l\'upload');
        }
      }
    } catch (err) {
      setError('Erreur lors de l\'upload des fichiers');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: ExpenseForm) => {
    setLoading(true);
    setError('');

    try {
      // Trouver معدل TVA المحدد
      const selectedTaxRate = taxRates.find(rate => rate.code === data.taxCode);
      
      // Nettoyer les champs optionnels
      const expenseData = {
        ...data,
        tvaPct: selectedTaxRate?.tauxPct || 0,
        tvaDeductiblePct: 100,
        fournisseurId: data.fournisseurId || undefined,
        employeId: data.employeId || undefined,
        projetId: data.projetId || undefined,
        interventionId: data.interventionId || undefined,
        notesInterne: data.notesInterne || undefined,
        piecesJointes: uploadedFiles,
      };

      const response = await fetch(`/api/expenses/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || '',
        },
        body: JSON.stringify(expenseData),
      });

      if (response.ok) {
        router.push(`/expenses/${params.id}`);
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        setError(errorData.error || errorData.details || 'Erreur lors de la mise à jour de la dépense');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !expense) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Erreur</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <div className="mt-6">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Retour
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier la dépense</h1>
            <p className="mt-1 text-sm text-gray-500">
              {expense?.numero} - Modifié le {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations générales</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  {...register('date')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie *
                </label>
                <select
                  {...register('categorieId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.icone} {category.nom} ({category.code})
                    </option>
                  ))}
                </select>
                {errors.categorieId && (
                  <p className="mt-1 text-sm text-red-600">{errors.categorieId.message}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Description de la dépense"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Montant et TVA</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('montant', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.00"
                />
                {errors.montant && (
                  <p className="mt-1 text-sm text-red-600">{errors.montant.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise *
                </label>
                <select
                  {...register('devise')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
                {errors.devise && (
                  <p className="mt-1 text-sm text-red-600">{errors.devise.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mode de paiement *
                </label>
                <select
                  {...register('modePaiement')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="especes">Espèces</option>
                  <option value="cheque">Chèque</option>
                  <option value="virement">Virement</option>
                  <option value="carte">Carte</option>
                  <option value="autre">Autre</option>
                </select>
                {errors.modePaiement && (
                  <p className="mt-1 text-sm text-red-600">{errors.modePaiement.message}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code TVA *
              </label>
              <select
                {...register('taxCode')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Sélectionner un code TVA</option>
                {taxRates.map((rate) => (
                  <option key={rate._id} value={rate.code}>
                    {rate.code} - {rate.libelle} ({rate.tauxPct}%)
                  </option>
                ))}
              </select>
              {errors.taxCode && (
                <p className="mt-1 text-sm text-red-600">{errors.taxCode.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  {...register('statut')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="en_attente">En attente</option>
                  <option value="valide">Validé</option>
                  <option value="paye">Payé</option>
                  <option value="rejete">Rejeté</option>
                </select>
                {errors.statut && (
                  <p className="mt-1 text-sm text-red-600">{errors.statut.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Informations complémentaires</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fournisseur
                </label>
                <select
                  {...register('fournisseurId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employé
                </label>
                <select
                  {...register('employeId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Sélectionner un employé</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes internes
              </label>
              <textarea
                {...register('notesInterne')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Notes internes sur cette dépense"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pièces jointes</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Justificatifs (JPEG, PNG, PDF - Max 10MB)
              </label>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {uploading && (
                <p className="mt-1 text-sm text-blue-600">Upload en cours...</p>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Fichiers uploadés :</p>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm text-gray-700">{file.nom}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
