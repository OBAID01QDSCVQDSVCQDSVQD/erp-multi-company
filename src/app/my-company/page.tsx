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
    CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';

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
                setError('Impossible de charger les informations de l\'entreprise');
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
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="sm:flex sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Ma Société</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Informations et détails de votre entreprise
                        </p>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Company Settings Display */}
                {companySettings?.societe && (
                    <div className="space-y-6">
                        {/* Company Header Card */}
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl overflow-hidden">
                            <div className="p-8">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-6">
                                        {/* Logo */}
                                        {companySettings.societe.logoUrl && (
                                            <div className="flex-shrink-0">
                                                <img
                                                    src={companySettings.societe.logoUrl}
                                                    alt="Company Logo"
                                                    className="h-24 w-24 rounded-2xl bg-white p-2 object-contain shadow-lg"
                                                />
                                            </div>
                                        )}

                                        {/* Company Info */}
                                        <div className="text-white">
                                            <h2 className="text-3xl font-bold mb-2">{companySettings.societe.nom}</h2>
                                            {companySettings.societe.enTete?.slogan && (
                                                <p className="text-lg text-indigo-100 italic mb-4">
                                                    {companySettings.societe.enTete.slogan}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <IdentificationIcon className="h-5 w-5" />
                                                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                                                        {companySettings.societe.tva || 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CreditCardIcon className="h-5 w-5" />
                                                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                                                        {companySettings.societe.devise}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                                        <CheckCircleIcon className="h-5 w-5 text-green-200" />
                                        <span className="text-white font-medium">Active</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Information Cards Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Address Card */}
                            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-50 rounded-lg">
                                        <MapPinIcon className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900">Adresse</h3>
                                </div>
                                <div className="space-y-2 text-sm text-gray-600">
                                    <p className="font-medium">{companySettings.societe.adresse.rue}</p>
                                    <p>{companySettings.societe.adresse.ville}, {companySettings.societe.adresse.codePostal}</p>
                                    <p className="text-gray-800 font-medium">{companySettings.societe.adresse.pays}</p>
                                </div>
                            </div>

                            {/* Contact Card */}
                            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-green-50 rounded-lg">
                                        <PhoneIcon className="h-6 w-6 text-green-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900">Contact</h3>
                                </div>
                                <div className="space-y-3 text-sm">
                                    {companySettings.societe.enTete?.telephone && (
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <PhoneIcon className="h-5 w-5 text-gray-400" />
                                            <span>{companySettings.societe.enTete.telephone}</span>
                                        </div>
                                    )}
                                    {companySettings.societe.enTete?.email && (
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                                            <span>{companySettings.societe.enTete.email}</span>
                                        </div>
                                    )}
                                    {companySettings.societe.enTete?.siteWeb && (
                                        <div className="flex items-center gap-3 text-gray-600">
                                            <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                                            <a href={companySettings.societe.enTete.siteWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                {companySettings.societe.enTete.siteWeb}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Legal Information */}
                            {(companySettings.societe.enTete?.matriculeFiscal ||
                                companySettings.societe.enTete?.registreCommerce ||
                                companySettings.societe.enTete?.capitalSocial) && (
                                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 bg-purple-50 rounded-lg">
                                                <IdentificationIcon className="h-6 w-6 text-purple-600" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-900">Informations légales</h3>
                                        </div>
                                        <div className="space-y-3 text-sm">
                                            {companySettings.societe.enTete?.matriculeFiscal && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 font-medium">Matricule fiscal:</span>
                                                    <span className="text-gray-900">{companySettings.societe.enTete.matriculeFiscal}</span>
                                                </div>
                                            )}
                                            {companySettings.societe.enTete?.registreCommerce && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 font-medium">Régistre de commerce:</span>
                                                    <span className="text-gray-900">{companySettings.societe.enTete.registreCommerce}</span>
                                                </div>
                                            )}
                                            {companySettings.societe.enTete?.capitalSocial && (
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600 font-medium">Capital social:</span>
                                                    <span className="text-gray-900">{companySettings.societe.enTete.capitalSocial}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                            {/* Banking Information */}
                            {companySettings.societe.piedPage?.coordonneesBancaires && (
                                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-orange-50 rounded-lg">
                                            <CreditCardIcon className="h-6 w-6 text-orange-600" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900">Coordonnées bancaires</h3>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        {companySettings.societe.piedPage.coordonneesBancaires.banque && (
                                            <div>
                                                <span className="text-gray-600 font-medium">Banque: </span>
                                                <span className="text-gray-900">{companySettings.societe.piedPage.coordonneesBancaires.banque}</span>
                                            </div>
                                        )}
                                        {companySettings.societe.piedPage.coordonneesBancaires.rib && (
                                            <div>
                                                <span className="text-gray-600 font-medium">RIB: </span>
                                                <span className="text-gray-900 font-mono">{companySettings.societe.piedPage.coordonneesBancaires.rib}</span>
                                            </div>
                                        )}
                                        {companySettings.societe.piedPage.coordonneesBancaires.swift && (
                                            <div>
                                                <span className="text-gray-600 font-medium">SWIFT: </span>
                                                <span className="text-gray-900 font-mono">{companySettings.societe.piedPage.coordonneesBancaires.swift}</span>
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
                                <div className="bg-gray-50 rounded-xl shadow-lg p-6 border border-gray-200">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations supplémentaires</h3>
                                    <div className="space-y-4 text-sm text-gray-600">
                                        {companySettings.societe.piedPage.texte && (
                                            <div>
                                                <p className="font-medium text-gray-800 mb-1">Texte personnalisé:</p>
                                                <p className="leading-relaxed">{companySettings.societe.piedPage.texte}</p>
                                            </div>
                                        )}
                                        {companySettings.societe.piedPage.conditionsGenerales && (
                                            <div>
                                                <p className="font-medium text-gray-800 mb-1">Conditions générales:</p>
                                                <p className="leading-relaxed">{companySettings.societe.piedPage.conditionsGenerales}</p>
                                            </div>
                                        )}
                                        {companySettings.societe.piedPage.mentionsLegales && (
                                            <div>
                                                <p className="font-medium text-gray-800 mb-1">Mentions légales:</p>
                                                <p className="leading-relaxed">{companySettings.societe.piedPage.mentionsLegales}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                    </div>
                )}

                {/* Empty State */}
                {!companySettings && !loading && (
                    <div className="text-center py-12 bg-white rounded-xl shadow-lg">
                        <BuildingOfficeIcon className="mx-auto h-16 w-16 text-gray-300" />
                        <h3 className="mt-4 text-lg font-medium text-gray-900">Aucune information disponible</h3>
                        <p className="mt-2 text-sm text-gray-500">
                            Configurez les informations de votre entreprise dans les paramètres.
                        </p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
