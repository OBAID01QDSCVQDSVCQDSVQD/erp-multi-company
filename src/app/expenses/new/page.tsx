'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ExpenseCategoryModal from '@/components/ExpenseCategoryModal';
import { useTenantId } from '@/hooks/useTenantId';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ImageUploader, { ImageData } from '@/components/common/ImageUploader';

const expenseSchema = z.object({
  date: z.string().min(1, 'La date est requise'),
  categorieId: z.string().min(1, 'La catégorie est requise'),
  description: z.string().optional(),
  centreCoutId: z.string().optional(),
  projetId: z.string().optional(),
  
  // Montant et TVA
  montantType: z.enum(['HT', 'TTC']),
  montant: z.number().min(0.01, 'Le montant doit être supérieur à 0'),
  devise: z.string().min(1, 'La devise est requise'),
  taxCode: z.string().min(1, 'Le code TVA est requis'),
  tvaDeductiblePct: z.number().min(0).max(100),
  
  // FODEC
  fodecActif: z.boolean(),
  fodecRate: z.number().min(0).max(100),
  fodecBase: z.enum(['avantRemise', 'apresRemise']),
  
  // Retenue
  retenueActif: z.boolean(),
  retenueRate: z.number().min(0).max(100),
  retenueBase: z.enum(['TTC_TIMBRE']),
  
  // Timbre
  timbreFiscal: z.number().min(0),
  
  // Remise
  remiseGlobalePct: z.number().min(0).max(100),
  
  // Informations complémentaires
  modePaiement: z.enum(['especes', 'cheque', 'virement', 'carte', 'autre']),
  fournisseurId: z.string().optional(),
  employeId: z.string().optional(),
  referencePiece: z.string().optional(),
  notesInterne: z.string().optional(),
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
  type: 'societe' | 'particulier';
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
}

interface User {
  _id: string;
  email?: string;
  firstName: string;
  lastName: string;
}

interface Project {
  _id: string;
  name: string;
}

interface CostCenter {
  _id: string;
  code: string;
  nom: string;
}

interface TaxRate {
  _id: string;
  code: string;
  libelle: string;
  tauxPct: number;
  applicableA: string;
}

// Helper function to round to 3 decimal places
const round3 = (value: number): number => {
  return Math.round(value * 1000) / 1000;
};

export default function NewExpensePage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [images, setImages] = useState<ImageData[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [retenueManuallyDisabled, setRetenueManuallyDisabled] = useState(false); // Track if user manually disabled retenue
  
  // Display states for numeric inputs
  const [montantDisplay, setMontantDisplay] = useState<string>('');
  const [tvaDeductiblePctDisplay, setTvaDeductiblePctDisplay] = useState<string>('100');
  const [fodecRateDisplay, setFodecRateDisplay] = useState<string>('1');
  const [retenueRateDisplay, setRetenueRateDisplay] = useState<string>('0');
  const [timbreFiscalDisplay, setTimbreFiscalDisplay] = useState<string>('1');
  const [remiseGlobalePctDisplay, setRemiseGlobalePctDisplay] = useState<string>('0');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      devise: 'TND',
      taxCode: '',
      modePaiement: 'virement',
      montantType: 'HT',
      tvaDeductiblePct: 100,
      fodecActif: false,
      fodecRate: 1,
      fodecBase: 'apresRemise',
      retenueActif: false,
      retenueRate: 0,
      retenueBase: 'TTC_TIMBRE',
      timbreFiscal: 1,
      remiseGlobalePct: 0,
    },
  });

  // Watch all relevant fields for calculations
  const watchedFields = watch([
    'montantType',
    'montant',
    'taxCode',
    'tvaDeductiblePct',
    'fodecActif',
    'fodecRate',
    'fodecBase',
    'retenueActif',
    'retenueRate',
    'retenueBase',
    'timbreFiscal',
    'remiseGlobalePct',
  ]);

  const [
    montantType,
    montant,
    taxCode,
    tvaDeductiblePct,
    fodecActif,
    fodecRate,
    fodecBase,
    retenueActif,
    retenueRate,
    retenueBase,
    timbreFiscal,
    remiseGlobalePct,
  ] = watchedFields;

  // Get selected tax rate
  const selectedTaxRate = taxRates.find(rate => rate.code === taxCode);
  const tvaPct = selectedTaxRate?.tauxPct || 0;

  // Calculate all totals
  const calculations = useMemo(() => {
    if (!montant || montant <= 0) {
      return {
        baseHT: 0,
        fodec: 0,
        remise: 0,
        baseHTApresRemise: 0,
        tvaBase: 0,
        tva: 0,
        tvaNonDeductible: 0,
        retenue: 0,
        totalHT: 0,
        totalTaxes: 0,
        totalTTC: 0,
        netADecaisser: 0,
        timbreFiscal: 0,
      };
    }

    // Step 1: Calculate baseHT
    let baseHT = 0;
    if (montantType === 'HT') {
      baseHT = montant;
    } else {
      // TTC: Need to extract HT
      // TTC = HT + TVA + FODEC (if applicable) + Timbre
      // For simplicity, we'll use: HT = TTC / (1 + TVA% + FODEC% if applicable)
      const fodecFactor = fodecActif && fodecBase === 'avantRemise' ? fodecRate / 100 : 0;
      const denominator = 1 + (tvaPct / 100) + fodecFactor;
      baseHT = round3(montant / denominator);
    }

    // Step 2: Calculate remise
    const remise = round3(baseHT * (remiseGlobalePct / 100));
    const baseHTApresRemise = round3(baseHT - remise);

    // Step 3: Calculate FODEC
    let fodec = 0;
    if (fodecActif) {
      const fodecBaseValue = fodecBase === 'avantRemise' ? baseHT : baseHTApresRemise;
      fodec = round3(fodecBaseValue * (fodecRate / 100));
    }

    // Step 4: Calculate TVA base and TVA
    // TVA base = baseHT_aprèsRemise + FODEC
    const tvaBase = round3(baseHTApresRemise + fodec);
    const tvaTotal = round3(tvaBase * (tvaPct / 100));
    const tva = round3(tvaTotal * (tvaDeductiblePct / 100));
    const tvaNonDeductible = round3(tvaTotal - tva);

    // Step 5: Calculate totals first (needed for retenue calculation)
    const totalHT = round3(baseHTApresRemise + fodec);
    const totalTaxes = round3(tva + timbreFiscal);
    const totalTTC = round3(totalHT + totalTaxes);

    // Step 6: Calculate Retenue (base = TTC - Timbre)
    let retenue = 0;
    if (retenueActif) {
      // Retenue base = TTC - Timbre fiscal
      const retenueBaseValue = round3(totalTTC - timbreFiscal);
      retenue = round3(retenueBaseValue * (retenueRate / 100));
    }

    // Step 7: Calculate net à décaisser
    const netADecaisser = round3(totalTTC - retenue);

    return {
      baseHT,
      fodec,
      remise,
      baseHTApresRemise,
      tvaBase,
      tva,
      tvaNonDeductible,
      retenue,
      totalHT,
      totalTaxes,
      totalTTC,
      netADecaisser,
      timbreFiscal,
    };
  }, [
    montant,
    montantType,
    tvaPct,
    tvaDeductiblePct,
    fodecActif,
    fodecRate,
    fodecBase,
    retenueActif,
    retenueRate,
    retenueBase,
    timbreFiscal,
    remiseGlobalePct,
  ]);

  const watchedCategorieId = watch('categorieId');

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  // Définir l'utilisateur actuel comme valeur par défaut après le chargement des utilisateurs
  useEffect(() => {
    if (users.length > 0) {
      try {
        const userDataStr = localStorage.getItem('user');
        if (userDataStr) {
          const currentUser = JSON.parse(userDataStr);
          // Trouver l'utilisateur dans la liste par email ou id
          const matchedUser = users.find((u: User) => 
            u._id === currentUser.id || u.email === currentUser.email
          );
          if (matchedUser && !watch('employeId')) {
            setValue('employeId', matchedUser._id);
          }
        }
      } catch (err) {
        console.error('Erreur lors de la récupération de l\'utilisateur actuel:', err);
      }
    }
  }, [users, setValue, watch]);

  // Auto-enable Retenue à la source if totalTTC >= 1000
  useEffect(() => {
    if (calculations.totalTTC >= 1000) {
      if (!retenueManuallyDisabled) {
        setValue('retenueActif', true);
      }
    } else {
      // When totalTTC < 1000, reset the manual disable flag
      // so it can be auto-enabled again if totalTTC goes back to >= 1000
      if (retenueManuallyDisabled) {
        setRetenueManuallyDisabled(false);
      }
      // Auto-disable only if it was auto-enabled (not manually enabled)
      if (!retenueManuallyDisabled && retenueActif) {
        setValue('retenueActif', false);
      }
    }
  }, [calculations.totalTTC, retenueManuallyDisabled, retenueActif, setValue]);

  const fetchData = async () => {
    if (!tenantId) return;
    
    try {
      const [
        categoriesRes,
        suppliersRes,
        usersRes,
        taxRatesRes,
        projectsRes,
        costCentersRes,
      ] = await Promise.all([
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
        fetch('/api/projects?actif=true', {
          headers: { 'X-Tenant-Id': tenantId },
        }).catch(() => null),
        fetch('/api/cost-centers?actif=true', {
          headers: { 'X-Tenant-Id': tenantId },
        }).catch(() => null),
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.data || []);
      }

      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData.items || suppliersData || []);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (taxRatesRes.ok) {
        const taxRatesData = await taxRatesRes.json();
        setTaxRates(taxRatesData.data || []);
      }

      if (projectsRes?.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData.items || projectsData || []);
      }

      if (costCentersRes?.ok) {
        const costCentersData = await costCentersRes.json();
        setCostCenters(costCentersData.items || costCentersData || []);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err);
    }
  };

  const handleCategorySuccess = (newCategory?: ExpenseCategory) => {
    fetchData();
    if (newCategory) {
      setValue('categorieId', newCategory._id);
    }
  };

  const handleCreateCategory = () => {
    setShowCategoryModal(true);
  };

  useEffect(() => {
    if (watchedCategorieId === 'create') {
      handleCreateCategory();
      setValue('categorieId', '');
    }
  }, [watchedCategorieId, setValue]);

  const onSubmit = async (data: ExpenseForm) => {
    setLoading(true);
    setError('');

    try {
      const selectedTaxRate = taxRates.find(rate => rate.code === data.taxCode);
      
      const piecesJointes = images.map(img => ({
        nom: img.name,
        url: img.url,
        publicId: img.publicId,
        type: img.type,
        taille: img.size,
        uploadedAt: new Date().toISOString(),
        width: img.width,
        height: img.height,
        format: img.format,
      }));
      
      const expenseData = {
        ...data,
        tvaPct: selectedTaxRate?.tauxPct || 0,
        ...calculations,
        piecesJointes,
        centreCoutId: data.centreCoutId || undefined,
        projetId: data.projetId || undefined,
        fournisseurId: data.fournisseurId || undefined,
        employeId: data.employeId || undefined,
        referencePiece: data.referencePiece || undefined,
        notesInterne: data.notesInterne || undefined,
      };

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || '',
        },
        body: JSON.stringify(expenseData),
      });

      if (response.ok) {
        router.push('/expenses');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        setError(errorData.error || errorData.details || 'Erreur lors de la création de la dépense');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle dépense</h1>
          <p className="mt-1 text-sm text-gray-500">
            Créez une nouvelle dépense pour votre entreprise
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 1. Informations générales */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">1. Informations générales</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date du dépense <span className="text-red-500">*</span>
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
                  Catégorie <span className="text-red-500">*</span>
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
                  <option value="create" className="text-indigo-600 font-medium">
                    ➕ Créer une catégorie…
                  </option>
                </select>
                {errors.categorieId && (
                  <p className="mt-1 text-sm text-red-600">{errors.categorieId.message}</p>
                )}
              </div>

              {costCenters.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Centre de coût
                  </label>
                  <select
                    {...register('centreCoutId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Sélectionner un centre de coût</option>
                    {costCenters.map((cc) => (
                      <option key={cc._id} value={cc._id}>
                        {cc.code} - {cc.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {projects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Projet/Chantier
                  </label>
                  <select
                    {...register('projetId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Sélectionner un projet</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
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

          {/* 2. Montant et TVA */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">2. Montant et TVA</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de montant
                </label>
                <select
                  {...register('montantType')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="HT">HT</option>
                  <option value="TTC">TTC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={montantDisplay}
                  onChange={(e) => {
                    setMontantDisplay(e.target.value);
                    const numValue = parseFloat(e.target.value);
                    if (!isNaN(numValue)) {
                      setValue('montant', numValue);
                    }
                  }}
                  onFocus={() => {
                    if (montantDisplay) {
                      setMontantDisplay(montantDisplay);
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value);
                    if (isNaN(value) || e.target.value === '') {
                      setMontantDisplay('');
                      // Don't set to 0, keep it empty for required field validation
                    } else {
                      setMontantDisplay(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="0.000"
                />
                {errors.montant && (
                  <p className="mt-1 text-sm text-red-600">{errors.montant.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('devise')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code TVA <span className="text-red-500">*</span>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Déductible Achats (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={tvaDeductiblePctDisplay}
                  onChange={(e) => {
                    setTvaDeductiblePctDisplay(e.target.value);
                    const numValue = parseFloat(e.target.value);
                    if (!isNaN(numValue)) {
                      setValue('tvaDeductiblePct', numValue);
                    }
                  }}
                  onFocus={() => {
                    if (tvaDeductiblePctDisplay === '100') {
                      setTvaDeductiblePctDisplay('');
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value);
                    if (isNaN(value) || e.target.value === '') {
                      setTvaDeductiblePctDisplay('100');
                      setValue('tvaDeductiblePct', 100);
                    } else {
                      setTvaDeductiblePctDisplay(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="100"
                />
                <p className="mt-1 text-xs text-gray-500">Généralement 100%</p>
              </div>
            </div>

            {/* FODEC */}
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  {...register('fodecActif')}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm font-medium text-gray-700">
                  FODEC activé
                </label>
              </div>
              
              {fodecActif && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taux FODEC (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={fodecRateDisplay}
                      onChange={(e) => {
                        setFodecRateDisplay(e.target.value);
                        const numValue = parseFloat(e.target.value);
                        if (!isNaN(numValue)) {
                          setValue('fodecRate', numValue);
                        }
                      }}
                      onFocus={() => {
                        if (fodecRateDisplay === '1') {
                          setFodecRateDisplay('');
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (isNaN(value) || value === 0 || e.target.value === '') {
                          setFodecRateDisplay('1');
                          setValue('fodecRate', 1);
                        } else {
                          setFodecRateDisplay(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base de calcul
                    </label>
                    <select
                      {...register('fodecBase')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="avantRemise">Avant remise</option>
                      <option value="apresRemise">Après remise</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Retenue à la source */}
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  {...register('retenueActif')}
                  onChange={(e) => {
                    setValue('retenueActif', e.target.checked);
                    // If user manually unchecks, remember it
                    if (!e.target.checked) {
                      setRetenueManuallyDisabled(true);
                    } else {
                      // If user manually checks, allow auto-enable again
                      setRetenueManuallyDisabled(false);
                    }
                  }}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm font-medium text-gray-700">
                  Retenue à la source activée
                  {calculations.totalTTC >= 1000 && retenueActif && !retenueManuallyDisabled && (
                    <span className="ml-2 text-xs text-gray-500">(Activée automatiquement)</span>
                  )}
                </label>
              </div>
              
              {retenueActif && (
                <div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taux retenue (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={retenueRateDisplay}
                      onChange={(e) => {
                        setRetenueRateDisplay(e.target.value);
                        const numValue = parseFloat(e.target.value);
                        if (!isNaN(numValue)) {
                          setValue('retenueRate', numValue);
                        }
                      }}
                      onFocus={() => {
                        if (retenueRateDisplay === '0') {
                          setRetenueRateDisplay('');
                        }
                      }}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value);
                        if (isNaN(value) || e.target.value === '') {
                          setRetenueRateDisplay('0');
                          setValue('retenueRate', 0);
                        } else {
                          setRetenueRateDisplay(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="1.5"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Base de calcul: TTC - Timbre fiscal
                  </p>
                </div>
              )}
            </div>

            {/* Timbre fiscal */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timbre fiscal
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={timbreFiscalDisplay}
                onChange={(e) => {
                  setTimbreFiscalDisplay(e.target.value);
                  const numValue = parseFloat(e.target.value);
                  if (!isNaN(numValue)) {
                    setValue('timbreFiscal', numValue);
                  }
                }}
                onFocus={() => {
                  if (timbreFiscalDisplay === '1') {
                    setTimbreFiscalDisplay('');
                  }
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (isNaN(value) || value === 0 || e.target.value === '') {
                    setTimbreFiscalDisplay('1');
                    setValue('timbreFiscal', 1);
                  } else {
                    setTimbreFiscalDisplay(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="1.000"
              />
              <p className="mt-1 text-xs text-gray-500">Montant fixe (ex: 1.000 TND)</p>
            </div>

            {/* Remise globale */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remise globale (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={remiseGlobalePctDisplay}
                onChange={(e) => {
                  setRemiseGlobalePctDisplay(e.target.value);
                  const numValue = parseFloat(e.target.value);
                  if (!isNaN(numValue)) {
                    setValue('remiseGlobalePct', numValue);
                  }
                }}
                onFocus={() => {
                  if (remiseGlobalePctDisplay === '0') {
                    setRemiseGlobalePctDisplay('');
                  }
                }}
                onBlur={(e) => {
                  const value = parseFloat(e.target.value);
                  if (isNaN(value) || e.target.value === '') {
                    setRemiseGlobalePctDisplay('0');
                    setValue('remiseGlobalePct', 0);
                  } else {
                    setRemiseGlobalePctDisplay(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
              />
            </div>
          </div>

          {/* 3. Informations complémentaires */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">3. Informations complémentaires</h3>
            
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
                  {suppliers.map((supplier) => {
                    const supplierName = supplier.type === 'societe' 
                      ? supplier.raisonSociale 
                      : `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
                    return (
                      <option key={supplier._id} value={supplier._id}>
                        {supplierName || 'Sans nom'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employé (qui a payé)
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mode de paiement <span className="text-red-500">*</span>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Référence pièce / N° facture fournisseur
                </label>
                <input
                  type="text"
                  {...register('referencePiece')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Numéro de facture fournisseur"
                />
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

          {/* 4. Pièces jointes */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">4. Pièces jointes</h3>
            
            <ImageUploader
              images={images}
              onChange={setImages}
              maxImages={10}
              maxSizeMB={10}
              label="Images jointes (Justificatifs)"
            />
          </div>

          {/* 5. Totaux calculés */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">5. Totaux calculés</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">Base HT:</span>
                  <span className="text-sm font-medium">{calculations.baseHT.toFixed(3)} {watch('devise')}</span>
                </div>
                {calculations.remise > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">Remise:</span>
                    <span className="text-sm font-medium text-red-600">-{calculations.remise.toFixed(3)} {watch('devise')}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">Base HT après remise:</span>
                  <span className="text-sm font-medium">{calculations.baseHTApresRemise.toFixed(3)} {watch('devise')}</span>
                </div>
                {calculations.fodec > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">FODEC:</span>
                    <span className="text-sm font-medium">{calculations.fodec.toFixed(3)} {watch('devise')}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">TVA ({tvaPct}%):</span>
                  <span className="text-sm font-medium">{calculations.tva.toFixed(3)} {watch('devise')}</span>
                </div>
                {calculations.tvaNonDeductible > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">TVA non déductible:</span>
                    <span className="text-sm font-medium text-orange-600">{calculations.tvaNonDeductible.toFixed(3)} {watch('devise')}</span>
                  </div>
                )}
                {calculations.timbreFiscal > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">Timbre fiscal:</span>
                    <span className="text-sm font-medium">{calculations.timbreFiscal.toFixed(3)} {watch('devise')}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-gray-600">Total HT:</span>
                  <span className="text-sm font-medium">{calculations.totalHT.toFixed(3)} {watch('devise')}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-300">
                  <span className="text-base font-semibold text-gray-900">Total TTC:</span>
                  <span className="text-base font-bold text-indigo-600">{calculations.totalTTC.toFixed(3)} {watch('devise')}</span>
                </div>
                {calculations.retenue > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-gray-600">Retenue à la source:</span>
                    <span className="text-sm font-medium text-orange-600">{calculations.retenue.toFixed(3)} {watch('devise')}</span>
                  </div>
                )}
                {calculations.retenue > 0 && (
                  <div className="flex justify-between py-3 border-t-2 border-gray-300 mt-2">
                    <span className="text-base font-semibold text-gray-900">Net à décaisser:</span>
                    <span className="text-base font-bold text-green-600">{calculations.netADecaisser.toFixed(3)} {watch('devise')}</span>
                  </div>
                )}
              </div>
            </div>
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
              {loading ? 'Création...' : 'Créer la dépense'}
            </button>
          </div>
        </form>

        {/* Modale de catégorie */}
        <ExpenseCategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          onSuccess={handleCategorySuccess}
          onError={(error) => setError(error)}
          tenantId={tenantId}
        />
      </div>
    </DashboardLayout>
  );
}
