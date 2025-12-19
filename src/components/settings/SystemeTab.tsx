'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';

const systemeSchema = z.object({
  maintenance: z.boolean(),
  version: z.string(),
});

type SystemeForm = z.infer<typeof systemeSchema>;

interface SystemeTabProps {
  tenantId: string;
}

export default function SystemeTab({ tenantId }: SystemeTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SystemeForm>({
    resolver: zodResolver(systemeSchema),
  });

  useEffect(() => {
    fetchSettings();
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
          maintenance: data.systeme?.maintenance || false,
          version: data.systeme?.version || '1.0.0',
        });
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SystemeForm) => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          systeme: data,
        }),
      });

      if (response.ok) {
        toast.success('Paramètres système mis à jour');
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Paramètres système
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Mode maintenance
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Activer le mode maintenance pour limiter l'accès au système
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('maintenance')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Version du système
              </label>
              <input
                type="text"
                {...register('version')}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
                placeholder="1.0.0"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Version actuelle du système (lecture seule)
              </p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-400 mb-2">Informations système :</h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p><strong>Version :</strong> 1.0.0</p>
              <p><strong>Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR')}</p>
              <p><strong>Statut :</strong> <span className="text-green-600 dark:text-green-400">Opérationnel</span></p>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-md">
            <h4 className="text-sm font-medium text-red-900 dark:text-red-400 mb-2">⚠️ Mode maintenance :</h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              Le mode maintenance empêche l'accès au système pour tous les utilisateurs sauf les administrateurs.
              Utilisez-le uniquement lors des mises à jour ou de la maintenance planifiée.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors dark:hover:bg-indigo-500"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
