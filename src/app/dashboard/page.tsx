'use client';

import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CurrencyEuroIcon,
} from '@heroicons/react/24/outline';

const stats = [
  {
    name: 'Entreprises',
    value: '12',
    change: '+2',
    changeType: 'positive',
    icon: BuildingOfficeIcon,
  },
  {
    name: 'Utilisateurs',
    value: '45',
    change: '+5',
    changeType: 'positive',
    icon: UserGroupIcon,
  },
  {
    name: 'Produits',
    value: '1,234',
    change: '+12%',
    changeType: 'positive',
    icon: ShoppingBagIcon,
  },
  {
    name: 'Factures ce mois',
    value: '89',
    change: '+18%',
    changeType: 'positive',
    icon: DocumentTextIcon,
  },
  {
    name: 'Chiffre d\'affaires',
    value: '€45,678',
    change: '+23%',
    changeType: 'positive',
    icon: CurrencyEuroIcon,
  },
  {
    name: 'Clients actifs',
    value: '234',
    change: '+8%',
    changeType: 'positive',
    icon: UserGroupIcon,
  },
];

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Tableau de bord
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Bienvenue, {session?.user?.name} - {session?.user?.companyName}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.name}
              className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden"
            >
              <dt>
                <div className="absolute bg-indigo-500 rounded-md p-3">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <p className="ml-16 text-sm font-medium text-gray-500 truncate">
                  {item.name}
                </p>
              </dt>
              <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">
                  {item.value}
                </p>
                <p
                  className={`ml-2 flex items-baseline text-sm font-semibold ${
                    item.changeType === 'positive'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {item.change}
                </p>
              </dd>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Activité récente
            </h3>
            <div className="mt-5">
              <div className="flow-root">
                <ul className="-mb-8">
                  <li>
                    <div className="relative pb-8">
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center ring-8 ring-white">
                            <DocumentTextIcon className="w-5 h-5 text-white" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Nouvelle facture <span className="font-medium text-gray-900">#F-2024-001</span> créée
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            <time>Il y a 2 heures</time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li>
                    <div className="relative pb-8">
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                            <UserGroupIcon className="w-5 h-5 text-white" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Nouveau client <span className="font-medium text-gray-900">ABC Company</span> ajouté
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            <time>Il y a 4 heures</time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                  <li>
                    <div className="relative">
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center ring-8 ring-white">
                            <ShoppingBagIcon className="w-5 h-5 text-white" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-500">
                              Stock mis à jour pour <span className="font-medium text-gray-900">Produit XYZ</span>
                            </p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            <time>Il y a 6 heures</time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
