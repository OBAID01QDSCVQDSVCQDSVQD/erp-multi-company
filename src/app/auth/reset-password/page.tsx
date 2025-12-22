'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

    if (!token) {
        return (
            <div className="text-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <p className="text-red-600 dark:text-red-400">Lien invalide ou manquant.</p>
                </div>
                <Link href="/auth/forgot-password" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                    Redemander un lien
                </Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Les mots de passe ne correspondent pas');
            return;
        }

        if (password.length < 8) {
            toast.error('Le mot de passe doit contenir au moins 8 caractères');
            return;
        }
        if (!/[A-Z]/.test(password)) {
            toast.error('Le mot de passe doit contenir au moins une majuscule');
            return;
        }
        if (!/[a-z]/.test(password)) {
            toast.error('Le mot de passe doit contenir au moins une minuscule');
            return;
        }
        if (!/[0-9]/.test(password)) {
            toast.error('Le mot de passe doit contenir au moins un chiffre');
            return;
        }
        if (!/[\W_]/.test(password)) {
            toast.error('Le mot de passe doit contenir au moins un caractère spécial');
            return;
        }

        setStatus('loading');

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'Une erreur est survenue');

            setStatus('success');
            toast.success('Mot de passe réinitialisé avec succès !');

            setTimeout(() => {
                router.push('/auth/signin');
            }, 3000);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message);
            setStatus('idle');
        }
    };

    if (status === 'success') {
        return (
            <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 mb-4">
                    <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Succès !</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Votre mot de passe a été modifié. Redirection vers la connexion...
                </p>
                <Link
                    href="/auth/signin"
                    className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                    Se connecter maintenant
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                    Nouveau mot de passe
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Entrez votre nouveau mot de passe sécurisé.
                </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nouveau mot de passe
                    </label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${(() => {
                                    let strength = 0;
                                    if (password.length >= 8) strength++;
                                    if (/[A-Z]/.test(password)) strength++;
                                    if (/[a-z]/.test(password)) strength++;
                                    if (/[0-9]/.test(password)) strength++;
                                    if (/[^a-zA-Z0-9]/.test(password)) strength++; // Any non-alphanumeric

                                    if (strength <= 2) return 'w-[20%] bg-red-500';
                                    if (strength <= 3) return 'w-[50%] bg-yellow-500';
                                    if (strength <= 4) return 'w-[75%] bg-blue-500';
                                    return 'w-full bg-green-500';
                                })()
                                }`}
                        />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Doit contenir 8 caractères, majuscule, minuscule, chiffre et symbole.
                    </p>
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Confirmer le mot de passe
                    </label>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                    >
                        {status === 'loading' ? 'Modification...' : 'Modifier le mot de passe'}
                    </button>
                </div>
            </form>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <Suspense fallback={<div className="text-center p-4">Chargement...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
