'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';

const securiteSchema = z.object({
  motDePasseComplexe: z.boolean(),
  deuxFA: z.boolean(),
});

type SecuriteForm = z.infer<typeof securiteSchema>;

interface SecuriteTabProps {
  tenantId: string;
}

export default function SecuriteTab({ tenantId }: SecuriteTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SecuriteForm>({
    resolver: zodResolver(securiteSchema),
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
          motDePasseComplexe: data.securite?.motDePasseComplexe || true,
          deuxFA: data.securite?.deuxFA || false,
        });
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SecuriteForm) => {
    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          securite: data,
        }),
      });

      if (response.ok) {
        toast.success('Paramètres de sécurité mis à jour');
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
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Paramètres de sécurité
        </h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  Mots de passe complexes
                </h4>
                <p className="text-sm text-gray-500">
                  Exiger des mots de passe avec majuscules, minuscules, chiffres et symboles
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('motDePasseComplexe')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  Authentification à deux facteurs (2FA)
                </h4>
                <p className="text-sm text-gray-500">
                  Exiger une vérification supplémentaire lors de la connexion
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('deuxFA')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-yellow-900 mb-2">Recommandations de sécurité :</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Activez l'authentification à deux facteurs pour tous les utilisateurs</li>
              <li>• Exigez des mots de passe complexes d'au moins 12 caractères</li>
              <li>• Changez régulièrement les mots de passe (tous les 90 jours)</li>
              <li>• Limitez l'accès aux données sensibles selon les rôles</li>
            </ul>
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
    </div>
  );
}
