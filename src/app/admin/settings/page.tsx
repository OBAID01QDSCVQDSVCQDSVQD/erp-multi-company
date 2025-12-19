'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/Layout/AdminLayout';
import {
    GlobeAltIcon,
    ShieldCheckIcon,
    MegaphoneIcon,
    EnvelopeIcon,
    PhoneIcon,
    CheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<any>({
        systemName: '',
        registrationEnabled: true,
        maintenanceMode: false,
        announcementMessage: '',
        contactEmail: '',
        supportPhone: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(data);
            } else {
                toast.error("Impossible de charger les paramètres");
            }
        } catch (e) {
            toast.error("Erreur de connexion");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                const data = await res.json();
                setSettings(data);
                toast.success("Paramètres mis à jour avec succès");
            } else {
                toast.error("Erreur lors de la sauvegarde");
            }
        } catch (e) {
            toast.error("Erreur de connexion");
        } finally {
            setSaving(false);
        }
    };

    const Toggle = ({ label, checked, onChange, description }: any) => (
        <div className="flex items-center justify-between py-4">
            <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                {description && <span className="text-sm text-gray-500 dark:text-gray-400">{description}</span>}
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`${checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2`}
            >
                <span
                    aria-hidden="true"
                    className={`${checked ? 'translate-x-5' : 'translate-x-0'
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                />
            </button>
        </div>
    );

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres du Système</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Configuration globale de l'application.</p>
                </div>

                <form onSubmit={handleSave} className="space-y-6">

                    {/* General Information */}
                    <div className="bg-white dark:bg-gray-800 shadow px-4 py-5 sm:rounded-lg sm:p-6">
                        <div className="md:grid md:grid-cols-3 md:gap-6">
                            <div className="md:col-span-1">
                                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center gap-2">
                                    <GlobeAltIcon className="h-5 w-5 text-gray-400" /> Général
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Informations de base visibles par tous les utilisateurs.
                                </p>
                            </div>
                            <div className="mt-5 md:col-span-2 md:mt-0 space-y-6">
                                <div className="grid grid-cols-6 gap-6">
                                    <div className="col-span-6 sm:col-span-4">
                                        <label htmlFor="systemName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom du système</label>
                                        <input
                                            type="text"
                                            name="systemName"
                                            id="systemName"
                                            value={settings.systemName}
                                            onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                        />
                                    </div>

                                    <div className="col-span-6 sm:col-span-4">
                                        <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email de contact / Support</label>
                                        <div className="mt-1 flex rounded-md shadow-sm">
                                            <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 text-gray-500 dark:text-gray-400 sm:text-sm">
                                                <EnvelopeIcon className="h-4 w-4" />
                                            </span>
                                            <input
                                                type="email"
                                                name="contactEmail"
                                                id="contactEmail"
                                                value={settings.contactEmail}
                                                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                                                className="block w-full min-w-0 flex-1 rounded-none rounded-r-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-6 sm:col-span-4">
                                        <label htmlFor="supportPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Téléphone du Support</label>
                                        <div className="mt-1 flex rounded-md shadow-sm">
                                            <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 text-gray-500 dark:text-gray-400 sm:text-sm">
                                                <PhoneIcon className="h-4 w-4" />
                                            </span>
                                            <input
                                                type="text"
                                                name="supportPhone"
                                                id="supportPhone"
                                                value={settings.supportPhone}
                                                onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                                                className="block w-full min-w-0 flex-1 rounded-none rounded-r-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Access Control & Security */}
                    <div className="bg-white dark:bg-gray-800 shadow px-4 py-5 sm:rounded-lg sm:p-6">
                        <div className="md:grid md:grid-cols-3 md:gap-6">
                            <div className="md:col-span-1">
                                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center gap-2">
                                    <ShieldCheckIcon className="h-5 w-5 text-gray-400" /> Sécurité & Accès
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Contrôlez l'accès et la disponibilité de la plateforme.
                                </p>
                            </div>
                            <div className="mt-5 md:col-span-2 md:mt-0">
                                <div className="space-y-4">
                                    <Toggle
                                        label="Inscriptions ouvertes"
                                        description="Autoriser les nouvelles entreprises à s'inscrire."
                                        checked={settings.registrationEnabled}
                                        onChange={(val: boolean) => setSettings({ ...settings, registrationEnabled: val })}
                                    />
                                    <div className="border-t border-gray-200 dark:border-gray-700"></div>
                                    <Toggle
                                        label="Mode Maintenance"
                                        description="Empêche la connexion de tous les utilisateurs non-admin."
                                        checked={settings.maintenanceMode}
                                        onChange={(val: boolean) => setSettings({ ...settings, maintenanceMode: val })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Announcements */}
                    <div className="bg-white dark:bg-gray-800 shadow px-4 py-5 sm:rounded-lg sm:p-6">
                        <div className="md:grid md:grid-cols-3 md:gap-6">
                            <div className="md:col-span-1">
                                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center gap-2">
                                    <MegaphoneIcon className="h-5 w-5 text-gray-400" /> Annonces
                                </h3>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Diffuser un message global à tous les utilisateurs (ex: maintenance à venir).
                                </p>
                            </div>
                            <div className="mt-5 md:col-span-2 md:mt-0">
                                <div>
                                    <label htmlFor="announcement" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message d'annonce</label>
                                    <div className="mt-1">
                                        <textarea
                                            id="announcement"
                                            name="announcement"
                                            rows={3}
                                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2"
                                            placeholder="Laissez vide pour désactiver le bandeau d'annonce."
                                            value={settings.announcementMessage}
                                            onChange={(e) => setSettings({ ...settings, announcementMessage: e.target.value })}
                                        />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-500">
                                        Ce message s'affichera en haut de chaque page pour tous les utilisateurs connectés.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {saving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
                        </button>
                    </div>

                </form>
            </div>
        </AdminLayout>
    );
}
