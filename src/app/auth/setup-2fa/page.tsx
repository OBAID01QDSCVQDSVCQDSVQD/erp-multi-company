'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function Setup2FAPage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');
    const [step, setStep] = useState<'intro' | 'setup'>('intro');

    useEffect(() => {
        // If already enabled, kick them out
        if ((session?.user as any)?.isTwoFactorEnabled) {
            router.replace('/dashboard');
        }
    }, [session, router]);

    const startSetup = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/generate', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setQrCodeUrl(data.qrCodeUrl);
                setSecret(data.secret);
                setStep('setup');
            } else {
                toast.error(data.message || 'Erreur lors de la génération');
            }
        } catch (e) {
            toast.error('Erreur connexion');
        } finally {
            setLoading(false);
        }
    };

    const verifyAndEnable = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/turn-on', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            if (res.ok) {
                toast.success('2FA Configuré avec succès !');
                await update({ isTwoFactorEnabled: true });
                router.replace('/dashboard'); // Release from jail
            } else {
                const data = await res.json();
                toast.error(data.message || 'Code incorrect');
            }
        } catch (e) {
            toast.error('Erreur connexion');
        } finally {
            setLoading(false);
        }
    };

    if (!session) return null;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                    Sécurité Obligatoire 🔒
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    Lazmek tactivi l'authentification à deux facteurs (2FA) bech tnjm tkml tekhdm.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border dark:border-gray-700">

                    {step === 'intro' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">Chnowa lazmek ta3mel?</h3>
                                <ul className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-200 space-y-1">
                                    <li>Telechargi l'application <strong>Google Authenticator</strong> fi telifounek.</li>
                                    <li>Scanni l Code QR eli bech yatla3lek.</li>
                                    <li>Dakhhel l code eli f l'application.</li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <a
                                    href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 text-center"
                                >
                                    📲 Android (Play Store)
                                </a>
                                <a
                                    href="https://apps.apple.com/us/app/google-authenticator/id388497605"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 text-center"
                                >
                                    🍎 iPhone (App Store)
                                </a>
                            </div>

                            <button
                                onClick={startSetup}
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 mt-4"
                            >
                                {loading ? 'Chargement...' : 'Abda Configurazzion 🚀'}
                            </button>
                        </div>
                    )}

                    {step === 'setup' && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <h3 className="text-center font-medium text-gray-900 dark:text-white">
                                    Scanni l Code QR hédha b l'application Google Authenticator
                                </h3>
                                {qrCodeUrl && (
                                    <div className="bg-white p-2 rounded shadow-sm border">
                                        <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                                    </div>
                                )}

                                <div className="text-center">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Kéne l camera ma mchétch, 7ot l code hédha manuel:</p>
                                    <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded text-sm font-mono select-all text-gray-800 dark:text-gray-200">
                                        {secret}
                                    </code>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="token" className="block text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                                    A3tina l code eli tal3ek fl app (6 chiffres)
                                </label>
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        id="token"
                                        className="appearance-none block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-lg dark:bg-gray-700 dark:text-white text-center tracking-[0.5em] font-bold"
                                        placeholder="000 000"
                                        value={token}
                                        onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={verifyAndEnable}
                                disabled={loading || token.length !== 6}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {loading ? 'Vérification...' : 'Validé wodkhel ✅'}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
