'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';

interface SecuriteTabProps {
  tenantId: string;
}

export default function SecuriteTab({ tenantId }: SecuriteTabProps) {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password Form State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 2FA Personal State
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify'>('idle');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

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
        update({ isTwoFactorEnabled: true }); // Properly update session
        fetch2FAStatus(); // Refresh status from server
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
        update({ isTwoFactorEnabled: false }); // Properly update session
        fetch2FAStatus(); // Refresh status from server
      }
    } catch (e) {
      toast.error('Erreur');
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

    // Appel API réel
    try {
      setSaving(true);
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error(errorText || 'Erreur lors du changement de mot de passe');
        setSaving(false);
        return;
      }

      toast.success('Mot de passe mis à jour avec succès');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error(error);
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  // Company Settings State
  const [companySettings, setCompanySettings] = useState<{
    securite?: { deuxFA?: boolean; motDePasseComplexe?: boolean }
  } | null>(null);

  useEffect(() => {
    fetchCompanySettings();
  }, [tenantId]);

  const fetchCompanySettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (res.ok) {
        const data = await res.json();
        setCompanySettings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCompany2FA = async () => {
    if (!companySettings) return;
    const newValue = !companySettings.securite?.deuxFA;

    try {
      // Optimistic update
      setCompanySettings({
        ...companySettings,
        securite: { ...companySettings.securite, deuxFA: newValue }
      });

      await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId
        },
        body: JSON.stringify({
          securite: { ...companySettings.securite, deuxFA: newValue }
        })
      });
      toast.success(`Politique 2FA ${newValue ? 'activée' : 'désactivée'} pour l'entreprise`);
    } catch (e) {
      toast.error("Erreur de sauvegarde");
      fetchCompanySettings(); // Revert
    }
  };

  if (loading && !is2FAEnabled && setupStep === 'idle') {
    // Only show full loader if initial loading
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Politiques globales (Toute l'équipe)
        </h3>

        <div className="bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Ces réglages s'appliquent à <strong>tous les utilisateurs</strong> de votre société.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pb-4 border-b dark:border-gray-700 mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Forcer l'authentification à deux facteurs (2FA)
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Si activé, tous les utilisateurs devront configurer la 2FA lors de leur prochaine connexion.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={companySettings?.securite?.deuxFA || false}
              onChange={toggleCompany2FA}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-md">
          <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-400 mb-2">Recommandations de sécurité :</h4>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• Activez l'authentification à deux facteurs pour tous les utilisateurs</li>
            <li>• Exigez des mots de passe complexes d'au moins 12 caractères</li>
          </ul>
        </div>
      </div >

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          Sécurité de mon compte (Administrateur)
        </h3>

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
              Protégez votre compte administrateur en exigeant un code temporaire lors de la connexion.
            </p>
          </div>

          <div>
            {!is2FAEnabled && setupStep === 'idle' && (
              <button
                onClick={start2FASetup}
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
              >
                Configurer 2FA
              </button>
            )}

            {is2FAEnabled && (
              <button
                onClick={disable2FA}
                disabled={loading}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white dark:bg-gray-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
              >
                Désactiver
              </button>
            )}
          </div>
        </div>

        {setupStep === 'qr' && (
          <div className="mt-6 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 animate-fade-in">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Configuration de l'authentification</h4>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code 2FA" className="w-40 h-40 object-contain" />}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">1. Scannez le code QR</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Utilisez Google Authenticator ou Authy. Si vous ne pouvez pas scanner, entrez la clé manuellement :
                  </p>
                  <div className="mt-2 inline-block">
                    <code className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 font-mono text-sm select-all tracking-wider shadow-sm">
                      {secret}
                    </code>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">2. Validez le code</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000 000"
                      maxLength={6}
                      className="block w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-center tracking-widest font-mono bg-white dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      onClick={verifyAndEnable}
                      disabled={loading || token.length !== 6}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {loading ? '...' : 'Activer'}
                    </button>
                    <button
                      onClick={() => setSetupStep('idle')}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 shadow-sm"
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
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Codes de Secours (Backup Codes)</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Ces codes vous permettent d'accéder à votre compte si vous perdez votre téléphone. <br />
              Chaque code ne peut être utilisé qu'une seule fois.
              <br />
              <span className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 block">
                (Hédhom les codes ykhalouk todkhel l compte mta3ek kén dhaya3t telifounek. Kol code tnjm testaa3mlou mara bark.)
              </span>
            </p>

            {!showBackupCodes ? (
              <button
                onClick={async () => {
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
                }}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                🔄 Générer de nouveaux codes
              </button>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-fade-in user-select-none">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Codes actifs
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const element = document.createElement("a");
                        const file = new Blob([
                          `CODES DE SECOURS (BACKUP CODES)\n\n` +
                          `Généré le: ${new Date().toLocaleString()}\n` +
                          `Conservez ces codes dans un endroit sûr.\n\n` +
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
                  ⚠️ Sauvegardez ces codes maintenant. Vous ne pourrez plus les voir ici une fois masqués.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section Changer le mot de passe */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          Changer le mot de passe
        </h3>
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
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Mise à jour en cours...' : 'Mettre à jour le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
