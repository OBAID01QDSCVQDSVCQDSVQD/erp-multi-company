'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  HomeIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
  Bars3Icon,
  XMarkIcon,
  CurrencyEuroIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShoppingCartIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: HomeIcon },
  { name: 'Entreprises', href: '/companies', icon: BuildingOfficeIcon },
  { name: 'Utilisateurs', href: '/users', icon: UserGroupIcon },
  { name: 'Produits', href: '/products', icon: ShoppingBagIcon },
  { name: 'Clients', href: '/customers', icon: UserGroupIcon },
  { name: 'Fournisseurs', href: '/suppliers', icon: UserGroupIcon },
  { name: '💸 Dépenses', href: '/expenses', icon: CurrencyEuroIcon },
  { name: 'Documents', href: '#', icon: DocumentTextIcon, hasSubmenu: true, submenu: [
    { name: 'Devis', href: '/sales/quotes', icon: DocumentTextIcon },
    { name: 'Commandes', href: '/sales/orders', icon: ShoppingCartIcon },
    { name: 'Bons de livraison', href: '/sales/deliveries', icon: TruckIcon },
    { name: 'Factures', href: '/sales/invoices', icon: DocumentTextIcon },
    { name: 'Commandes d\'achat', href: '/purchases/orders', icon: ShoppingCartIcon },
    { name: 'Bons de réception', href: '/purchases/receipts', icon: ClipboardDocumentCheckIcon },
    { name: 'Factures fournisseurs', href: '/purchases/invoices', icon: DocumentTextIcon },
  ]},
  { name: 'Rapports', href: '/reports', icon: ChartBarIcon },
  { name: 'Paramètres', href: '/settings', icon: CogIcon },
];

const testPages = [
  { name: '🧪 Test Suggestions', href: '/test-suggestions', icon: CogIcon },
];

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <h1 className="text-xl font-bold text-gray-900">ERP Multi-Entreprises</h1>
            </div>
            <nav className="mt-5 px-2 space-y-1">
              {navigation.map((item) => {
                if (item.hasSubmenu && item.submenu) {
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => setDocumentsOpen(!documentsOpen)}
                        className="w-full flex items-center justify-between px-2 py-2 text-base font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      >
                        <div className="flex items-center">
                          <item.icon className="mr-4 flex-shrink-0 h-6 w-6 text-gray-400" />
                          {item.name}
                        </div>
                        {documentsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
                      </button>
                      {documentsOpen && (
                        <div className="ml-4 mt-1 space-y-1">
                          {item.submenu.map((subItem: any) => {
                            const isActive = pathname === subItem.href;
                            return (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                className={`${
                                  isActive
                                    ? 'bg-gray-100 text-gray-900'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                              >
                                <subItem.icon
                                  className={`${
                                    isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                                  } mr-3 flex-shrink-0 h-5 w-5`}
                                />
                                {subItem.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                  >
                    <item.icon
                      className={`${
                        isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                      } mr-4 flex-shrink-0 h-6 w-6`}
                    />
                    {item.name}
                  </Link>
                );
              })}
              
              {/* Pages de test */}
              <div className="pt-4 border-t border-gray-200">
                <div className="px-2 py-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tests
                  </h3>
                </div>
                {testPages.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`${
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-base font-medium rounded-md`}
                    >
                      <item.icon
                        className={`${
                          isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-4 flex-shrink-0 h-6 w-6`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="ml-3">
                <p className="text-base font-medium text-gray-700">{session?.user?.name}</p>
                <p className="text-sm font-medium text-gray-500">{session?.user?.companyName}</p>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Se déconnecter
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900">ERP Multi-Entreprises</h1>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1">
                {navigation.map((item) => {
                  if (item.hasSubmenu && item.submenu) {
                    return (
                      <div key={item.name}>
                        <button
                          onClick={() => setDocumentsOpen(!documentsOpen)}
                          className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        >
                          <div className="flex items-center">
                            <item.icon className="mr-3 flex-shrink-0 h-6 w-6 text-gray-400" />
                            {item.name}
                          </div>
                          {documentsOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
                        </button>
                        {documentsOpen && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.submenu.map((subItem: any) => {
                              const isActive = pathname === subItem.href;
                              return (
                                <Link
                                  key={subItem.name}
                                  href={subItem.href}
                                  className={`${
                                    isActive
                                      ? 'bg-gray-100 text-gray-900'
                                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                                >
                                  <subItem.icon
                                    className={`${
                                      isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                                    } mr-3 flex-shrink-0 h-5 w-5`}
                                  />
                                  {subItem.name}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`${
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                    >
                      <item.icon
                        className={`${
                          isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                        } mr-3 flex-shrink-0 h-6 w-6`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
                
                {/* Pages de test */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="px-2 py-1">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Tests
                    </h3>
                  </div>
                  {testPages.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`${
                          isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                      >
                        <item.icon
                          className={`${
                            isActive ? 'text-gray-500' : 'text-gray-400 group-hover:text-gray-500'
                          } mr-3 flex-shrink-0 h-6 w-6`}
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-700">{session?.user?.name}</p>
                  <p className="text-xs font-medium text-gray-500">{session?.user?.companyName}</p>
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Se déconnecter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
