'use client';

import { useState, useEffect } from 'react';
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
  CubeIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: HomeIcon },
  { name: 'Entreprises', href: '/companies', icon: BuildingOfficeIcon },
  { name: 'Utilisateurs', href: '/users', icon: UserGroupIcon },
  { name: '💼 Ventes', href: '#', icon: ShoppingBagIcon, hasSubmenu: true, submenu: [
    { name: 'Clients', href: '/customers', icon: UserGroupIcon },
    { name: 'Devis', href: '/sales/quotes', icon: DocumentTextIcon },
    { name: 'Commandes clients', href: '/sales/orders', icon: ShoppingCartIcon },
    { name: 'Bons de livraison', href: '/sales/deliveries', icon: TruckIcon },
    { name: 'Factures clients', href: '/sales/invoices', icon: DocumentTextIcon },
    { name: 'Paiements clients', href: '/sales/payments', icon: BanknotesIcon },
    { name: 'Soldes clients', href: '/customers/balances', icon: BanknotesIcon },
  ]},
  { name: '📦 Achats', href: '#', icon: ShoppingCartIcon, hasSubmenu: true, submenu: [
    { name: 'Fournisseurs', href: '/suppliers', icon: UserGroupIcon },
    { name: 'Commandes d\'achat', href: '/purchases/orders', icon: ShoppingCartIcon },
    { name: 'Bons de réception', href: '/purchases/receipts', icon: ClipboardDocumentCheckIcon },
    { name: 'Factures fournisseurs', href: '/purchases/invoices', icon: DocumentTextIcon },
    { name: 'Paiements fournisseurs', href: '/purchases/payments', icon: BanknotesIcon },
    { name: 'Soldes fournisseurs', href: '/suppliers/balances', icon: BanknotesIcon },
  ]},
  { name: '🏭 Stock', href: '#', icon: CubeIcon, hasSubmenu: true, submenu: [
    { name: 'Inventaire', href: '/stock', icon: CubeIcon },
    { name: 'Produits / Articles', href: '/products', icon: ShoppingBagIcon },
    { name: 'Mouvements de stock', href: '/stock/movements', icon: TruckIcon },
    { name: 'Alertes stock minimum', href: '/stock/alerts', icon: ChartBarIcon },
  ]},
  { name: 'Dépenses', href: '/expenses', icon: CurrencyEuroIcon },
  { name: 'Rapports', href: '/reports', icon: ChartBarIcon },
  { name: 'Paramètres', href: '/settings', icon: CogIcon },
];

const testPages = [
  { name: '🧪 Test Suggestions', href: '/test-suggestions', icon: CogIcon },
];

interface SidebarProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

export default function Sidebar({ sidebarOpen: externalSidebarOpen, setSidebarOpen: externalSetSidebarOpen }: SidebarProps) {
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  
  // Determine which submenus should be open based on current path
  const getOpenSubmenus = (currentPathname: string) => {
    const openMenus: { [key: string]: boolean } = {};
    navigation.forEach((item) => {
      if (item.hasSubmenu && item.submenu) {
        const isActive = item.submenu.some((subItem: any) => 
          currentPathname === subItem.href || currentPathname.startsWith(subItem.href + '/')
        );
        openMenus[item.name] = isActive;
      }
    });
    return openMenus;
  };
  
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>(() => getOpenSubmenus(pathname));
  
  // Update open submenus when pathname changes
  useEffect(() => {
    const newOpenMenus = getOpenSubmenus(pathname);
    setOpenSubmenus(prev => {
      const updated = { ...prev };
      Object.keys(newOpenMenus).forEach(key => {
        if (newOpenMenus[key] && !updated[key]) {
          updated[key] = true;
        }
      });
      return updated;
    });
  }, [pathname]);
  
  const toggleSubmenu = (menuName: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  // Use external state if provided, otherwise use internal state
  const sidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : internalSidebarOpen;
  const setSidebarOpen = externalSetSidebarOpen || setInternalSidebarOpen;



  return (
    <>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
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
                  const isSubmenuOpen = openSubmenus[item.name] || false;
                  const isSubmenuActive = item.submenu.some((subItem: any) => 
                    pathname === subItem.href || pathname.startsWith(subItem.href + '/')
                  );
                  
                  return (
                    <div key={item.name}>
                      <button
                        onClick={() => toggleSubmenu(item.name)}
                        className={`w-full flex items-center justify-between px-2 py-2 text-base font-medium rounded-md ${
                          isSubmenuActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center">
                          <item.icon className={`mr-4 flex-shrink-0 h-6 w-6 ${isSubmenuActive ? 'text-gray-500' : 'text-gray-400'}`} />
                          {item.name}
                        </div>
                        {isSubmenuOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
                      </button>
                      {isSubmenuOpen && (
                        <div className="ml-4 mt-1 space-y-1">
                          {item.submenu.map((subItem: any) => {
                            const isActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
                            return (
                              <Link
                                key={subItem.name}
                                href={subItem.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`${
                                  isActive
                                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors`}
                              >
                                <subItem.icon
                                  className={`${
                                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
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
                
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors`}
                  >
                    <item.icon
                      className={`${
                        isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
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
                    const isSubmenuOpen = openSubmenus[item.name] || false;
                    const isSubmenuActive = item.submenu.some((subItem: any) => 
                      pathname === subItem.href || pathname.startsWith(subItem.href + '/')
                    );
                    
                    return (
                      <div key={item.name}>
                        <button
                          onClick={() => toggleSubmenu(item.name)}
                          className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md ${
                            isSubmenuActive
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <div className="flex items-center">
                            <item.icon className={`mr-3 flex-shrink-0 h-6 w-6 ${isSubmenuActive ? 'text-gray-500' : 'text-gray-400'}`} />
                            {item.name}
                          </div>
                          {isSubmenuOpen ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
                        </button>
                        {isSubmenuOpen && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.submenu.map((subItem: any) => {
                              const isActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
                              return (
                                <Link
                                  key={subItem.name}
                                  href={subItem.href}
                                  className={`${
                                    isActive
                                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors`}
                                >
                                  <subItem.icon
                                    className={`${
                                      isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
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
                  
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
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
