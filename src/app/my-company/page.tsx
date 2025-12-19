'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
    BuildingOfficeIcon,
    EnvelopeIcon,
    PhoneIcon,
    GlobeAltIcon,
    IdentificationIcon,
    CreditCardIcon,
    MapPinIcon,
    BuildingLibraryIcon,
    DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import Link from 'next/link';

export default function MyCompanyPage() {
    const { data: session } = useSession();
    const { tenantId } = useTenantId();
    const [companySettings, setCompanySettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (tenantId) {
            fetchCompanySettings();
        }
    }, [tenantId]);

    const fetchCompanySettings = async () => {
        try {
            const response = await fetch('/api/settings', {
                headers: { 'X-Tenant-Id': tenantId },
            });
            if (response.ok) {
                const data = await response.json();
                setCompanySettings(data);
            } else {
                setError('Impossible de charger les informations');
            }
        } catch (error) {
            console.error('Error fetching company settings:', error);
            setError('Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 py-4 animate-pulse">
                    <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg w-full mb-4"></div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-4 max-w-7xl mx-auto px-2 sm:px-4 py-3">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                            Ma Société
                        </h1>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                            Profil de l'entreprise
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
                    </div>
                )}

                {companySettings?.societe && (
                    <div className="space-y-4">
                        {/* Company Header Card */}
                        <div className="relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 group">
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-90 dark:opacity-80 transition-opacity group-hover:opacity-100"></div>

                            <div className="relative p-4 flex flex-col md:flex-row items-center md:items-start md:justify-between gap-4">
                                <div className="flex flex-col md:flex-row items-center gap-4">
                                    {/* Logo */}
                                    <div className="flex-shrink-0 relative">
                                        <div className="h-16 w-16 rounded-lg bg-white p-2 shadow-lg flex items-center justify-center overflow-hidden">
                                            {companySettings.societe.logoUrl ? (
                                                <img
                                                    src={companySettings.societe.logoUrl}
                                                    alt="Logo"
                                                    className="h-full w-full object-contain"
                                                />
                                            ) : (
                                                <BuildingOfficeIcon className="h-8 w-8 text-gray-300" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Company Info */}
                                    <div className="text-center md:text-left text-white">
                                        <h2 className="text-2xl font-black mb-1 tracking-tight leading-none">{companySettings.societe.nom}</h2>
                                        {companySettings.societe.enTete?.slogan && (
                                            <p className="text-xs text-indigo-100 italic mb-2 font-light opacity-80">
                                                "{companySettings.societe.enTete.slogan}"
                                            </p>
                                        )}
                                        <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-1">
                                            {companySettings.societe.tva && (
                                                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                                                    <IdentificationIcon className="h-3 w-3 text-indigo-100" />
                                                    <span className="text-[10px] font-medium">{companySettings.societe.tva}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                                                <CreditCardIcon className="h-3 w-3 text-indigo-100" />
                                                <span className="text-[10px] font-medium">{companySettings.societe.devise}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center gap-1.5 bg-green-500/20 backdrop-blur-md px-2 py-1 rounded-full border border-green-400/30">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                                    </span>
                                    <span className="text-white font-bold text-[10px] tracking-wide">ACTIF</span>
                                </div>
                            </div>
                        </div>

                        {/* Information Cards Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Address Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow transition-shadow">
                                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
                                    <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <MapPinIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Siège Social</h3>
                                </div>
                                <div className="p-3 space-y-2">
                                    <div>
                                        <p className="text-gray-900 dark:text-white font-bold text-sm leading-tight">{companySettings.societe.adresse.rue}</p>
                                        <p className="text-[10px] text-gray-600 dark:text-gray-400">{companySettings.societe.adresse.ville}, {companySettings.societe.adresse.codePostal}</p>
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium uppercase tracking-wider">{companySettings.societe.adresse.pays}</p>
                                    </div>
                                    <div className="h-20 w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500 text-[9px]">
                                            Carte non disponible
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow transition-shadow">
                                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
                                    <div className="p-1 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                        <PhoneIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Coordonnées</h3>
                                </div>
                                <div className="p-3 space-y-2">
                                    <div className="group flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400">
                                            <PhoneIcon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">Téléphone</p>
                                            <p className="text-xs text-gray-900 dark:text-white font-semibold leading-none">
                                                {companySettings.societe.enTete?.telephone || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="group flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                            <EnvelopeIcon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">Email</p>
                                            <p className="text-xs text-gray-900 dark:text-white font-semibold leading-none">
                                                {companySettings.societe.enTete?.email || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="group flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                            <GlobeAltIcon className="h-3.5 w-3.5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">Site Web</p>
                                            {companySettings.societe.enTete?.siteWeb ? (
                                                <a href={companySettings.societe.enTete.siteWeb} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline leading-none">
                                                    {companySettings.societe.enTete.siteWeb}
                                                </a>
                                            ) : (
                                                <p className="text-xs text-gray-900 dark:text-white font-semibold leading-none">-</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Legal Information */}
                            {(companySettings.societe.enTete?.matriculeFiscal ||
                                companySettings.societe.enTete?.registreCommerce ||
                                companySettings.societe.enTete?.capitalSocial ||
                                companySettings.societe.piedPage?.coordonneesBancaires) && (
                                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow transition-shadow lg:col-span-2">
                                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
                                            <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                                <BuildingLibraryIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Légal & Bancaire</h3>
                                        </div>
                                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Legal */}
                                            <div className="space-y-2">
                                                <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Juridique</h4>
                                                {companySettings.societe.enTete?.matriculeFiscal && (
                                                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                        <span className="text-gray-600 dark:text-gray-400 text-[10px]">Matricule fiscal</span>
                                                        <span className="text-gray-900 dark:text-white font-bold text-xs">{companySettings.societe.enTete.matriculeFiscal}</span>
                                                    </div>
                                                )}
                                                {companySettings.societe.enTete?.registreCommerce && (
                                                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                        <span className="text-gray-600 dark:text-gray-400 text-[10px]">RC</span>
                                                        <span className="text-gray-900 dark:text-white font-bold text-xs">{companySettings.societe.enTete.registreCommerce}</span>
                                                    </div>
                                                )}
                                                {companySettings.societe.enTete?.capitalSocial && (
                                                    <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                        <span className="text-gray-600 dark:text-gray-400 text-[10px]">Capital</span>
                                                        <span className="text-gray-900 dark:text-white font-bold text-xs">{companySettings.societe.enTete.capitalSocial}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Bank */}
                                            {companySettings.societe.piedPage?.coordonneesBancaires && (
                                                <div className="space-y-2">
                                                    <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bancaire</h4>
                                                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2 border border-gray-200 dark:border-gray-600 border-dashed">
                                                        {companySettings.societe.piedPage.coordonneesBancaires.banque && (
                                                            <div className="mb-1">
                                                                <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Banque</span>
                                                                <span className="text-gray-900 dark:text-white font-bold text-xs">{companySettings.societe.piedPage.coordonneesBancaires.banque}</span>
                                                            </div>
                                                        )}
                                                        {companySettings.societe.piedPage.coordonneesBancaires.rib && (
                                                            <div className="mb-1">
                                                                <span className="text-[9px] text-gray-500 dark:text-gray-400 block">RIB</span>
                                                                <span className="text-gray-900 dark:text-white font-mono text-[10px] break-all">{companySettings.societe.piedPage.coordonneesBancaires.rib}</span>
                                                            </div>
                                                        )}
                                                        {companySettings.societe.piedPage.coordonneesBancaires.swift && (
                                                            <div>
                                                                <span className="text-[9px] text-gray-500 dark:text-gray-400 block">SWIFT</span>
                                                                <span className="text-gray-900 dark:text-white font-mono text-[10px]">{companySettings.societe.piedPage.coordonneesBancaires.swift}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                        </div>

                        {/* Footer Information */}
                        {(companySettings.societe.piedPage?.texte ||
                            companySettings.societe.piedPage?.conditionsGenerales ||
                            companySettings.societe.piedPage?.mentionsLegales) && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Infos Complémentaires</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                        {companySettings.societe.piedPage.texte && (
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white mb-1 text-[10px] uppercase">À propos</h4>
                                                <p className="text-gray-600 dark:text-gray-400 text-[10px] leading-relaxed text-justify">{companySettings.societe.piedPage.texte}</p>
                                            </div>
                                        )}
                                        {companySettings.societe.piedPage.conditionsGenerales && (
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white mb-1 text-[10px] uppercase">CGV</h4>
                                                <p className="text-gray-600 dark:text-gray-400 text-[10px] leading-relaxed text-justify line-clamp-3 hover:line-clamp-none transition-all">{companySettings.societe.piedPage.conditionsGenerales}</p>
                                            </div>
                                        )}
                                        {companySettings.societe.piedPage.mentionsLegales && (
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white mb-1 text-[10px] uppercase">Mentions Légales</h4>
                                                <p className="text-gray-600 dark:text-gray-400 text-[10px] leading-relaxed text-justify line-clamp-3 hover:line-clamp-none transition-all">{companySettings.societe.piedPage.mentionsLegales}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                    </div>
                )}

                {/* Empty State */}
                {!companySettings && !loading && (
                    <div className="text-center py-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                            <BuildingOfficeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-gray-900 dark:text-white">Aucune info</h3>
                        <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-3">
                            Configurez votre entreprise.
                        </p>
                        <Link href="/settings" className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors">
                            Paramètres
                        </Link>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
