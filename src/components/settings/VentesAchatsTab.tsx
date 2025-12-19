'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

const ventesAchatsSchema = z.object({
  tvaParDefautPct: z.number().min(0).max(100),
  conditionsPaiementDefaut: z.string().min(1, 'Les conditions de paiement sont requises'),
  uniteParDefaut: z.string().min(1, 'L\'unité par défaut est requise'),
  modesReglement: z.array(z.string()).min(1, 'Au moins un mode de règlement est requis'),
});

type VentesAchatsForm = z.infer<typeof ventesAchatsSchema>;

interface VentesAchatsTabProps {
  tenantId: string;
}

export default function VentesAchatsTab({ tenantId }: VentesAchatsTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newModeReglement, setNewModeReglement] = useState('');
  const [taxRates, setTaxRates] = useState<Array<{ code: string; libelle: string; tauxPct: number }>>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<VentesAchatsForm>({
    resolver: zodResolver(ventesAchatsSchema),
  });

  const modesReglement = watch('modesReglement') || [];

  useEffect(() => {
    fetchSettings();
  }, [tenantId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const [settingsRes, ratesRes] = await Promise.all([
        fetch('/api/settings', { headers: { 'X-Tenant-Id': tenantId } }),
        fetch('/api/tva/rates?actif=false', { headers: { 'X-Tenant-Id': tenantId } }),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        reset({
          tvaParDefautPct: data.ventes?.tvaParDefautPct || 19,
          conditionsPaiementDefaut: data.ventes?.conditionsPaiementDefaut || '30 jours',
          uniteParDefaut: data.ventes?.uniteParDefaut || 'pièce',
          modesReglement: data.achats?.modesReglement || ['Espèces', 'Virement', 'Chèque', 'Carte'],
        });
      }

      if (ratesRes.ok) {
        const ratesData = await ratesRes.json();
        const mapped = (ratesData.data || []).map((r: any) => ({ code: r.code, libelle: r.libelle, tauxPct: r.tauxPct }));
        setTaxRates(mapped);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: VentesAchatsForm) => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          ventes: {
            tvaParDefautPct: data.tvaParDefautPct,
            conditionsPaiementDefaut: data.conditionsPaiementDefaut,
            uniteParDefaut: data.uniteParDefaut,
          },
          achats: {
            modesReglement: data.modesReglement,
          },
        }),
      });

      if (response.ok) {
        toast.success('Paramètres de ventes et achats mis à jour');
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const addModeReglement = () => {
    if (newModeReglement.trim() && !modesReglement.includes(newModeReglement.trim())) {
      setValue('modesReglement', [...modesReglement, newModeReglement.trim()]);
      setNewModeReglement('');
    }
  };

  const removeModeReglement = (index: number) => {
    const newModes = modesReglement.filter((_, i) => i !== index);
    setValue('modesReglement', newModes);
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
      {/* Section Ventes */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Paramètres de ventes
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                TVA par défaut (%)
              </label>
              <select
                {...register('tvaParDefautPct', { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                {taxRates.map((rate) => (
                  <option key={rate.code} value={rate.tauxPct}>
                    {rate.code} - {rate.libelle} ({rate.tauxPct}%)
                  </option>
                ))}
              </select>
              {errors.tvaParDefautPct && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.tvaParDefautPct.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Conditions de paiement par défaut
              </label>
              <input
                type="text"
                {...register('conditionsPaiementDefaut')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="30 jours"
              />
              {errors.conditionsPaiementDefaut && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.conditionsPaiementDefaut.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Unité par défaut
              </label>
              <input
                type="text"
                {...register('uniteParDefaut')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="pièce"
              />
              {errors.uniteParDefaut && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.uniteParDefaut.message}</p>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Section Achats */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Modes de règlement
        </h3>

        <div className="space-y-4">
          {/* Modes existants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Modes de règlement disponibles
            </label>
            <div className="flex flex-wrap gap-2">
              {modesReglement.map((mode, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                >
                  {mode}
                  <button
                    type="button"
                    onClick={() => removeModeReglement(index)}
                    className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full text-indigo-400 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 hover:text-indigo-500 dark:hover:text-indigo-200"
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {errors.modesReglement && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.modesReglement.message}</p>
            )}
          </div>

          {/* Ajouter un nouveau mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ajouter un mode de règlement
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newModeReglement}
                onChange={(e) => setNewModeReglement(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addModeReglement())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Nouveau mode de règlement"
              />
              <button
                type="button"
                onClick={addModeReglement}
                className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 border border-transparent rounded-md disabled:opacity-50 transition-colors"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
