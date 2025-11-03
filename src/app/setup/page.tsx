'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function SetupPage() {
  const [formData, setFormData] = useState({
    companyName: '',
    companyEmail: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  // Si l'utilisateur est déjà connecté, rediriger vers le dashboard
  if (session) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Créer l'entreprise
      const companyResponse = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.companyName,
          email: formData.companyEmail,
          phone: '+33 1 23 45 67 89',
          address: {
            street: '123 Rue de la Paix',
            city: 'Paris',
            postalCode: '75001',
            country: 'France'
          },
          taxNumber: 'FR12345678901',
          registrationNumber: '123456789',
          isActive: true
        }),
      });

      if (!companyResponse.ok) {
        throw new Error('Erreur lors de la création de l\'entreprise');
      }

      const company = await companyResponse.json();

      // Créer l'utilisateur administrateur
      const userResponse = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.adminEmail,
          password: formData.adminPassword,
          firstName: formData.adminFirstName,
          lastName: formData.adminLastName,
          role: 'admin',
          permissions: ['all'],
          companyId: company._id,
        }),
      });

      if (!userResponse.ok) {
        throw new Error('Erreur lors de la création de l\'utilisateur administrateur');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/signin');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-green-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Configuration terminée !
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Votre entreprise et votre compte administrateur ont été créés avec succès.
              <br />
              Redirection vers la page de connexion...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Configuration initiale
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Créez votre entreprise et votre compte administrateur
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Informations de l'entreprise</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
                    Nom de l'entreprise *
                  </label>
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    value={formData.companyName}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Nom de votre entreprise"
                  />
                </div>
                <div>
                  <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700">
                    Email de l'entreprise *
                  </label>
                  <input
                    id="companyEmail"
                    name="companyEmail"
                    type="email"
                    required
                    value={formData.companyEmail}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="contact@votre-entreprise.com"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Compte administrateur</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="adminFirstName" className="block text-sm font-medium text-gray-700">
                      Prénom *
                    </label>
                    <input
                      id="adminFirstName"
                      name="adminFirstName"
                      type="text"
                      required
                      value={formData.adminFirstName}
                      onChange={handleChange}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Prénom"
                    />
                  </div>
                  <div>
                    <label htmlFor="adminLastName" className="block text-sm font-medium text-gray-700">
                      Nom *
                    </label>
                    <input
                      id="adminLastName"
                      name="adminLastName"
                      type="text"
                      required
                      value={formData.adminLastName}
                      onChange={handleChange}
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                      placeholder="Nom"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
                    Email administrateur *
                  </label>
                  <input
                    id="adminEmail"
                    name="adminEmail"
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="admin@votre-entreprise.com"
                  />
                </div>
                <div>
                  <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">
                    Mot de passe *
                  </label>
                  <input
                    id="adminPassword"
                    name="adminPassword"
                    type="password"
                    required
                    minLength={6}
                    value={formData.adminPassword}
                    onChange={handleChange}
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Mot de passe (minimum 6 caractères)"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Création en cours...' : 'Créer l\'entreprise et le compte administrateur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
