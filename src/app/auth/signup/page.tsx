'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BuildingOfficeIcon,
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  PhoneIcon,
  MapPinIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import toast from 'react-hot-toast';

const signUpSchema = z.object({
  // Company Info
  companyName: z.string().min(2, 'Le nom de l\'entreprise doit contenir au moins 2 caractères'),
  companyEmail: z.string().email('Email invalide'),
  companyPhone: z.string().optional(),
  companyAddress: z.string().optional(),
  companyCity: z.string().optional(),
  companyPostalCode: z.string().optional(),
  companyCountry: z.string().optional(),
  taxNumber: z.string().optional(),
  registrationNumber: z.string().optional(),

  // Admin Info
  adminFirstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  adminLastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  adminEmail: z.string().email('Email invalide'),
  adminPassword: z.string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre')
    .regex(/[\W_]/, 'Au moins un caractère spécial'),
  confirmPassword: z.string(),
}).refine((data) => data.adminPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

type SignUpForm = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
  });

  const passwordValue = watch('adminPassword', '');

  const onSubmit = async (data: SignUpForm) => {
    setIsLoading(true);

    try {
      // Create company
      const companyResponse = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.companyName,
          email: data.companyEmail,
          phone: data.companyPhone || '',
          address: {
            street: data.companyAddress || '',
            city: data.companyCity || '',
            postalCode: data.companyPostalCode || '',
            country: data.companyCountry || 'Tunisie',
          },
          taxNumber: data.taxNumber || '',
          registrationNumber: data.registrationNumber || '',
          isActive: true,
        }),
      });

      if (!companyResponse.ok) {
        const errorData = await companyResponse.json();
        throw new Error(errorData.error || 'Erreur lors de la création de l\'entreprise');
      }

      const company = await companyResponse.json();

      // Create admin user
      const userResponse = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.adminEmail,
          password: data.adminPassword,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          role: 'admin',
          permissions: ['all'],
          companyId: company._id,
        }),
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error || 'Erreur lors de la création de l\'utilisateur administrateur');
      }

      setSuccess(true);
      toast.success('Entreprise créée avec succès !');

      setSuccess(true);
      toast.success('Compte créé ! Veuillez vérifier votre email.');

      // Removed auto-redirect to allow user to read the verification message
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="bg-white py-12 px-8 shadow-2xl rounded-2xl text-center border border-gray-100">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
              <EnvelopeIcon className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Vérifiez votre email
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Votre compte a été créé avec succès. Un email de confirmation a été envoyé à votre adresse.
            </p>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8 text-left">
              <p className="text-sm text-blue-800">
                <strong>Important :</strong> Vous devez cliquer sur le lien dans l'email pour activer votre compte avant de pouvoir vous connecter.
              </p>
            </div>
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full transition-colors"
            >
              Aller à la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Créer votre entreprise</h1>
          <p className="text-lg text-gray-600">Rejoignez notre plateforme ERP multi-entreprises</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Company Information Card */}
          <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-gray-900">Informations de l'entreprise</h2>
                <p className="text-sm text-gray-600">Renseignez les détails de votre entreprise</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Name */}
              <div className="md:col-span-2">
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom de l'entreprise *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('companyName')}
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="Nom de votre entreprise"
                  />
                </div>
                {errors.companyName && (
                  <p className="mt-2 text-sm text-red-600">{errors.companyName.message}</p>
                )}
              </div>

              {/* Company Email */}
              <div>
                <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email de l'entreprise *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('companyEmail')}
                    type="email"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="contact@entreprise.com"
                  />
                </div>
                {errors.companyEmail && (
                  <p className="mt-2 text-sm text-red-600">{errors.companyEmail.message}</p>
                )}
              </div>

              {/* Company Phone */}
              <div>
                <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PhoneIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('companyPhone')}
                    type="tel"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="+216 XX XXX XXX"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPinIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('companyAddress')}
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="Rue, numéro"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label htmlFor="companyCity" className="block text-sm font-medium text-gray-700 mb-2">
                  Ville
                </label>
                <input
                  {...register('companyCity')}
                  type="text"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                  placeholder="Ville"
                />
              </div>

              {/* Postal Code */}
              <div>
                <label htmlFor="companyPostalCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Code postal
                </label>
                <input
                  {...register('companyPostalCode')}
                  type="text"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                  placeholder="XXXX"
                />
              </div>

              {/* Country */}
              <div>
                <label htmlFor="companyCountry" className="block text-sm font-medium text-gray-700 mb-2">
                  Pays
                </label>
                <input
                  {...register('companyCountry')}
                  type="text"
                  defaultValue="Tunisie"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                  placeholder="Pays"
                />
              </div>

              {/* Tax Number */}
              <div>
                <label htmlFor="taxNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Matricule fiscal
                </label>
                <input
                  {...register('taxNumber')}
                  type="text"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                  placeholder="Matricule fiscal"
                />
              </div>

              {/* Registration Number */}
              <div>
                <label htmlFor="registrationNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Registre de commerce
                </label>
                <input
                  {...register('registrationNumber')}
                  type="text"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                  placeholder="N° registre de commerce"
                />
              </div>
            </div>
          </div>

          {/* Admin Account Card */}
          <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-gray-100">
            <div className="flex items-center mb-6">
              <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <UserIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-gray-900">Compte administrateur</h2>
                <p className="text-sm text-gray-600">Créez votre compte administrateur</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div>
                <label htmlFor="adminFirstName" className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('adminFirstName')}
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="Prénom"
                  />
                </div>
                {errors.adminFirstName && (
                  <p className="mt-2 text-sm text-red-600">{errors.adminFirstName.message}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="adminLastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('adminLastName')}
                    type="text"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="Nom"
                  />
                </div>
                {errors.adminLastName && (
                  <p className="mt-2 text-sm text-red-600">{errors.adminLastName.message}</p>
                )}
              </div>

              {/* Admin Email */}
              <div>
                <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Email administrateur *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('adminEmail')}
                    type="email"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="admin@entreprise.com"
                  />
                </div>
                {errors.adminEmail && (
                  <p className="mt-2 text-sm text-red-600">{errors.adminEmail.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('adminPassword')}
                    type={showPassword ? 'text' : 'password'}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="Minimum 6 caractères"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                {errors.adminPassword && (
                  <p className="mt-2 text-sm text-red-600">{errors.adminPassword.message}</p>
                )}
                {/* Visual Password Strength Indicator */}
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${(() => {
                      let strength = 0;
                      if (!passwordValue) return 'w-0';
                      if (passwordValue.length >= 8) strength++;
                      if (/[A-Z]/.test(passwordValue)) strength++;
                      if (/[a-z]/.test(passwordValue)) strength++;
                      if (/[0-9]/.test(passwordValue)) strength++;
                      if (/[^a-zA-Z0-9]/.test(passwordValue)) strength++;

                      if (strength <= 2) return 'w-[20%] bg-red-500';
                      if (strength <= 3) return 'w-[50%] bg-yellow-500';
                      if (strength <= 4) return 'w-[75%] bg-blue-500';
                      return 'w-full bg-green-500';
                    })()}`}
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className={`text-xs ${passwordValue.length >= 8 ? 'text-green-600' : 'text-gray-400'}`}>• 8 caract.</span>
                  <span className={`text-xs ${/[A-Z]/.test(passwordValue) ? 'text-green-600' : 'text-gray-400'}`}>• Majuscule</span>
                  <span className={`text-xs ${/[a-z]/.test(passwordValue) ? 'text-green-600' : 'text-gray-400'}`}>• Minuscule</span>
                  <span className={`text-xs ${/[0-9]/.test(passwordValue) ? 'text-green-600' : 'text-gray-400'}`}>• Chiffre</span>
                  <span className={`text-xs ${/[^a-zA-Z0-9]/.test(passwordValue) ? 'text-green-600' : 'text-gray-400'}`}>• Symbole</span>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="md:col-span-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmer le mot de passe *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors sm:text-sm"
                    placeholder="Confirmez votre mot de passe"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/signin"
              className="flex-1 sm:flex-none px-6 py-3 border-2 border-gray-300 rounded-lg text-center font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 sm:flex-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Création en cours...
                </span>
              ) : (
                'Créer mon entreprise'
              )}
            </button>
          </div>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Vous avez déjà un compte ?{' '}
              <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                Se connecter
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

