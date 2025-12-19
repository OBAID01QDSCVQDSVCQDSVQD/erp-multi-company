'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

const societeSchema = z.object({
  nom: z.string().min(1, 'Le nom de l\'entreprise est requis'),
  adresse: z.object({
    rue: z.string().min(1, 'L\'adresse est requise'),
    ville: z.string().min(1, 'La ville est requise'),
    codePostal: z.string().min(1, 'Le code postal est requis'),
    pays: z.string().min(1, 'Le pays est requis'),
  }),
  tva: z.string().optional(),
  devise: z.string().min(1, 'La devise est requise'),
  langue: z.string().min(1, 'La langue est requise'),
  fuseau: z.string().min(1, 'Le fuseau horaire est requis'),
  logoUrl: z.string().optional(),
  theme: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
  }).optional(),
  enTete: z.object({
    slogan: z.string().optional(),
    telephone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    siteWeb: z.string().url().optional().or(z.literal('')),
    matriculeFiscal: z.string().optional(),
    registreCommerce: z.string().optional(),
    capitalSocial: z.string().optional(),
  }).optional(),
  piedPage: z.object({
    texte: z.string().optional(),
    conditionsGenerales: z.string().optional(),
    mentionsLegales: z.string().optional(),
    coordonneesBancaires: z.object({
      banque: z.string().optional(),
      rib: z.string().optional(),
      swift: z.string().optional(),
    }).optional(),
  }).optional(),
});

type SocieteForm = z.infer<typeof societeSchema>;

interface SocieteTabProps {
  tenantId: string;
}

export default function SocieteTab({ tenantId }: SocieteTabProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [currentCompanyData, setCurrentCompanyData] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<SocieteForm>({
    resolver: zodResolver(societeSchema),
    defaultValues: {
      devise: 'TND',
    },
  });

  const logoUrl = watch('logoUrl');

  useEffect(() => {
    console.log('=== SocieteTab useEffect triggered ===');
    console.log('SocieteTab mounted, tenantId:', tenantId);
    if (tenantId) {
      console.log('✅ tenantId available, calling fetchSettings()...');
      fetchSettings();
    } else {
      console.warn('❌ No tenantId available, cannot fetch settings');
    }
  }, [tenantId]);

  useEffect(() => {
    if (logoUrl) {
      setLogoPreview(logoUrl);
    } else {
      setLogoPreview('');
    }
  }, [logoUrl]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La taille du fichier ne doit pas dépasser 5MB');
      return;
    }

    try {
      setUploadingLogo(true);

      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setValue('logoUrl', base64String);
        setLogoPreview(base64String);
        setUploadingLogo(false);
        toast.success('Logo téléchargé avec succès');
      };
      reader.onerror = () => {
        toast.error('Erreur lors de la lecture du fichier');
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Erreur lors du téléchargement du logo');
      setUploadingLogo(false);
    }
  };

  const fetchSettings = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      console.log('Fetching company data from API...');
      // استخدام /api/settings بدلاً من /api/companies?current=true
      const response = await fetch('/api/settings', {
        headers: {
          'X-Tenant-Id': tenantId || '',
        },
      });
      console.log('API response status:', response.status);

      if (response.ok) {
        const settings = await response.json();
        console.log('=== FETCHED SETTINGS DATA FROM DATABASE ===');
        console.log('Full settings object:', JSON.stringify(settings, null, 2));
        console.log('Settings societe:', settings.societe);
        console.log('==========================================');

        // البيانات تأتي من CompanySettings model في بنية settings.societe
        const societe = settings.societe || {};

        // التأكد من أن جميع البيانات موجودة قبل إنشاء formData
        const formData: SocieteForm = {
          nom: societe.nom || '',
          adresse: {
            rue: societe.adresse?.rue || '',
            ville: societe.adresse?.ville || '',
            codePostal: societe.adresse?.codePostal || '',
            pays: societe.adresse?.pays || 'Tunisie',
          },
          tva: societe.tva || '',
          devise: societe.devise || 'TND',
          langue: societe.langue || 'fr',
          fuseau: societe.fuseau || 'Africa/Tunis',
          logoUrl: societe.logoUrl || '',
          theme: societe.theme || {},
          enTete: {
            slogan: societe.enTete?.slogan || '',
            telephone: societe.enTete?.telephone || '',
            email: societe.enTete?.email || '',
            siteWeb: societe.enTete?.siteWeb || '',
            matriculeFiscal: societe.enTete?.matriculeFiscal || '',
            registreCommerce: societe.enTete?.registreCommerce || '',
            capitalSocial: societe.enTete?.capitalSocial || '',
          },
          piedPage: {
            texte: societe.piedPage?.texte || '',
            conditionsGenerales: societe.piedPage?.conditionsGenerales || '',
            mentionsLegales: societe.piedPage?.mentionsLegales || '',
            coordonneesBancaires: {
              banque: societe.piedPage?.coordonneesBancaires?.banque || '',
              rib: societe.piedPage?.coordonneesBancaires?.rib || '',
              swift: societe.piedPage?.coordonneesBancaires?.swift || '',
            },
          },
        };

        // التحقق من أن formData يحتوي على البيانات الصحيحة
        console.log('=== VALIDATING FORM DATA ===');
        console.log('formData.nom:', formData.nom);
        console.log('formData.adresse.rue:', formData.adresse.rue);
        console.log('formData.adresse.ville:', formData.adresse.ville);
        console.log('formData.enTete.email:', formData.enTete?.email);
        console.log('formData.enTete.telephone:', formData.enTete?.telephone);
        console.log('formData.devise:', formData.devise);
        console.log('===========================');

        console.log('=== FORM DATA TO BE SET ===');
        console.log('Form data:', JSON.stringify(formData, null, 2));
        console.log('Form data nom:', formData.nom);
        console.log('Form data adresse:', formData.adresse);
        console.log('Form data contact email:', formData.enTete?.email);
        console.log('Form data contact phone:', formData.enTete?.telephone);
        console.log('Form data devise:', formData.devise);
        console.log('===========================');

        setCurrentCompanyData(settings);

        console.log('Calling reset() with form data...');
        reset(formData, {
          keepDefaultValues: false,
        });

        console.log('=== FORM RESET COMPLETED ===');

        // التحقق من أن البيانات تم تعيينها بعد reset
        setTimeout(() => {
          const currentValues = watch();
          console.log('=== CURRENT FORM VALUES AFTER RESET ===');
          console.log('Current nom:', currentValues.nom);
          console.log('Current adresse:', currentValues.adresse);
          console.log('Current enTete:', currentValues.enTete);
          console.log('Current devise:', currentValues.devise);
          console.log('Current langue:', currentValues.langue);
          console.log('Current fuseau:', currentValues.fuseau);
          console.log('========================================');

          // التحقق من أن البيانات تظهر في الحقول
          if (currentValues.nom !== formData.nom) {
            console.error('❌ ERROR: nom not set correctly!');
            console.error('Expected:', formData.nom);
            console.error('Got:', currentValues.nom);
          } else {
            console.log('✅ nom set correctly');
          }
        }, 200);

        // تحديث logoPreview بعد تحميل البيانات
        if (societe.logoUrl) {
          setLogoPreview(societe.logoUrl);
        } else {
          setLogoPreview('');
        }
      } else {
        console.error('Failed to fetch company data. Status:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error data:', errorData);
        toast.error('Erreur lors du chargement des informations de l\'entreprise');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erreur lors du chargement des informations de l\'entreprise');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const onSubmit = async (data: SocieteForm) => {
    // Empêcher la double soumission
    if (saving) {
      return;
    }

    try {
      setSaving(true);

      // Convertir les données du formulaire vers le format CompanySettings
      const settingsData = {
        societe: {
          nom: data.nom,
          adresse: {
            rue: data.adresse.rue,
            ville: data.adresse.ville,
            codePostal: data.adresse.codePostal,
            pays: data.adresse.pays,
          },
          tva: data.tva || '',
          devise: data.devise,
          langue: data.langue,
          fuseau: data.fuseau,
          logoUrl: data.logoUrl || '',
          theme: data.theme || {},
          enTete: {
            slogan: data.enTete?.slogan || '',
            telephone: (data.enTete?.telephone && data.enTete.telephone.trim() !== '')
              ? data.enTete.telephone.trim()
              : (currentCompanyData?.societe?.enTete?.telephone || ''),
            email: (data.enTete?.email && data.enTete.email.trim() !== '')
              ? data.enTete.email.trim()
              : (currentCompanyData?.societe?.enTete?.email || ''),
            siteWeb: data.enTete?.siteWeb || '',
            matriculeFiscal: data.enTete?.matriculeFiscal || '',
            registreCommerce: data.enTete?.registreCommerce || '',
            capitalSocial: data.enTete?.capitalSocial || '',
          },
          piedPage: {
            texte: data.piedPage?.texte || '',
            conditionsGenerales: data.piedPage?.conditionsGenerales || '',
            mentionsLegales: data.piedPage?.mentionsLegales || '',
            coordonneesBancaires: {
              banque: data.piedPage?.coordonneesBancaires?.banque || '',
              rib: data.piedPage?.coordonneesBancaires?.rib || '',
              swift: data.piedPage?.coordonneesBancaires?.swift || '',
            },
          },
        },
      };

      console.log('Sending settings data:', settingsData);

      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || '',
        },
        body: JSON.stringify(settingsData),
      });

      const responseData = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', responseData);

      if (response.ok) {
        toast.success('Informations de l\'entreprise mises à jour');
        // Recharger les données بدون إظهار loader
        await fetchSettings(false);
      } else {
        toast.error(responseData.error || 'Erreur lors de la mise à jour');
        console.error('Update error:', responseData);
      }
    } catch (error) {
      console.error('Submit error:', error);
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
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Informations de l'entreprise
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nom de l'entreprise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nom de l'entreprise *
            </label>
            <input
              type="text"
              {...register('nom')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nom de votre entreprise"
            />
            {errors.nom && (
              <p className="mt-1 text-sm text-red-600">{errors.nom.message}</p>
            )}
          </div>

          {/* Adresse */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rue *
              </label>
              <input
                type="text"
                {...register('adresse.rue')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Adresse de l'entreprise"
              />
              {errors.adresse?.rue && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.rue.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ville *
              </label>
              <input
                type="text"
                {...register('adresse.ville')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ville"
              />
              {errors.adresse?.ville && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.ville.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Code postal *
              </label>
              <input
                type="text"
                {...register('adresse.codePostal')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Code postal"
              />
              {errors.adresse?.codePostal && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.codePostal.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pays *
              </label>
              <input
                type="text"
                {...register('adresse.pays')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Pays"
              />
              {errors.adresse?.pays && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.pays.message}</p>
              )}
            </div>
          </div>

          {/* TVA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Numéro de TVA
            </label>
            <input
              type="text"
              {...register('tva')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Numéro de TVA"
            />
          </div>

          {/* Devise et Langue */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Devise *
              </label>
              <select
                {...register('devise')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="TND">TND (Dinar tunisien)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="USD">USD (Dollar américain)</option>
                <option value="GBP">GBP (Livre sterling)</option>
              </select>
              {errors.devise && (
                <p className="mt-1 text-sm text-red-600">{errors.devise.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Langue *
              </label>
              <select
                {...register('langue')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
              {errors.langue && (
                <p className="mt-1 text-sm text-red-600">{errors.langue.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fuseau horaire *
              </label>
              <select
                {...register('fuseau')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Africa/Tunis">Africa/Tunis</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="UTC">UTC</option>
              </select>
              {errors.fuseau && (
                <p className="mt-1 text-sm text-red-600">{errors.fuseau.message}</p>
              )}
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo de l'entreprise
            </label>

            {/* Upload Button */}
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50">
                {uploadingLogo ? 'Téléchargement...' : 'Choisir un fichier'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>

              {logoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setValue('logoUrl', '');
                    setLogoPreview('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-white dark:bg-gray-700 border border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Supprimer
                </button>
              )}
            </div>

            {/* Logo Preview - تحت زر التحميل */}
            {logoPreview && (
              <div className="mb-3">
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  width={128}
                  height={128}
                  className="object-contain border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-700"
                  unoptimized={logoPreview.startsWith('data:')}
                />
              </div>
            )}

            <p className="mt-2 text-sm text-gray-500">
              Formats acceptés: JPG, PNG, GIF. Taille max: 5MB
            </p>
          </div>

          {/* Thème */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Couleur primaire
              </label>
              <input
                type="color"
                {...register('theme.primary')}
                className="w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Couleur secondaire
              </label>
              <input
                type="color"
                {...register('theme.secondary')}
                className="w-full h-10 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* En-tête des documents */}
          <div className="border-t dark:border-gray-700 pt-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              En-tête des documents
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Slogan
                </label>
                <input
                  type="text"
                  {...register('enTete.slogan')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Votre slogan d'entreprise"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    {...register('enTete.telephone')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+216 XX XXX XXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    {...register('enTete.email')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="contact@entreprise.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Site web
                  </label>
                  <input
                    type="url"
                    {...register('enTete.siteWeb')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="https://www.entreprise.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Matricule fiscal
                  </label>
                  <input
                    type="text"
                    {...register('enTete.matriculeFiscal')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="12345678/A/M/000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Registre de commerce
                  </label>
                  <input
                    type="text"
                    {...register('enTete.registreCommerce')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="RC B 123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Capital social
                  </label>
                  <input
                    type="text"
                    {...register('enTete.capitalSocial')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="100,000 TND"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pied de page des documents */}
          <div className="border-t dark:border-gray-700 pt-6">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Pied de page des documents
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Texte personnalisé
                </label>
                <textarea
                  {...register('piedPage.texte')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Texte à afficher en bas des documents"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Conditions générales
                </label>
                <textarea
                  {...register('piedPage.conditionsGenerales')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Conditions générales de vente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mentions légales
                </label>
                <textarea
                  {...register('piedPage.mentionsLegales')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Mentions légales"
                />
              </div>

              <div className="border-t dark:border-gray-700 pt-4">
                <h5 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">
                  Coordonnées bancaires
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Banque
                    </label>
                    <input
                      type="text"
                      {...register('piedPage.coordonneesBancaires.banque')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Nom de la banque"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      RIB
                    </label>
                    <input
                      type="text"
                      {...register('piedPage.coordonneesBancaires.rib')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Code RIB"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      SWIFT
                    </label>
                    <input
                      type="text"
                      {...register('piedPage.coordonneesBancaires.swift')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Code SWIFT"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-t dark:border-gray-700 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
