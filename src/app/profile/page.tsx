'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { toast } from 'react-hot-toast';
import {
    ShieldCheckIcon,
    DevicePhoneMobileIcon,
    UserCircleIcon,
    KeyIcon,
    EyeIcon,
    EyeSlashIcon
} from '@heroicons/react/24/outline';

export default function ProfilePage() {
    const { data: session, update } = useSession();

    // Loading States
    const [loading, setLoading] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    // 2FA State
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify'>('idle');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');

    // Backup Codes State
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [showBackupCodes, setShowBackupCodes] = useState(false);

    // Password Form State
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    useEffect(() => {
        if (session?.user) {
            fetch2FAStatus();
        }
    }, [session]);

    const fetch2FAStatus = async () => {
        try {
            const res = await fetch('/api/auth/2fa/status');
            if (res.ok) {
                const data = await res.json();
                setIs2FAEnabled(data.isTwoFactorEnabled);
            }
        } catch (error) {
            console.error('Error fetching 2FA status', error);
        }
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
                await update({ isTwoFactorEnabled: true });
                fetch2FAStatus();
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
                setShowBackupCodes(false);
                setBackupCodes([]);
                toast.success('2FA Désactivé');
                await update({ isTwoFactorEnabled: false });
                fetch2FAStatus();
            }
        } catch (e) {
            toast.error('Erreur');
        } finally {
            setLoading(false);
        }
    };

    const regenerateBackupCodes = async () => {
        if (!confirm("Attention: Cela va invalider tous vos anciens codes de secours. Voulez-vous continuer ?")) return;
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/backup-codes', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setBackupCodes(data.codes);
                setShowBackupCodes(true);
                toast.success("Nouveaux codes générés");
            } else {
                toast.error("Erreur lors de la génération");
            }
        } catch (e) {
            toast.error("Erreur connexion");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Les nouveaux mots de passe ne correspondent pas');
            return;
        }
        if (passwordForm.newPassword === passwordForm.currentPassword) {
            toast.error('Le nouveau mot de passe doit être différent de l\'ancien');
            return;
        }
        if (passwordForm.newPassword.length < 8) {
            toast.error('Le mot de passe doit contenir au moins 8 caractères');
            return;
        }

        try {
            setSavingPassword(true);
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                toast.error(errorText || 'Erreur lors du changement');
                return;
            }

            toast.success('Mot de passe mis à jour avec succès');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error('Erreur de connexion');
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto p-6 space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mon Profil</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Gérez vos informations personnelles et votre sécurité.
                    </p>
                </div>

                {/* User Info Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <UserCircleIcon className="h-6 w-6 text-indigo-500" />
                            Informations Personnelles
                        </h2>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Nom complet</label>
                            <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">{session?.user?.name}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                            <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">{session?.user?.email}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Rôle</label>
                            <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                                {session?.user?.role}
                            </span>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Entreprise</label>
                            <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">{(session?.user as any)?.companyName || 'N/A'}</p>
                        </div>
                    </div>
                </div>

                {/* Security Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <ShieldCheckIcon className="h-6 w-6 text-indigo-500" />
                            Sécurité du compte
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Authentification à deux facteurs et protection.</p>
                    </div>

                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="mb-4 sm:mb-0">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Authentification à deux facteurs (2FA)</h4>
                                    {is2FAEnabled ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                                            Activé
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                            Désactivé
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                                    Sécurisez votre compte avec un code temporaire.
                                </p>
                            </div>

                            <div>
                                {!is2FAEnabled && setupStep === 'idle' && (
                                    <button
                                        onClick={start2FASetup}
                                        disabled={loading}
                                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                                    >
                                        Configurer
                                    </button>
                                )}
                                {is2FAEnabled && (
                                    (session?.user as any)?.requires2FA ? (
                                        <div className="flex flex-col items-end">
                                            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600 mb-1 cursor-not-allowed">
                                                🔒 Désactivation bloquée
                                            </span>
                                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                Politique entreprise obligatoire
                                            </span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={disable2FA}
                                            disabled={loading}
                                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white dark:bg-gray-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                                        >
                                            Désactiver
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        {setupStep === 'qr' && (
                            <div className="mt-6 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-fade-in">
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Configuration 2FA</h4>
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                                        {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code 2FA" className="w-40 h-40 object-contain" />}
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">1. Scannez le code QR</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                                Utilisez Google Authenticator. Clé manuelle :
                                            </p>
                                            <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded border text-indigo-600 dark:text-indigo-400 font-mono text-sm select-all">
                                                {secret}
                                            </code>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">2. Validez le code</p>
                                            <div className="flex flex-wrap gap-3 items-center">
                                                <input
                                                    type="text"
                                                    value={token}
                                                    onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="000 000"
                                                    className="block w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center tracking-widest font-mono bg-white dark:bg-gray-700 dark:text-white"
                                                />
                                                <button
                                                    onClick={verifyAndEnable}
                                                    disabled={loading || token.length !== 6}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    Activer
                                                </button>
                                                <button
                                                    onClick={() => setSetupStep('idle')}
                                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                                                >
                                                    Annuler
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {is2FAEnabled && (
                            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Codes de Secours</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    Utilisez ces codes si vous perdez votre téléphone. À conserver précieusement. <br />
                                    <span className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 block">
                                        (Hédhom les codes ykhalouk todkhel l compte mta3ek kén dhaya3t telifounek)
                                    </span>
                                </p>

                                {!showBackupCodes ? (
                                    <button
                                        onClick={regenerateBackupCodes}
                                        disabled={loading}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        🔄 Générer / Afficher les codes
                                    </button>
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-fade-in user-select-none">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                                Codes nouveaux
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const element = document.createElement("a");
                                                        const file = new Blob([
                                                            `CODES DE SECOURS (BACKUP CODES)\n` +
                                                            `Généré le: ${new Date().toLocaleString()}\n\n` +
                                                            backupCodes.join("\n")
                                                        ], { type: 'text/plain' });
                                                        element.href = URL.createObjectURL(file);
                                                        element.download = "backup-codes.txt";
                                                        document.body.appendChild(element);
                                                        element.click();
                                                        document.body.removeChild(element);
                                                    }}
                                                    className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                    </svg>
                                                    TXT
                                                </button>
                                                <button
                                                    onClick={() => setShowBackupCodes(false)}
                                                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                                >
                                                    Masquer
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-sm text-center">
                                            {backupCodes.map((code, idx) => (
                                                <div key={idx} className="bg-white dark:bg-gray-700 p-2 rounded border border-gray-100 dark:border-gray-500 select-all text-gray-800 dark:text-gray-100 shadow-sm">
                                                    {code}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3 text-center">
                                            ⚠️ Sauvegardez-les maintenant. Ils ne seront plus visibles une fois masqués.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <KeyIcon className="h-6 w-6 text-indigo-500" />
                            Changer le mot de passe
                        </h2>
                    </div>
                    <div className="p-6">
                        <form onSubmit={handlePasswordChange} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Mot de passe actuel
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                value={passwordForm.currentPassword}
                                                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                                            >
                                                {showCurrentPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Nouveau mot de passe
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                value={passwordForm.newPassword}
                                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                                            >
                                                {showNewPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Confirmer le mot de passe
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                value={passwordForm.confirmPassword}
                                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                                            >
                                                {showConfirmPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Password Requirements Checklist */}
                                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 h-fit self-start">
                                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Critères de sécurité</h4>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'Au moins 8 caractères', valid: passwordForm.newPassword.length >= 8 },
                                            { label: 'Au moins une majuscule', valid: /[A-Z]/.test(passwordForm.newPassword) },
                                            { label: 'Au moins une minuscule', valid: /[a-z]/.test(passwordForm.newPassword) },
                                            { label: 'Au moins un chiffre', valid: /[0-9]/.test(passwordForm.newPassword) },
                                            { label: 'Au moins un caractère spécial', valid: /[^A-Za-z0-9]/.test(passwordForm.newPassword) },
                                        ].map((req, idx) => (
                                            <div key={idx} className="flex items-center text-xs">
                                                <div className={`mr-2.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border ${req.valid
                                                    ? 'bg-green-100 border-green-500 text-green-600 dark:bg-green-900/40 dark:border-green-500/50 dark:text-green-400'
                                                    : 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500'
                                                    }`}>
                                                    {req.valid && (
                                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={`${req.valid
                                                    ? 'text-gray-900 dark:text-gray-200 font-medium'
                                                    : 'text-gray-500 dark:text-gray-500'
                                                    }`}>
                                                    {req.label}
                                                </span>
                                            </div>
                                        ))}

                                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                                            <div className="flex items-center text-xs">
                                                <div className={`mr-2.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border ${passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword
                                                    ? 'bg-green-100 border-green-500 text-green-600 dark:bg-green-900/40 dark:border-green-500/50 dark:text-green-400'
                                                    : 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-500'
                                                    }`}>
                                                    {passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword && (
                                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span className={`${passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword
                                                    ? 'text-gray-900 dark:text-gray-200 font-medium'
                                                    : 'text-gray-500 dark:text-gray-500'
                                                    }`}>
                                                    Les mots de passe correspondent
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={savingPassword}
                                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                                >
                                    {savingPassword ? 'Mise à jour en cours...' : 'Mettre à jour le mot de passe'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Login History Card */}
                <LoginHistorySection />
            </div>
        </DashboardLayout>
    );
}

function LoginHistorySection() {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedState, setCopiedState] = useState<{ index: number, field: string } | null>(null);

    const handleCopy = (text: string, index: number, field: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedState({ index, field });
        setTimeout(() => setCopiedState(null), 2000);
    };

    useEffect(() => {
        fetch('/api/user/login-history')
            .then(res => res.json())
            .then(data => {
                if (data.history) setHistory(data.history);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const getMethodLabel = (method: string) => {
        switch (method) {
            case 'password': return 'Mot de passe';
            case '2fa_app': return 'Appli 2FA';
            case '2fa_email': return 'Email 2FA';
            case 'backup_code': return 'Code de secours';
            default: return 'Inconnue';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Historique de connexion
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Vos dernières connexions récentes. Si vous voyez une activité suspecte, changez votre mot de passe immédiatement.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Date & Heure
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Méthode
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                IP
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Appareil (User Agent)
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                    Chargement...
                                </td>
                            </tr>
                        ) : history.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                                    Aucun historique disponible.
                                </td>
                            </tr>
                        ) : (
                            history.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                                        {new Date(entry.timestamp).toLocaleString('fr-FR')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${entry.method?.includes('2fa') || entry.method?.includes('backup')
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                            }`}>
                                            {getMethodLabel(entry.method || 'password')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                                        <div className="flex items-center gap-2">
                                            <span>{entry.ip || 'Inconnue'}</span>
                                            {entry.ip && entry.ip !== 'Inconnue' && (
                                                <button
                                                    onClick={() => handleCopy(entry.ip, idx, 'ip')}
                                                    className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none"
                                                    title="Copier l'IP"
                                                >
                                                    {copiedState?.index === idx && copiedState?.field === 'ip' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={entry.userAgent}>
                                        <div className="flex items-center gap-2">
                                            <span className="truncate max-w-[200px]">{entry.userAgent || 'Inconnu'}</span>
                                            {entry.userAgent && (
                                                <button
                                                    onClick={() => handleCopy(entry.userAgent, idx, 'ua')}
                                                    className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none flex-shrink-0"
                                                    title="Copier User Agent"
                                                >
                                                    {copiedState?.index === idx && copiedState?.field === 'ua' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
