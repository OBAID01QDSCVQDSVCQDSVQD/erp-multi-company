'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<SocieteForm>({
    resolver: zodResolver(societeSchema),
  });

  const logoUrl = watch('logoUrl');

  useEffect(() => {
    fetchSettings();
  }, [tenantId]);

  useEffect(() => {
    if (logoUrl) {
      setLogoPreview(logoUrl);
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
      const response = await fetch('/api/companies?current=true');

      if (response.ok) {
        const company = await response.json();
        console.log('Fetched company data:', company);
        reset({
          nom: company.name || '',
          adresse: {
            rue: company.address?.street || '',
            ville: company.address?.city || '',
            codePostal: company.address?.postalCode || '',
            pays: company.address?.country || 'Tunisie',
          },
          tva: company.fiscal?.vatNumber || company.fiscal?.taxNumber || '',
          devise: company.settings?.currency || 'TND',
          langue: company.settings?.language || 'fr',
          fuseau: company.settings?.timezone || 'Africa/Tunis',
          logoUrl: '', // Logo non stocké dans Company model pour l'instant
          theme: {},
          enTete: {
            slogan: company.enTete?.slogan || '',
            telephone: company.contact?.phone || '',
            email: company.contact?.email || '',
            siteWeb: company.contact?.website || '',
            matriculeFiscal: company.fiscal?.taxNumber || '',
            registreCommerce: company.fiscal?.registrationNumber || '',
            capitalSocial: company.enTete?.capitalSocial || '',
          },
          piedPage: {
            texte: company.piedPage?.texte || '',
            conditionsGenerales: company.piedPage?.conditionsGenerales || '',
            mentionsLegales: company.piedPage?.mentionsLegales || '',
            coordonneesBancaires: {
              banque: company.piedPage?.coordonneesBancaires?.banque || '',
              rib: company.piedPage?.coordonneesBancaires?.rib || '',
              swift: company.piedPage?.coordonneesBancaires?.swift || '',
            },
          },
        });
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
      
      // Convertir les données du formulaire vers le format Company
      const companyData = {
        name: data.nom,
        address: {
          street: data.adresse.rue,
          city: data.adresse.ville,
          postalCode: data.adresse.codePostal,
          country: data.adresse.pays,
        },
        contact: {
          email: data.enTete?.email || '',
          phone: data.enTete?.telephone || '',
          website: data.enTete?.siteWeb || '',
        },
        fiscal: {
          taxNumber: data.enTete?.matriculeFiscal || data.tva || '',
          registrationNumber: data.enTete?.registreCommerce || '',
          vatNumber: data.tva || '',
        },
        enTete: {
          slogan: data.enTete?.slogan || '',
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
        settings: {
          currency: data.devise,
          language: data.langue,
          timezone: data.fuseau,
          dateFormat: 'DD/MM/YYYY', // Garder le format par défaut
        },
      };

      console.log('Sending company data:', companyData);

      const response = await fetch('/api/companies', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData),
      });

      const responseData = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', responseData);

      if (response.ok) {
        toast.success('Informations de l\'entreprise mises à jour');
        // Recharger les données sans afficher le loader
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
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Informations de l'entreprise
        </h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Nom de l'entreprise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l'entreprise *
            </label>
            <input
              type="text"
              {...register('nom')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nom de votre entreprise"
            />
            {errors.nom && (
              <p className="mt-1 text-sm text-red-600">{errors.nom.message}</p>
            )}
          </div>

          {/* Adresse */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rue *
              </label>
              <input
                type="text"
                {...register('adresse.rue')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Adresse de l'entreprise"
              />
              {errors.adresse?.rue && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.rue.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville *
              </label>
              <input
                type="text"
                {...register('adresse.ville')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ville"
              />
              {errors.adresse?.ville && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.ville.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code postal *
              </label>
              <input
                type="text"
                {...register('adresse.codePostal')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Code postal"
              />
              {errors.adresse?.codePostal && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.codePostal.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pays *
              </label>
              <input
                type="text"
                {...register('adresse.pays')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Pays"
              />
              {errors.adresse?.pays && (
                <p className="mt-1 text-sm text-red-600">{errors.adresse.pays.message}</p>
              )}
            </div>
          </div>

          {/* TVA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de TVA
            </label>
            <input
              type="text"
              {...register('tva')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Numéro de TVA"
            />
          </div>

          {/* Devise et Langue */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Devise *
              </label>
              <select
                {...register('devise')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Langue *
              </label>
              <select
                {...register('langue')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuseau horaire *
              </label>
              <select
                {...register('fuseau')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo de l'entreprise
            </label>
            
            {/* Logo Preview */}
            {logoPreview && (
              <div className="mb-3">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-32 h-32 object-contain border border-gray-300 rounded-lg p-2 bg-white"
                />
              </div>
            )}
            
            {/* Upload Button */}
            <div className="flex items-center gap-4">
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
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Supprimer
                </button>
              )}
            </div>
            
            <p className="mt-2 text-sm text-gray-500">
              Formats acceptés: JPG, PNG, GIF. Taille max: 5MB
            </p>
          </div>

          {/* Thème */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Couleur primaire
              </label>
              <input
                type="color"
                {...register('theme.primary')}
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Couleur secondaire
              </label>
              <input
                type="color"
                {...register('theme.secondary')}
                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* En-tête des documents */}
          <div className="border-t pt-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              En-tête des documents
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slogan
                </label>
                <input
                  type="text"
                  {...register('enTete.slogan')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Votre slogan d'entreprise"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    {...register('enTete.telephone')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+216 XX XXX XXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    {...register('enTete.email')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="contact@entreprise.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Site web
                  </label>
                  <input
                    type="url"
                    {...register('enTete.siteWeb')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="https://www.entreprise.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Matricule fiscal
                  </label>
                  <input
                    type="text"
                    {...register('enTete.matriculeFiscal')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="12345678/A/M/000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registre de commerce
                  </label>
                  <input
                    type="text"
                    {...register('enTete.registreCommerce')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="RC B 123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capital social
                  </label>
                  <input
                    type="text"
                    {...register('enTete.capitalSocial')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="100,000 TND"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pied de page des documents */}
          <div className="border-t pt-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">
              Pied de page des documents
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texte personnalisé
                </label>
                <textarea
                  {...register('piedPage.texte')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Texte à afficher en bas des documents"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conditions générales
                </label>
                <textarea
                  {...register('piedPage.conditionsGenerales')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Conditions générales de vente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mentions légales
                </label>
                <textarea
                  {...register('piedPage.mentionsLegales')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Mentions légales"
                />
              </div>

              <div className="border-t pt-4">
                <h5 className="text-md font-medium text-gray-800 mb-3">
                  Coordonnées bancaires
                </h5>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Banque
                    </label>
                    <input
                      type="text"
                      {...register('piedPage.coordonneesBancaires.banque')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Nom de la banque"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RIB
                    </label>
                    <input
                      type="text"
                      {...register('piedPage.coordonneesBancaires.rib')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Code RIB"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SWIFT
                    </label>
                    <input
                      type="text"
                      {...register('piedPage.coordonneesBancaires.swift')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
