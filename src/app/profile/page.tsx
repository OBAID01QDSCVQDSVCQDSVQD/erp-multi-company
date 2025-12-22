
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { toast } from 'react-hot-toast';
import { ShieldCheckIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';

export default function ProfilePage() {
    const { data: session, update } = useSession();
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify'>('idle');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (session?.user) {
            // @ts-ignore
            setIs2FAEnabled(!!session.user.isTwoFactorEnabled);
        }
    }, [session]);

    const check2FAStatus = async () => {
        // Legacy placeholder, relying on session now.
    };

    const start2FASetup = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/generate', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setQrCodeUrl(data.qrCodeUrl);
                setSecret(data.secret);
                setSetupStep('qr');
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
                toast.success('2FA Activé avec succès !');
                setIs2FAEnabled(true);
                setSetupStep('idle');
                // Update session to reflect change?
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

    const disable2FA = async () => {
        if (!confirm('Êtes-vous sûr de vouloir désactiver la double authentification ?')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/disable', { method: 'POST' });
            if (res.ok) {
                setIs2FAEnabled(false);
                toast.success('2FA Désactivé');
            }
        } catch (e) {
            toast.error('Erreur');
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Mon Profil</h1>

                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                            <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
                            Sécurité du compte
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">Gérez vos méthodes d'authentification.</p>
                    </div>

                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="text-base font-medium text-gray-900">Authentification à deux facteurs (2FA)</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                                    Ajoutez une couche de sécurité supplémentaire à votre compte en exigeant un code de votre téléphone lors de la connexion.
                                </p>
                            </div>
                            <div>
                                {is2FAEnabled ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                        Activé
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                        Désactivé
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="mt-6">
                            {!is2FAEnabled && setupStep === 'idle' && (
                                <button
                                    onClick={start2FASetup}
                                    disabled={loading}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Configurer 2FA
                                </button>
                            )}

                            {is2FAEnabled && (
                                <button
                                    onClick={disable2FA}
                                    disabled={loading}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Désactiver 2FA
                                </button>
                            )}

                            {setupStep === 'qr' && (
                                <div className="mt-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-900 mb-4">1. Scannez le code QR</h4>
                                    <div className="flex flex-col md:flex-row gap-8 items-start">
                                        <div className="bg-white p-2 rounded shadow-sm">
                                            {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code 2FA" className="w-48 h-48" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-600 mb-4">
                                                Ouvrez votre application d'authentification (Google Authenticator, Authy, etc.) et scannez le code.
                                            </p>
                                            <p className="text-xs text-gray-500 mb-4">
                                                Si vous ne pouvez pas scanner le code, entrez cette clé manuellement : <br />
                                                <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800 font-mono select-all">{secret}</code>
                                            </p>

                                            <h4 className="text-sm font-bold text-gray-900 mb-2">2. Entrez le code de vérification</h4>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={token}
                                                    onChange={(e) => setToken(e.target.value)}
                                                    placeholder="000000"
                                                    maxLength={6}
                                                    className="block w-40 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center tracking-widest"
                                                />
                                                <button
                                                    onClick={verifyAndEnable}
                                                    disabled={loading || token.length !== 6}
                                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    {loading ? 'Vérification...' : 'Activer'}
                                                </button>
                                                <button
                                                    onClick={() => setSetupStep('idle')}
                                                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
