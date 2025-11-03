'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { 
  BuildingOfficeIcon, 
  ShoppingCartIcon, 
  DocumentTextIcon, 
  CreditCardIcon, 
  CubeIcon, 
  ShieldCheckIcon, 
  CogIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline';

// Composants des onglets
import SocieteTab from '@/components/settings/SocieteTab';
import VentesAchatsTab from '@/components/settings/VentesAchatsTab';
import NumerotationTab from '@/components/settings/NumerotationTab';
import DepensesTab from '@/components/settings/DepensesTab';
import StockTab from '@/components/settings/StockTab';
import SecuriteTab from '@/components/settings/SecuriteTab';
import SystemeTab from '@/components/settings/SystemeTab';
import TVATab from '@/components/settings/TVATab';
import UnitsTab from '@/components/settings/UnitsTab';

const tabs = [
  { id: 'societe', name: 'Société', icon: BuildingOfficeIcon },
  { id: 'ventes-achats', name: 'Ventes & Achats', icon: ShoppingCartIcon },
  { id: 'tva', name: 'TVA', icon: CalculatorIcon },
  { id: 'numerotation', name: 'Numérotation', icon: DocumentTextIcon },
  { id: 'depenses', name: 'Dépenses', icon: CreditCardIcon },
  { id: 'stock', name: 'Stock', icon: CubeIcon },
  { id: 'securite', name: 'Sécurité', icon: ShieldCheckIcon },
  { id: 'systeme', name: 'Système', icon: CogIcon },
  { id: 'units', name: 'Unités', icon: CogIcon },
];

export default function SettingsPage() {
  const { tenantId } = useTenantId();
  const [activeTab, setActiveTab] = useState('societe');

  if (!tenantId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'societe':
        return <SocieteTab tenantId={tenantId} />;
      case 'ventes-achats':
        return <VentesAchatsTab tenantId={tenantId} />;
      case 'tva':
        return <TVATab tenantId={tenantId} />;
      case 'units':
        return <UnitsTab tenantId={tenantId} />;
      case 'numerotation':
        return <NumerotationTab tenantId={tenantId} />;
      case 'depenses':
        return <DepensesTab tenantId={tenantId} />;
      case 'stock':
        return <StockTab tenantId={tenantId} />;
      case 'securite':
        return <SecuriteTab tenantId={tenantId} />;
      case 'systeme':
        return <SystemeTab tenantId={tenantId} />;
      default:
        return <SocieteTab tenantId={tenantId} />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les paramètres de votre entreprise
          </p>
        </div>

        {/* Navigation des onglets */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Contenu des onglets */}
        <div className="mt-6">
          {renderTabContent()}
        </div>
      </div>
    </DashboardLayout>
  );
}