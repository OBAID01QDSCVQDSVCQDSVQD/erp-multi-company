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
  CalculatorIcon,
  ServerStackIcon,
  ScaleIcon
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

const settingsGroups = [
  {
    title: 'Général',
    items: [
      { id: 'societe', name: 'Société', icon: BuildingOfficeIcon, component: SocieteTab },
      { id: 'securite', name: 'Sécurité', icon: ShieldCheckIcon, component: SecuriteTab },
      { id: 'systeme', name: 'Système', icon: ServerStackIcon, component: SystemeTab },
    ]
  },
  {
    title: 'Finance & Facturation',
    items: [
      { id: 'ventes-achats', name: 'Ventes & Achats', icon: ShoppingCartIcon, component: VentesAchatsTab },
      { id: 'tva', name: 'TVA & Taxes', icon: CalculatorIcon, component: TVATab },
      { id: 'numerotation', name: 'Numérotation', icon: DocumentTextIcon, component: NumerotationTab },
    ]
  },
  {
    title: 'Opérations',
    items: [
      { id: 'stock', name: 'Stock', icon: CubeIcon, component: StockTab },
      { id: 'units', name: 'Unités de mesure', icon: ScaleIcon, component: UnitsTab },
    ]
  }
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

  // Helper to find the active component
  const getActiveComponent = () => {
    for (const group of settingsGroups) {
      const found = group.items.find(item => item.id === activeTab);
      if (found) return found.component;
    }
    return SocieteTab;
  };

  const ActiveComponent = getActiveComponent();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les préférences et la configuration de votre entreprise.
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-3 mb-6 lg:mb-0">
            <nav className="space-y-8 sticky top-6">
              {settingsGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {group.title}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = activeTab === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`
                            group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-all duration-200
                            ${isActive
                              ? 'bg-indigo-50 text-indigo-700 shadow-sm border-l-4 border-indigo-600'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                            }
                          `}
                        >
                          <Icon
                            className={`
                              flex-shrink-0 -ml-1 mr-3 h-5 w-5 transition-colors
                              ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}
                            `}
                          />
                          <span className="truncate">{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-9">
            <div className="bg-white shadow rounded-xl border border-gray-100 min-h-[500px]">
              <div className="p-6">
                <ActiveComponent tenantId={tenantId} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </DashboardLayout>
  );
}