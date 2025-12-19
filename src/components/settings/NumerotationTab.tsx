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
  int_fac: z.string().min(1, 'Le format facture interne est requis'),
  startingNumbers: z.object({
    devis: z.number().min(0).optional(),
    bl: z.number().min(0).optional(),
    facture: z.number().min(0).optional(),
    avoir: z.number().min(0).optional(),
    int_fac: z.number().min(0).optional(),
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
  int_fac: '0001',
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
          facture: data.numerotation?.fac || data.numerotation?.facture || 'FAC-{{YYYY}}-{{SEQ:5}}',
          avoir: data.numerotation?.avoir || 'AVR-{{YYYY}}-{{SEQ:5}}',
          int_fac: data.numerotation?.int_fac || '{{SEQ:4}}',
          startingNumbers: {
            devis: data.numerotation?.startingNumbers?.devis || 0,
            bl: data.numerotation?.startingNumbers?.bl || 0,
            facture: data.numerotation?.startingNumbers?.fac || 0,
            avoir: data.numerotation?.startingNumbers?.avoir || 0,
            int_fac: data.numerotation?.startingNumbers?.int_fac || 0,
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
        int_fac: data.int_fac,
      };

      // Ajouter startingNumbers si défini
      if (data.startingNumbers) {
        numerotationData.startingNumbers = {
          devis: data.startingNumbers.devis || 0,
          bl: data.startingNumbers.bl || 0,
          fac: data.startingNumbers.facture || 0,
          avoir: data.startingNumbers.avoir || 0,
          int_fac: data.startingNumbers.int_fac || 0,
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
        // Toujours appliquer les startingNumbers aux compteurs si définis (même si 0)
        if (data.startingNumbers && Object.keys(data.startingNumbers).length > 0) {
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
      // Map int_fac to int-fac for API
      const apiType = type === 'int_fac' ? 'int-fac' : type;
      const response = await fetch(`/api/settings/numbering/preview?type=${apiType}`, {
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
      int_fac: '{{SEQ:4}}',
      startingNumbers: {
        devis: 0,
        bl: 0,
        facture: 0,
        avoir: 0,
        int_fac: 0,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            Formats de numérotation
          </h3>
          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Réinitialiser par défaut
          </button>
        </div>

        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg">
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-2">Variables disponibles :</h4>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1.5">
            <p><code className="bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700 font-mono text-xs">{'{{YYYY}}'}</code> - Année complète (ex: 2024)</p>
            <p><code className="bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700 font-mono text-xs">{'{{YY}}'}</code> - Année sur 2 chiffres (ex: 24)</p>
            <p><code className="bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700 font-mono text-xs">{'{{MM}}'}</code> - Mois sur 2 chiffres (ex: 01)</p>
            <p><code className="bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700 font-mono text-xs">{'{{DD}}'}</code> - Jour sur 2 chiffres (ex: 15)</p>
            <p><code className="bg-blue-100 dark:bg-blue-800/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700 font-mono text-xs">{'{{SEQ:n}}'}</code> - Numéro séquentiel avec padding (ex: {'{{SEQ:5}}'} = 00001)</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {[
            { id: 'devis', label: 'Format des devis', placeholder: 'DEV-{{YYYY}}-{{SEQ:5}}' },
            { id: 'bl', label: 'Format des bons de livraison', placeholder: 'BL-{{YY}}{{MM}}-{{SEQ:4}}' },
            { id: 'facture', label: 'Format des factures', placeholder: 'FAC-{{YYYY}}-{{SEQ:5}}' },
            { id: 'avoir', label: 'Format des avoirs', placeholder: 'AVR-{{YYYY}}-{{SEQ:5}}' },
            { id: 'int_fac', label: 'Format des factures internes', placeholder: '{{SEQ:4}}', helpText: 'Le compteur commencera à partir de ce numéro (ex: 0 pour commencer à 0001). Si non défini, commence à 0001.' }
          ].map((field) => (
            <div key={field.id} className="pt-4 first:pt-0 border-t border-gray-100 dark:border-gray-700 first:border-0">
              <label className="block text-sm font-bold text-gray-900 dark:text-white mb-2">
                {field.label}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8 flex space-x-2">
                  <input
                    type="text"
                    {...register(field.id as any)}
                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all"
                    placeholder={field.placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => previewFormat(field.id as any)}
                    disabled={previewLoading}
                    className="px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="md:col-span-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Départ à :</span>
                    <input
                      type="text"
                      {...register(`startingNumbers.${field.id === 'facture' ? 'facture' : field.id === 'int_fac' ? 'int_fac' : field.id}` as any, {
                        setValueAs: (v) => v === '' ? undefined : parseInt(v, 10) || 0
                      })}
                      onFocus={handleFocus}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all"
                      placeholder="0"
                      pattern="[0-9]*"
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                    {field.helpText || "Définir si vous voulez commencer la séquence à partir d'un numéro spécifique."}
                  </p>
                </div>
              </div>

              {errors[field.id as keyof NumerotationForm] && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(errors[field.id as keyof NumerotationForm] as any)?.message}</p>
              )}
              {previews[field.id] && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                  <span className="font-semibold mr-2">Aperçu:</span>
                  <code className="bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded border border-green-200 dark:border-green-800/50 font-mono">{previews[field.id]}</code>
                </p>
              )}
            </div>
          ))}

          <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Sauvegarde en cours...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
