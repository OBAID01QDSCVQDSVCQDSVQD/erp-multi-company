'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { ExclamationTriangleIcon, NoSymbolIcon } from '@heroicons/react/24/outline';

interface StockSettings {
  stockNegatif: boolean;
  seuilAlerte: number;
  multiEntrepots: boolean;
}

export default function StockTab({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Default values
  const { register, handleSubmit, setValue, watch, reset } = useForm<StockSettings>({
    defaultValues: {
      stockNegatif: true, // Par défaut "autorisé" (true = négatif autorisé, false = bloqué)
      seuilAlerte: 10,
      multiEntrepots: false,
    }
  });

  const stockNegatifValue = watch('stockNegatif');
  const multiEntrepotsValue = watch('multiEntrepots');

  useEffect(() => {
    if (tenantId) fetchSettings();
  }, [tenantId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId }
      });

      if (response.ok) {
        const data = await response.json();
        // Map database structure to form
        if (data.stock) {
          // Note: In DB, we might store 'preventNegativeStock' or similar. 
          // Let's assume the DB schema uses `stock: { allowNegative: boolean, lowStockThreshold: number }` 
          // or similar. Since previous code used `stockNegatif` as enum, let's simplify to boolean in UI.
          // However, to be safe with existing DB, let's map carefully.

          // If DB has `stock.seuilAlerte`, use it.
          setValue('seuilAlerte', data.stock.seuilAlerte ?? 10);

          // If DB has `stock.stockNegatif`, let's map it. 
          // If previously it was enum 'autorise', then true. If 'interdit', then false.
          const isAllowed = data.stock.stockNegatif === 'interdit' ? false : true;
          setValue('stockNegatif', isAllowed);

          setValue('multiEntrepots', data.stock.multiEntrepots || false);
        }
      }
    } catch (error) {
      console.error('Error fetching stock settings:', error);
      toast.error('Erreur chargement paramètres');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: StockSettings) => {
    try {
      setSaving(true);

      // 1. Fetch current settings first to avoid overwriting other stock fields
      const currentRes = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      const currentData = await currentRes.json();
      const currentStock = currentData.stock || {};

      // 2. Merge new values with existing ones
      const payload = {
        stock: {
          ...currentStock, // Keep existing fields
          seuilAlerte: Number(data.seuilAlerte),
          stockNegatif: data.stockNegatif ? 'autorise' : 'interdit',
          multiEntrepots: data.multiEntrepots
        }
      };

      console.log('Saving stock settings:', payload);

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Paramètres stock mis à jour');
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Règles de Gestion de Stock
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* Section 0: Multi-Entrepôts */}
          <div className="flex items-start gap-4 p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
            <div className="flex h-6 items-center">
              <input
                id="multiEntrepots"
                type="checkbox"
                {...register('multiEntrepots')}
                className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-blue-600 focus:ring-blue-600 cursor-pointer"
              />
            </div>
            <div className="text-sm leading-6">
              <label htmlFor="multiEntrepots" className="font-semibold text-blue-900 dark:text-blue-300 cursor-pointer">
                Activer la gestion Multi-Entrepôts
              </label>
              <p className="text-blue-700 dark:text-blue-400">
                Si activé, vous pourrez gérer plusieurs lieux de stockage (Dépôt, Showroom, Camion...) et effectuer des transferts.
              </p>
              {multiEntrepotsValue && (
                <p className="mt-2 text-xs font-semibold text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded inline-block">
                  ✨ Le menu "Entrepôts" sera actif dans la barre latérale.
                </p>
              )}
            </div>
          </div>

          {/* Section 1: Seuil d'alerte */}
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-md border border-orange-100 dark:border-orange-800">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
              <div>
                <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-300">Seuil d'alerte global</h4>
                <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                  Définissez la quantité minimale par défaut pour déclencher une alerte de "stock faible".
                </p>
              </div>
              <div className="w-full md:w-32">
                <input
                  type="number"
                  {...register('seuilAlerte', { min: 0 })}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Stock Négatif */}
          <div className={`p-4 rounded-md border transition-colors ${!stockNegatifValue ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-5 items-center">
                <input
                  id="stockNegatif"
                  type="checkbox"
                  {...register('stockNegatif')}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-500 dark:bg-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
              <div className="ml-2 text-sm">
                <label htmlFor="stockNegatif" className={`font-medium ${!stockNegatifValue ? 'text-red-900 dark:text-red-300' : 'text-gray-900 dark:text-gray-200'}`}>
                  Autoriser les stocks négatifs
                </label>
                <p className={`mt-1 ${!stockNegatifValue ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {stockNegatifValue
                    ? "Le système autorisera la validation des ventes même si la quantité en stock est insuffisante (le stock deviendra négatif)."
                    : "Le système BLOQUERA toute vente si la quantité en stock est insuffisante."}
                </p>
                {!stockNegatifValue && (
                  <div className="mt-3 flex items-center gap-2 text-red-800 dark:text-red-200 text-xs font-semibold bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded w-fit">
                    <NoSymbolIcon className="h-4 w-4" />
                    Protection active : Ventes impossibles sans stock.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 py-2 px-4 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les règles'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
