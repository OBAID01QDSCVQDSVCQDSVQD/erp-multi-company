'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTenantId } from '@/hooks/useTenantId';
import Image from 'next/image';
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
  CreditCardIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
  CalendarIcon,
  CalendarDaysIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  XCircleIcon,
  UserIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Accueil', href: '/home', icon: SparklesIcon, permission: null }, // Visible to non-admin users only
  { name: 'Tableau de bord', href: '/dashboard', icon: HomeIcon, permission: null }, // Always visible
  { name: 'Entreprises', href: '/companies', icon: BuildingOfficeIcon, permission: 'settings' },
  { name: 'Utilisateurs', href: '/users', icon: UserGroupIcon, permission: 'users' },
  { name: 'Mon abonnement', href: '/subscriptions', icon: CreditCardIcon, permission: null }, // All users can see their own subscription
  { name: '💼 Ventes', href: '#', icon: ShoppingBagIcon, hasSubmenu: true, permission: null, submenu: [
    { name: 'Clients', href: '/customers', icon: UserGroupIcon, permission: 'customers' },
    { name: 'Devis', href: '/sales/quotes', icon: DocumentTextIcon, permission: 'quotes' },
    { name: 'Commandes clients', href: '/sales/orders', icon: ShoppingCartIcon, permission: 'sales_orders' },
    { name: 'Bons de livraison', href: '/sales/deliveries', icon: TruckIcon, permission: 'deliveries' },
    { name: 'Retours', href: '/sales/returns', icon: ArrowUturnLeftIcon, permission: 'deliveries' },
    { name: 'Factures clients', href: '/sales/invoices', icon: DocumentTextIcon, permission: 'sales_invoices' },
    { name: '⚠️ Factures en attente', href: '/pending-invoices', icon: ExclamationTriangleIcon, permission: 'sales_invoices' },
    { name: 'Avoirs clients', href: '/sales/credit-notes', icon: ArrowUturnLeftIcon, permission: 'sales_invoices' },
    { name: 'Paiements clients', href: '/sales/payments', icon: BanknotesIcon, permission: 'customer_payments' },
    { name: 'Soldes clients', href: '/customers/balances', icon: BanknotesIcon, permission: 'customer_balances' },
  ]},
  { name: '📦 Achats', href: '#', icon: ShoppingCartIcon, hasSubmenu: true, permission: null, submenu: [
    { name: 'Fournisseurs', href: '/suppliers', icon: UserGroupIcon, permission: 'suppliers' },
    { name: 'Commandes d\'achat', href: '/purchases/orders', icon: ShoppingCartIcon, permission: 'purchase_orders' },
    { name: 'Bons de réception', href: '/purchases/receipts', icon: ClipboardDocumentCheckIcon, permission: 'receipts' },
    { name: 'Factures fournisseurs', href: '/purchases/invoices', icon: DocumentTextIcon, permission: 'purchase_invoices' },
    { name: 'Paiements fournisseurs', href: '/purchases/payments', icon: BanknotesIcon, permission: 'supplier_payments' },
    { name: 'Soldes fournisseurs', href: '/suppliers/balances', icon: BanknotesIcon, permission: 'supplier_balances' },
  ]},
  { name: '🏭 Stock', href: '#', icon: CubeIcon, hasSubmenu: true, permission: null, submenu: [
    { name: 'Inventaire', href: '/stock', icon: CubeIcon, permission: 'inventory' },
    { name: 'Produits / Articles', href: '/products', icon: ShoppingBagIcon, permission: 'products' },
    { name: 'Mouvements de stock', href: '/stock/movements', icon: TruckIcon, permission: 'stock_movements' },
    { name: 'Alertes stock minimum', href: '/stock/alerts', icon: ChartBarIcon, permission: 'stock_alerts' },
  ]},
  { name: 'Dépenses', href: '/expenses', icon: CurrencyEuroIcon, permission: 'expenses' },
  { name: '👥 Ressources humaines (RH)', href: '#', icon: UserGroupIcon, hasSubmenu: true, permission: null, submenu: [
    { name: 'Liste des employés', href: '/hr/employees', icon: UserIcon, permission: 'employees' },
    { name: 'Présence / Pointage', href: '/hr/attendance', icon: ClockIcon, permission: 'attendance' },
    { name: 'Heures de travail', href: '/hr/work-hours', icon: CalendarIcon, permission: 'work_hours' },
    { name: 'Jours de travail', href: '/hr/work-days', icon: CalendarDaysIcon, permission: 'work_days' },
    { name: 'Salaires', href: '/hr/salaries', icon: CurrencyDollarIcon, permission: 'salaries' },
  ]},
  { name: '📁 Projets', href: '#', icon: BriefcaseIcon, hasSubmenu: true, permission: null, submenu: [
    { name: 'Liste des projets', href: '/projects', icon: BriefcaseIcon, permission: 'projects' },
    { name: 'Nouveau projet', href: '/projects/new', icon: PlusIcon, permission: 'projects' },
    { name: '🔖 Facture interne', href: '/internal-invoices', icon: DocumentTextIcon, permission: 'internal_invoices' },
  ]},
  { name: 'Rapports', href: '/reports', icon: ChartBarIcon, permission: 'reports' },
  { name: 'Paramètres', href: '/settings', icon: CogIcon, permission: 'settings' },
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
  const { tenantId } = useTenantId();
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Check if user has permission
  const hasPermission = (permission: string | null): boolean => {
    if (!permission) return true; // No permission required
    if (!session?.user) return false;
    
    const userPermissions = session.user.permissions || [];
    const userRole = session.user.role;
    
    // Admin has all permissions (including settings)
    if (userRole === 'admin' || userPermissions.includes('all')) {
      return true;
    }
    
    // Check if user has the specific permission
    return userPermissions.includes(permission);
  };

  // Filter navigation items based on permissions
  const getFilteredNavigation = () => {
    return navigation.filter((item) => {
      // "Accueil" should only be visible to non-admin users
      if (item.name === 'Accueil') {
        return session?.user?.role !== 'admin' && !session?.user?.permissions?.includes('all');
      }
      
      // "Tableau de bord" should only be visible to admin
      if (item.name === 'Tableau de bord') {
        return session?.user?.role === 'admin' || session?.user?.permissions?.includes('all');
      }
      
      // "Mon abonnement" should only be visible to admin
      if (item.name === 'Mon abonnement') {
        return session?.user?.role === 'admin' || session?.user?.permissions?.includes('all');
      }
      
      if (!hasPermission(item.permission)) {
        return false;
      }
      
      // If item has submenu, filter submenu items
      if (item.hasSubmenu && item.submenu) {
        const filteredSubmenu = item.submenu.filter((subItem: any) => 
          hasPermission(subItem.permission)
        );
        
        // Only show parent if it has at least one visible submenu item
        return filteredSubmenu.length > 0;
      }
      
      return true;
    }).map((item) => {
      // Filter submenu items
      if (item.hasSubmenu && item.submenu) {
        return {
          ...item,
          submenu: item.submenu.filter((subItem: any) => 
            hasPermission(subItem.permission)
          ),
        };
      }
      return item;
    });
  };

  const filteredNavigation = getFilteredNavigation();
  
  // Determine which submenus should be open based on current path
  const getOpenSubmenus = (currentPathname: string) => {
    const openMenus: { [key: string]: boolean } = {};
    filteredNavigation.forEach((item) => {
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

  // Fetch company settings for logo
  useEffect(() => {
    if (tenantId) {
      fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId },
      })
        .then((res) => res.json())
        .then((data) => setCompanySettings(data))
        .catch((err) => console.error('Error fetching company settings:', err));
    }
  }, [tenantId]);



  return (
    <>
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex flex-col max-w-xs w-full h-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-1 flex flex-col min-h-0 pt-5 pb-4 overflow-hidden">
            <div className="flex-shrink-0 flex items-center px-4 mb-4">
              {companySettings?.societe?.logoUrl ? (
                <div className="relative w-32 h-12 flex items-center">
                  <Image
                    src={companySettings.societe.logoUrl}
                    alt="Company Logo"
                    width={128}
                    height={48}
                    className="object-contain max-w-full max-h-full"
                    priority
                  />
                </div>
              ) : (
                <h1 className="text-xl font-bold text-gray-900">ERP Multi-Entreprises</h1>
              )}
            </div>
            <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
              {filteredNavigation.map((item) => {
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
                {companySettings?.societe?.logoUrl ? (
                  <div className="relative w-32 h-12 flex items-center">
                    <Image
                      src={companySettings.societe.logoUrl}
                      alt="Company Logo"
                      width={128}
                      height={48}
                      className="object-contain max-w-full max-h-full"
                      priority
                    />
                  </div>
                ) : (
                  <h1 className="text-xl font-bold text-gray-900">ERP Multi-Entreprises</h1>
                )}
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1">
                {filteredNavigation.map((item) => {
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
