'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
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
  ScaleIcon,
  ClipboardDocumentListIcon
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
import AuditTab from '@/components/settings/AuditTab';

const settingsGroups = [
  {
    title: 'Général',
    items: [
      { id: 'societe', name: 'Société', icon: BuildingOfficeIcon, component: SocieteTab },
      { id: 'securite', name: 'Sécurité', icon: ShieldCheckIcon, component: SecuriteTab },
      { id: 'audit', name: 'Journal d\'activité', icon: ClipboardDocumentListIcon, component: AuditTab, adminOnly: true },
      { id: 'systeme', name: 'Système', icon: ServerStackIcon, component: SystemeTab, adminOnly: true },
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
  const { data: session } = useSession();
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

  // Filter groups based on permission
  const filteredGroups = settingsGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if ((item as any).adminOnly) return session?.user?.role === 'admin';
      return true;
    })
  })).filter(group => group.items.length > 0);

  // Helper to find the active component
  const getActiveComponent = () => {
    for (const group of filteredGroups) {
      const found = group.items.find(item => item.id === activeTab);
      if (found) return found.component;
    }
    // Fallback if active tab is hidden or not found
    return filteredGroups[0]?.items[0]?.component || SocieteTab;
  };

  const ActiveComponent = getActiveComponent();

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {settingsGroups.flatMap(g => g.items).find(i => i.id === activeTab)?.name || 'Configuration'}
          </p>
        </div>

        {/* Horizontal Icon Navigation */}
        <div className="mb-2 overflow-x-auto pb-12 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center gap-4 min-w-max bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mx-auto w-fit">
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.title} className="flex items-center gap-2">
                {/* Separator between groups */}
                {groupIndex > 0 && (
                  <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2" />
                )}

                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      title={item.name}
                      className={`
                        relative group flex items-center justify-center p-3 rounded-lg transition-all duration-200
                        ${isActive
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-700'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200'
                        }
                      `}
                    >
                      <Icon className="h-6 w-6" />

                      {/* Tooltip */}
                      <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-100 dark:border-gray-700 min-h-[500px] transition-all duration-300">
          <div className="p-6">
            <ActiveComponent tenantId={tenantId} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}