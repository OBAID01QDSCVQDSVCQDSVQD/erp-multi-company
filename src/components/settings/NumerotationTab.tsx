'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { EyeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const numerotationSchema = z.object({
  devis: z.string().min(1, 'Le format devis est requis'),
  bl: z.string().min(1, 'Le format BL est requis'),
  facture: z.string().min(1, 'Le format facture est requis'),
  avoir: z.string().min(1, 'Le format avoir est requis'),
  startingNumbers: z.object({
    devis: z.number().min(0).optional(),
    bl: z.number().min(0).optional(),
    facture: z.number().min(0).optional(),
    avoir: z.number().min(0).optional(),
  }).optional(),
});

type NumerotationForm = z.infer<typeof numerotationSchema>;

interface NumerotationTabProps {
  tenantId: string;
}

const formatExamples = {
  devis: 'DEV-2024-00001',
  bl: 'BL-2401-0001',
  facture: 'FAC-2024-00001',
  avoir: 'AVR-2024-00001',
};

export default function NumerotationTab({ tenantId }: NumerotationTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.value = '';
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<NumerotationForm>({
    resolver: zodResolver(numerotationSchema),
  });

  const watchedValues = watch();

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
          devis: data.numerotation?.devis || 'DEV-{{YYYY}}-{{SEQ:5}}',
          bl: data.numerotation?.bl || 'BL-{{YY}}{{MM}}-{{SEQ:4}}',
          facture: data.numerotation?.facture || 'FAC-{{YYYY}}-{{SEQ:5}}',
          avoir: data.numerotation?.avoir || 'AVR-{{YYYY}}-{{SEQ:5}}',
          startingNumbers: {
            devis: data.numerotation?.startingNumbers?.devis || 0,
            bl: data.numerotation?.startingNumbers?.bl || 0,
            facture: data.numerotation?.startingNumbers?.fac || 0,
            avoir: data.numerotation?.startingNumbers?.avoir || 0,
          },
        });
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: NumerotationForm) => {
    try {
      setSaving(true);
      
      // Préparer les données pour l'API
      const numerotationData: any = {
        devis: data.devis,
        bl: data.bl,
        fac: data.facture,
        avoir: data.avoir,
      };
      
      // Ajouter startingNumbers si défini
      if (data.startingNumbers) {
        numerotationData.startingNumbers = {
          devis: data.startingNumbers.devis || 0,
          bl: data.startingNumbers.bl || 0,
          fac: data.startingNumbers.facture || 0,
          avoir: data.startingNumbers.avoir || 0,
        };
      }
      
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify({
          numerotation: numerotationData,
        }),
      });

      if (response.ok) {
        // Si des startingNumbers ont été définis, les appliquer aux compteurs
        if (data.startingNumbers && Object.values(data.startingNumbers).some(v => v && v > 0)) {
          const applyResponse = await fetch('/api/settings/numbering/apply-starting', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Id': tenantId,
            },
            body: JSON.stringify({
              startingNumbers: numerotationData.startingNumbers,
            }),
          });
          
          if (applyResponse.ok) {
            toast.success('Formats et numéros de départ mis à jour');
          } else {
            toast.success('Formats mis à jour, mais erreur lors de l\'application des numéros de départ');
          }
        } else {
          toast.success('Formats de numérotation mis à jour');
        }
      } else {
        toast.error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const previewFormat = async (type: keyof NumerotationForm) => {
    try {
      setPreviewLoading(true);
      const response = await fetch(`/api/settings/numbering/preview?type=${type}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (response.ok) {
        const data = await response.json();
        setPreviews(prev => ({ ...prev, [type]: data.preview }));
      } else {
        toast.error('Erreur lors de la prévisualisation');
      }
    } catch (error) {
      toast.error('Erreur de connexion');
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetToDefaults = () => {
    reset({
      devis: 'DEV-{{YYYY}}-{{SEQ:5}}',
      bl: 'BL-{{YY}}{{MM}}-{{SEQ:4}}',
      facture: 'FAC-{{YYYY}}-{{SEQ:5}}',
      avoir: 'AVR-{{YYYY}}-{{SEQ:5}}',
      startingNumbers: {
        devis: 0,
        bl: 0,
        facture: 0,
        avoir: 0,
      },
    });
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Formats de numérotation
          </h3>
          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Réinitialiser par défaut
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Variables disponibles :</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p><code className="bg-blue-100 px-1 rounded">{'{{YYYY}}'}</code> - Année complète (ex: 2024)</p>
              <p><code className="bg-blue-100 px-1 rounded">{'{{YY}}'}</code> - Année sur 2 chiffres (ex: 24)</p>
              <p><code className="bg-blue-100 px-1 rounded">{'{{MM}}'}</code> - Mois sur 2 chiffres (ex: 01)</p>
              <p><code className="bg-blue-100 px-1 rounded">{'{{DD}}'}</code> - Jour sur 2 chiffres (ex: 15)</p>
              <p><code className="bg-blue-100 px-1 rounded">{'{{SEQ:n}}'}</code> - Numéro séquentiel avec padding (ex: {'{{SEQ:5}}'} = 00001)</p>
            </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Devis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Format des devis
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                {...register('devis')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="DEV-{{YYYY}}-{{SEQ:5}}"
              />
              <button
                type="button"
                onClick={() => previewFormat('devis')}
                disabled={previewLoading}
                className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200 disabled:opacity-50"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
            {errors.devis && (
              <p className="mt-1 text-sm text-red-600">{errors.devis.message}</p>
            )}
            {previews.devis && (
              <p className="mt-1 text-sm text-green-600">
                Aperçu: <code className="bg-green-100 px-1 rounded">{previews.devis}</code>
              </p>
            )}
            <div className="mt-2">
              <label className="block text-xs text-gray-600 mb-1">
                Numéro de départ (optionnel)
              </label>
              <input
                type="text"
                {...register('startingNumbers.devis', { 
                  setValueAs: (v) => v === '' ? undefined : parseInt(v, 10) || 0
                })}
                onFocus={handleFocus}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
                pattern="[0-9]*"
              />
              <p className="mt-1 text-xs text-gray-500">
                Le compteur commencera à partir de ce numéro (ex: 100 pour commencer à 101)
              </p>
            </div>
          </div>

          {/* BL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Format des bons de livraison
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                {...register('bl')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="BL-{{YY}}{{MM}}-{{SEQ:4}}"
              />
              <button
                type="button"
                onClick={() => previewFormat('bl')}
                disabled={previewLoading}
                className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200 disabled:opacity-50"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
            {errors.bl && (
              <p className="mt-1 text-sm text-red-600">{errors.bl.message}</p>
            )}
            {previews.bl && (
              <p className="mt-1 text-sm text-green-600">
                Aperçu: <code className="bg-green-100 px-1 rounded">{previews.bl}</code>
              </p>
            )}
            <div className="mt-2">
              <label className="block text-xs text-gray-600 mb-1">
                Numéro de départ (optionnel)
              </label>
              <input
                type="text"
                {...register('startingNumbers.bl', { 
                  setValueAs: (v) => v === '' ? undefined : parseInt(v, 10) || 0
                })}
                onFocus={handleFocus}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
                pattern="[0-9]*"
              />
              <p className="mt-1 text-xs text-gray-500">
                Le compteur commencera à partir de ce numéro (ex: 100 pour commencer à 101)
              </p>
            </div>
          </div>

          {/* Facture */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Format des factures
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                {...register('facture')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="FAC-{{YYYY}}-{{SEQ:5}}"
              />
              <button
                type="button"
                onClick={() => previewFormat('facture')}
                disabled={previewLoading}
                className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200 disabled:opacity-50"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
            {errors.facture && (
              <p className="mt-1 text-sm text-red-600">{errors.facture.message}</p>
            )}
            {previews.facture && (
              <p className="mt-1 text-sm text-green-600">
                Aperçu: <code className="bg-green-100 px-1 rounded">{previews.facture}</code>
              </p>
            )}
            <div className="mt-2">
              <label className="block text-xs text-gray-600 mb-1">
                Numéro de départ (optionnel)
              </label>
              <input
                type="text"
                {...register('startingNumbers.facture', { 
                  setValueAs: (v) => v === '' ? undefined : parseInt(v, 10) || 0
                })}
                onFocus={handleFocus}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
                pattern="[0-9]*"
              />
              <p className="mt-1 text-xs text-gray-500">
                Le compteur commencera à partir de ce numéro (ex: 100 pour commencer à 101)
              </p>
            </div>
          </div>

          {/* Avoir */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Format des avoirs
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                {...register('avoir')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="AVR-{{YYYY}}-{{SEQ:5}}"
              />
              <button
                type="button"
                onClick={() => previewFormat('avoir')}
                disabled={previewLoading}
                className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200 disabled:opacity-50"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
            {errors.avoir && (
              <p className="mt-1 text-sm text-red-600">{errors.avoir.message}</p>
            )}
            {previews.avoir && (
              <p className="mt-1 text-sm text-green-600">
                Aperçu: <code className="bg-green-100 px-1 rounded">{previews.avoir}</code>
              </p>
            )}
            <div className="mt-2">
              <label className="block text-xs text-gray-600 mb-1">
                Numéro de départ (optionnel)
              </label>
              <input
                type="text"
                {...register('startingNumbers.avoir', { 
                  setValueAs: (v) => v === '' ? undefined : parseInt(v, 10) || 0
                })}
                onFocus={handleFocus}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0"
                pattern="[0-9]*"
              />
              <p className="mt-1 text-xs text-gray-500">
                Le compteur commencera à partir de ce numéro (ex: 100 pour commencer à 101)
              </p>
            </div>
          </div>

          {/* Boutons */}
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
