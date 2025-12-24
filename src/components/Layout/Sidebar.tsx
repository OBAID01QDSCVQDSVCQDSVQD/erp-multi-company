'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTenantId } from '@/hooks/useTenantId';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CogIcon,
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
  UserIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Accueil', href: '/home', icon: SparklesIcon, permission: null },
  { name: 'Tableau de bord', href: '/dashboard', icon: HomeIcon, permission: null },
  { name: 'Ma Société', href: '/my-company', icon: BuildingOfficeIcon, permission: 'settings' },
  { name: 'Utilisateurs', href: '/users', icon: UserGroupIcon, permission: 'users' },
  { name: 'Mon abonnement', href: '/subscriptions', icon: CreditCardIcon, permission: null },
  {
    name: '💼 Ventes', href: '#', icon: ShoppingBagIcon, hasSubmenu: true, permission: null, submenu: [
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
    ]
  },
  {
    name: '📦 Achats', href: '#', icon: ShoppingCartIcon, hasSubmenu: true, permission: null, submenu: [
      { name: 'Fournisseurs', href: '/suppliers', icon: UserGroupIcon, permission: 'suppliers' },
      { name: 'Commandes d\'achat', href: '/purchases/orders', icon: ShoppingCartIcon, permission: 'purchase_orders' },
      { name: 'Bons de réception', href: '/purchases/receipts', icon: ClipboardDocumentCheckIcon, permission: 'receipts' },
      { name: 'Retours achats', href: '/purchases/returns', icon: ArrowUturnLeftIcon, permission: 'receipts' },
      { name: 'Factures fournisseurs', href: '/purchases/invoices', icon: DocumentTextIcon, permission: 'purchase_invoices' },
      { name: 'Avoirs fournisseurs', href: '/purchases/credit-notes', icon: ArrowUturnLeftIcon, permission: 'purchase_invoices' },
      { name: 'Paiements fournisseurs', href: '/purchases/payments', icon: BanknotesIcon, permission: 'supplier_payments' },
      { name: 'Soldes fournisseurs', href: '/suppliers/balances', icon: BanknotesIcon, permission: 'supplier_balances' },
    ]
  },
  {
    name: '🏭 Stock', href: '#', icon: CubeIcon, hasSubmenu: true, permission: null, submenu: [
      { name: 'Inventaire', href: '/stock', icon: CubeIcon, permission: 'inventory' },
      { name: 'Produits / Articles', href: '/products', icon: ShoppingBagIcon, permission: 'products' },
      { name: 'Entrepôts', href: '/stock/warehouses', icon: BuildingOfficeIcon, permission: 'inventory' },
      { name: 'Transferts de stock', href: '/stock/transfers', icon: ArrowUturnLeftIcon, permission: 'stock_movements' },
      { name: 'Mouvements de stock', href: '/stock/movements', icon: TruckIcon, permission: 'stock_movements' },
      { name: 'Alertes stock minimum', href: '/stock/alerts', icon: ChartBarIcon, permission: 'stock_alerts' },
    ]
  },
  { name: 'Dépenses', href: '/expenses', icon: CurrencyEuroIcon, permission: 'expenses' },
  {
    name: '👥 Ressources Humaines', href: '#', icon: UserGroupIcon, hasSubmenu: true, permission: null, submenu: [
      { name: 'Liste des employés', href: '/hr/employees', icon: UserIcon, permission: 'employees' },
      { name: 'Présence / Pointage', href: '/hr/attendance', icon: ClockIcon, permission: 'attendance' },
      { name: 'Heures de travail', href: '/hr/work-hours', icon: CalendarIcon, permission: 'work_hours' },
      { name: 'Jours de travail', href: '/hr/work-days', icon: CalendarDaysIcon, permission: 'work_days' },
      { name: 'Salaires', href: '/hr/salaries', icon: CurrencyDollarIcon, permission: 'salaries' },
    ]
  },
  {
    name: '📁 Projets', href: '#', icon: BriefcaseIcon, hasSubmenu: true, permission: null, submenu: [
      { name: 'Liste des projets', href: '/projects', icon: BriefcaseIcon, permission: 'projects' },
      { name: 'Nouveau projet', href: '/projects/new', icon: PlusIcon, permission: 'projects' },
      { name: '🔖 Facture interne', href: '/internal-invoices', icon: DocumentTextIcon, permission: 'internal_invoices' },
    ]
  },
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

  const hasPermission = (permission: string | null): boolean => {
    if (!permission) return true;
    if (!session?.user) return false;
    const userPermissions = session.user.permissions || [];
    const userRole = session.user.role;
    if (userRole === 'admin' || userPermissions.includes('all')) return true;
    return userPermissions.includes(permission);
  };

  useEffect(() => {
    if (tenantId) {
      fetch('/api/settings', { headers: { 'X-Tenant-Id': tenantId } })
        .then((res) => res.json())
        .then((data) => setCompanySettings(data))
        .catch((err) => console.error('Error fetching company settings:', err));
    }
  }, [tenantId, pathname]);

  const hasMultiWarehouse = companySettings?.stock?.multiEntrepots === true;

  const getFilteredNavigation = () => {
    return navigation.filter((item) => {
      if (item.name === 'Accueil') return session?.user?.role !== 'admin' && !session?.user?.permissions?.includes('all');
      if (item.name === 'Tableau de bord') return session?.user?.role === 'admin' || session?.user?.permissions?.includes('all');
      if (item.name === 'Mon abonnement') return session?.user?.role === 'admin' || session?.user?.permissions?.includes('all');
      if (!hasPermission(item.permission)) return false;

      // Filter submenu items
      if (item.hasSubmenu && item.submenu) {
        let currentSubmenu = item.submenu;
        // Special logic for Stock submenu to hide multi-warehouse links
        if (item.name.includes('Stock') && !hasMultiWarehouse) {
          currentSubmenu = currentSubmenu.filter(sub =>
            sub.name !== 'Entrepôts' && sub.name !== 'Transferts de stock'
          );
        }

        const filteredSubmenu = currentSubmenu.filter((subItem: any) => hasPermission(subItem.permission));
        return filteredSubmenu.length > 0;
      }
      return true;
    }).map((item) => {
      // Map again to ensure submenu filtering persists in the returned object structure
      if (item.hasSubmenu && item.submenu) {
        let subItems = item.submenu;
        // Re-apply warehouse filter logic here to be safe if map runs on clone
        if (item.name.includes('Stock') && !hasMultiWarehouse) {
          subItems = subItems.filter((sub: any) => sub.name !== 'Entrepôts' && sub.name !== 'Transferts de stock');
        }
        return { ...item, submenu: subItems.filter((subItem: any) => hasPermission(subItem.permission)) };
      }
      return item;
    });
  };

  const filteredNavigation = getFilteredNavigation();

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

  useEffect(() => {
    const newOpenMenus = getOpenSubmenus(pathname);
    setOpenSubmenus(prev => {
      const updated = { ...prev };
      Object.keys(newOpenMenus).forEach(key => {
        if (newOpenMenus[key] && !updated[key]) updated[key] = true;
      });
      return updated;
    });
  }, [pathname]);

  const toggleSubmenu = (menuName: string) => {
    setOpenSubmenus(prev => {
      // Accordion behavior: Close all others when opening a new one
      // If clicking an already open menu (prev[menuName] is true), close it (return empty object or just don't include it)
      // If clicking a closed menu, open it (return object with only this menu true)
      return prev[menuName] ? {} : { [menuName]: true };
    });
  };

  const sidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : internalSidebarOpen;
  const setSidebarOpen = externalSetSidebarOpen || setInternalSidebarOpen;

  useEffect(() => {
    if (tenantId) {
      fetch('/api/settings', { headers: { 'X-Tenant-Id': tenantId } })
        .then((res) => res.json())
        .then((data) => setCompanySettings(data))
        .catch((err) => console.error('Error fetching company settings:', err));
    }
  }, [tenantId]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xl border-r border-gray-200 dark:border-gray-700">
      <div className="flex items-center flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 min-h-[80px]">
        {companySettings?.societe?.logoUrl ? (
          <div className="flex items-center gap-3 w-full">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden">
              <Image
                src={companySettings.societe.logoUrl}
                alt="Company Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white truncate leading-tight">
              {companySettings?.societe?.nom || session?.user?.companyName || 'ERP System'}
            </span>
          </div>
        ) : (
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text truncate">
            {session?.user?.companyName || 'ERP System'}
          </h1>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-600">
        {filteredNavigation.map((item) => {
          if (item.hasSubmenu && item.submenu) {
            const isSubmenuOpen = openSubmenus[item.name] || false;
            const isSubmenuActive = item.submenu.some((subItem: any) =>
              pathname === subItem.href || pathname.startsWith(subItem.href + '/')
            );

            return (
              <div key={item.name} className="overflow-hidden">
                <button
                  onClick={() => toggleSubmenu(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group ${isSubmenuActive
                    ? 'bg-gray-50 dark:bg-gray-700/50 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  <div className="flex items-center">
                    <item.icon className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors ${isSubmenuActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`} />
                    {item.name}
                  </div>
                  <ChevronDownIcon
                    className={`h-4 w-4 text-gray-400 transition-transform duration-300 ease-in-out ${isSubmenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isSubmenuOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-4 mt-1 pl-4 border-l border-gray-200 dark:border-gray-700 space-y-1 py-1">
                        {item.submenu.map((subItem: any) => {
                          const isActive = pathname === subItem.href || pathname.startsWith(subItem.href + '/');
                          return (
                            <Link
                              key={subItem.name}
                              href={subItem.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all ${isActive
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                            >
                              <subItem.icon
                                className={`mr-3 flex-shrink-0 h-4 w-4 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                                  }`}
                              />
                              {subItem.name}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
          return (
            <div key={item.name}>
              <Link
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <item.icon
                  className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                    }`}
                />
                {item.name}
              </Link>
            </div>
          );
        })}

        {/* Test Section */}
        <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Zone de Test
          </p>
          {testPages.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                <item.icon className="mr-3 flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-inner flex-shrink-0">
            {session?.user?.name?.charAt(0) || 'U'}
          </div>
          <div className="ml-3 min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{session?.user?.name}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate capitalize">
              {session?.user?.role === 'admin' ? 'Administrateur' : (session?.user?.role || 'Utilisateur')}
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="ml-2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Se déconnecter"
          >
            <ArrowUturnLeftIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="relative z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 flex w-full max-w-xs"
            >
              <div className="relative w-full flex-1">
                <div className="absolute top-0 right-0 -mr-12 pt-4">
                  <button
                    type="button"
                    className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <XMarkIcon className="h-6 w-6 text-white" />
                    <span className="sr-only">Fermer la barre latérale</span>
                  </button>
                </div>
                <SidebarContent />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-72">
          <SidebarContent />
        </div>
      </div>
    </>
  );
}
