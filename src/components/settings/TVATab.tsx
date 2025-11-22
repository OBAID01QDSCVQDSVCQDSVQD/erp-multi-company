'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

const tvaSettingsSchema = z.object({
  tauxParDefautPct: z.number().min(0).max(100),
  regimeParDefautCode: z.string().min(1, 'Le régime par défaut est requis'),
  arrondi: z.enum(['ligne', 'document']),
  prixIncluentTVA: z.boolean(),
  timbreFiscal: z.object({
    actif: z.boolean(),
    montantFixe: z.number().min(0),
  }),
  fodec: z.object({
    actif: z.boolean(),
    tauxPct: z.number().min(0).max(100),
  }),
  retenueSource: z.object({
    actif: z.boolean(),
    tauxPct: z.number().min(0).max(100),
    appliquerSur: z.enum(['services', 'tous']),
  }),
});

const taxRateSchema = z.object({
  code: z.string().min(1, 'Le code est requis'),
  libelle: z.string().min(1, 'Le libellé est requis'),
  tauxPct: z.number().min(0).max(100),
  applicableA: z.enum(['ventes', 'achats', 'les_deux']),
  actif: z.boolean(),
});

type TVASettingsForm = z.infer<typeof tvaSettingsSchema>;
type TaxRateForm = z.infer<typeof taxRateSchema>;

interface TaxRate {
  _id: string;
  code: string;
  libelle: string;
  tauxPct: number;
  applicableA: string;
  actif: boolean;
}

interface TVATabProps {
  tenantId: string;
}

export default function TVATab({ tenantId }: TVATabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [showAddRate, setShowAddRate] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [newRate, setNewRate] = useState<TaxRateForm>({
    code: '',
    libelle: '',
    tauxPct: 19,
    applicableA: 'les_deux',
    actif: true,
  });

  const {
    register: registerSettings,
    handleSubmit: handleSubmitSettings,
    formState: { errors: settingsErrors },
    reset: resetSettings,
    watch: watchSettings,
  } = useForm<TVASettingsForm>({
    resolver: zodResolver(tvaSettingsSchema),
  });

  const {
    register: registerRate,
    handleSubmit: handleSubmitRate,
    formState: { errors: rateErrors },
    reset: resetRate,
  } = useForm<TaxRateForm>({
    resolver: zodResolver(taxRateSchema),
  });

  const retenueSourceActif = watchSettings('retenueSource.actif');

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading TVA settings data...');
      console.log('🏢 Tenant ID:', tenantId);
      
      // Charger les paramètres TVA
      const settingsResponse = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId },
      });

      console.log('📥 Settings response status:', settingsResponse.status);
      
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        console.log('📋 Settings data loaded:', settingsData);
        console.log('📋 TVA section:', settingsData.tva);
        
        const formData = {
          tauxParDefautPct: settingsData.tva?.tauxParDefautPct || 19,
          regimeParDefautCode: settingsData.tva?.regimeParDefautCode || 'TN19',
          arrondi: settingsData.tva?.arrondi || 'ligne',
          prixIncluentTVA: settingsData.tva?.prixIncluentTVA || false,
          timbreFiscal: {
            actif: settingsData.tva?.timbreFiscal?.actif || false,
            montantFixe: settingsData.tva?.timbreFiscal?.montantFixe || 1.0,
          },
          fodec: {
            actif: settingsData.tva?.fodec?.actif || false,
            tauxPct: settingsData.tva?.fodec?.tauxPct || 1,
          },
          retenueSource: settingsData.tva?.retenueSource || {
            actif: false,
            tauxPct: 0,
            appliquerSur: 'services',
          },
        };
        
        console.log('📝 Form data to reset:', formData);
        resetSettings(formData);
      } else {
        console.error('❌ Failed to load settings:', settingsResponse.status);
      }

      // Charger les taux de TVA
      console.log('🔄 Loading tax rates...');
      const ratesResponse = await fetch('/api/tva/rates?actif=false', {
        headers: { 'X-Tenant-Id': tenantId },
      });

      console.log('📥 Tax rates response status:', ratesResponse.status);
      
      if (ratesResponse.ok) {
        const ratesData = await ratesResponse.json();
        console.log('📋 Tax rates loaded:', ratesData);
        setTaxRates(ratesData.data || []);
      } else {
        console.error('❌ Failed to load tax rates:', ratesResponse.status);
      }

    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitSettings = async (data: TVASettingsForm) => {
    try {
      setSaving(true);
      console.log('🚀 Starting TVA settings save...');
      console.log('📤 Sending TVA settings:', data);
      console.log('🏢 Tenant ID:', tenantId);
      
      if (!tenantId) {
        console.error('❌ No tenant ID available');
        toast.error('ID de l\'entreprise manquant');
        setSaving(false);
        return;
      }

      // Validate data before sending
      console.log('🔍 Validating form data...');
      const validationResult = tvaSettingsSchema.safeParse(data);
      if (!validationResult.success) {
        console.error('❌ Form validation failed:', validationResult.error);
        toast.error('Données invalides');
        setSaving(false);
        return;
      }
      console.log('✅ Form validation passed');
      
      const response = await fetch('/api/settings/tva', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(data),
      });

      console.log('📥 TVA settings response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ TVA settings updated successfully:', result);
        toast.success('Paramètres TVA mis à jour');
      } else {
        const errorData = await response.json();
        console.error('❌ TVA settings update error:', errorData);
        toast.error(errorData.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('💥 TVA settings update error:', error);
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const onSubmitRate = async (data: TaxRateForm) => {
    try {
      setSaving(true);
      const isEditing = !!editingRate;
      const url = isEditing ? `/api/tva/rates/${editingRate!.code}` : '/api/tva/rates';
      const method = isEditing ? 'PATCH' : 'POST';
      const payload = isEditing ? { 
        libelle: data.libelle,
        tauxPct: data.tauxPct,
        applicableA: data.applicableA,
        actif: data.actif,
      } : data;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Taux de TVA sauvegardé');
        setShowAddRate(false);
        setEditingRate(null);
        resetRate();
        fetchData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const deleteRate = async (code: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce taux de TVA ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tva/rates/${code}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        toast.success('Taux de TVA supprimé');
        fetchData();
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    }
  };

  const startEdit = (rate: TaxRate) => {
    setEditingRate(rate);
    const formVals = {
      code: rate.code,
      libelle: rate.libelle,
      tauxPct: rate.tauxPct,
      applicableA: rate.applicableA as any,
      actif: rate.actif,
    } as TaxRateForm;
    setNewRate(formVals);
    resetRate(formVals);
    setShowAddRate(true);
  };

  const openCreateModal = () => {
    setEditingRate(null);
    const defaults: TaxRateForm = {
      code: '',
      libelle: '',
      tauxPct: 19,
      applicableA: 'les_deux',
      actif: true,
    };
    setNewRate(defaults);
    resetRate(defaults);
    setShowAddRate(true);
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
      {/* Paramètres TVA */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Paramètres TVA
        </h3>
        
        <form onSubmit={handleSubmitSettings(onSubmitSettings)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taux par défaut (%)
              </label>
              <input
                type="number"
                step="0.01"
                {...registerSettings('tauxParDefautPct', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {settingsErrors.tauxParDefautPct && (
                <p className="mt-1 text-sm text-red-600">{settingsErrors.tauxParDefautPct.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Régime par défaut
              </label>
              <select
                {...registerSettings('regimeParDefautCode')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {taxRates.map((rate) => (
                  <option key={rate.code} value={rate.code}>
                    {rate.code} - {rate.libelle}
                  </option>
                ))}
              </select>
              {settingsErrors.regimeParDefautCode && (
                <p className="mt-1 text-sm text-red-600">{settingsErrors.regimeParDefautCode.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Arrondi
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="ligne"
                    {...registerSettings('arrondi')}
                    className="mr-2"
                  />
                  Ligne
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="document"
                    {...registerSettings('arrondi')}
                    className="mr-2"
                  />
                  Document
                </label>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                {...registerSettings('prixIncluentTVA')}
                className="mr-2"
              />
              <label className="text-sm font-medium text-gray-700">
                Les prix incluent la TVA
              </label>
            </div>
          </div>

          {/* Timbre fiscal */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Timbre fiscal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...registerSettings('timbreFiscal.actif')}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  Activer le timbre fiscal
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant fixe (TND)
                </label>
                <input
                  type="number"
                  step="0.001"
                  {...registerSettings('timbreFiscal.montantFixe', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* FODEC */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">FODEC</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...registerSettings('fodec.actif')}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  Activer FODEC automatiquement
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taux FODEC (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...registerSettings('fodec.tauxPct', { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Retenue à la source */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Retenue à la source</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...registerSettings('retenueSource.actif')}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  Activer la retenue à la source
                </label>
              </div>
              
              {retenueSourceActif && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taux (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...registerSettings('retenueSource.tauxPct', { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Appliquer sur
                    </label>
                    <select
                      {...registerSettings('retenueSource.appliquerSur')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="services">Services uniquement</option>
                      <option value="tous">Tous les documents</option>
                    </select>
                  </div>
                </div>
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

      {/* Taux de TVA */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Taux de TVA
          </h3>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Nouveau taux
          </button>
        </div>

        {/* Modal d'ajout/modification */}
        {showAddRate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-30" onClick={() => { setShowAddRate(false); setEditingRate(null); }} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-semibold text-gray-900">
                  {editingRate ? 'Modifier le taux' : 'Nouveau taux de TVA'}
                </h4>
                <button
                  onClick={() => { setShowAddRate(false); setEditingRate(null); }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmitRate(onSubmitRate)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    {...registerRate('code')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="TN19"
                    disabled={!!editingRate}
                  />
                  {rateErrors.code && (
                    <p className="mt-1 text-sm text-red-600">{rateErrors.code.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Libellé *
                  </label>
                  <input
                    type="text"
                    {...registerRate('libelle')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="TVA 19%"
                  />
                  {rateErrors.libelle && (
                    <p className="mt-1 text-sm text-red-600">{rateErrors.libelle.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...registerRate('tauxPct', { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="19"
                  />
                  {rateErrors.tauxPct && (
                    <p className="mt-1 text-sm text-red-600">{rateErrors.tauxPct.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Applicable à
                  </label>
                  <select
                    {...registerRate('applicableA')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="les_deux">Ventes et Achats</option>
                    <option value="ventes">Ventes uniquement</option>
                    <option value="achats">Achats uniquement</option>
                  </select>
                </div>

                {/* Deductible fields removed as requested */}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...registerRate('actif')}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">
                  Actif
                </label>
              </div>

                <div className="flex space-x-2 justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
                <button
                  type="button"
                    onClick={() => { setShowAddRate(false); setEditingRate(null); resetRate(); }}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Annuler
                </button>
              </div>
              </form>
            </div>
          </div>
        )}

        {/* Table des taux */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Libellé
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taux
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applicable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {taxRates.map((rate) => (
                <tr key={rate._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {rate.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rate.libelle}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rate.tauxPct}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rate.applicableA === 'les_deux' ? 'Ventes & Achats' : rate.applicableA}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${
                      rate.actif 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {rate.actif ? 'ACTIF' : 'INACTIF'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEdit(rate)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteRate(rate.code)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
