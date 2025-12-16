'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import Link from 'next/link';
import {
  UserGroupIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  CurrencyEuroIcon,
  BanknotesIcon,
  TruckIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  ClockIcon,
  CalendarIcon,
  CalendarDaysIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  XCircleIcon,
  PlusIcon,
  CogIcon,
  ExclamationTriangleIcon,
  ArrowUturnLeftIcon,
  UserIcon,
} from '@heroicons/react/24/outline';

// Navigation structure matching Sidebar
const navigation = [
  { name: '💼 Ventes', href: '#', icon: ShoppingBagIcon, hasSubmenu: true, submenu: [
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
  { name: '📦 Achats', href: '#', icon: ShoppingCartIcon, hasSubmenu: true, submenu: [
    { name: 'Fournisseurs', href: '/suppliers', icon: UserGroupIcon, permission: 'suppliers' },
    { name: 'Commandes d\'achat', href: '/purchases/orders', icon: ShoppingCartIcon, permission: 'purchase_orders' },
    { name: 'Bons de réception', href: '/purchases/receipts', icon: ClipboardDocumentCheckIcon, permission: 'receipts' },
    { name: 'Factures fournisseurs', href: '/purchases/invoices', icon: DocumentTextIcon, permission: 'purchase_invoices' },
    { name: 'Paiements fournisseurs', href: '/purchases/payments', icon: BanknotesIcon, permission: 'supplier_payments' },
    { name: 'Soldes fournisseurs', href: '/suppliers/balances', icon: BanknotesIcon, permission: 'supplier_balances' },
  ]},
  { name: '🏭 Stock', href: '#', icon: CubeIcon, hasSubmenu: true, submenu: [
    { name: 'Inventaire', href: '/stock', icon: CubeIcon, permission: 'inventory' },
    { name: 'Produits / Articles', href: '/products', icon: ShoppingBagIcon, permission: 'products' },
    { name: 'Mouvements de stock', href: '/stock/movements', icon: TruckIcon, permission: 'stock_movements' },
    { name: 'Alertes stock minimum', href: '/stock/alerts', icon: ChartBarIcon, permission: 'stock_alerts' },
  ]},
  { name: 'Dépenses', href: '/expenses', icon: CurrencyEuroIcon, permission: 'expenses' },
  { name: '👥 Ressources humaines (RH)', href: '#', icon: UserGroupIcon, hasSubmenu: true, submenu: [
    { name: 'Liste des employés', href: '/hr/employees', icon: UserIcon, permission: 'employees' },
    { name: 'Présence / Pointage', href: '/hr/attendance', icon: ClockIcon, permission: 'attendance' },
    { name: 'Heures de travail', href: '/hr/work-hours', icon: CalendarIcon, permission: 'work_hours' },
    { name: 'Jours de travail', href: '/hr/work-days', icon: CalendarDaysIcon, permission: 'work_days' },
    { name: 'Affectation aux projets', href: '/hr/project-assignments', icon: BriefcaseIcon, permission: 'hr_project_assignments' },
    { name: 'Salaires', href: '/hr/salaries', icon: CurrencyDollarIcon, permission: 'salaries' },
    { name: 'Contrats', href: '/hr/contracts', icon: DocumentTextIcon, permission: 'hr_contracts' },
    { name: 'Absences & Congés', href: '/hr/absences', icon: XCircleIcon, permission: 'hr_absences' },
    { name: 'Performance', href: '/hr/performance', icon: ChartBarIcon, permission: 'hr_performance' },
  ]},
  { name: '📁 Projets', href: '#', icon: BriefcaseIcon, hasSubmenu: true, submenu: [
    { name: 'Liste des projets', href: '/projects', icon: BriefcaseIcon, permission: 'projects' },
    { name: 'Nouveau projet', href: '/projects/new', icon: PlusIcon, permission: 'projects' },
    { name: '🔖 Facture interne', href: '/internal-invoices', icon: DocumentTextIcon, permission: 'internal_invoices' },
  ]},
  { name: 'Rapports', href: '/reports', icon: ChartBarIcon, permission: 'reports' },
  { name: 'Paramètres', href: '/settings', icon: CogIcon, permission: 'settings' },
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [availableItems, setAvailableItems] = useState<any[]>([]);

  // Check if user has permission
  const hasPermission = (permission: string | null): boolean => {
    if (!permission) return false;
    if (!session?.user) return false;
    
    const userPermissions = session.user.permissions || [];
    const userRole = session.user.role;
    
    // Admin has all permissions
    if (userRole === 'admin' || userPermissions.includes('all')) {
      return true;
    }
    
    // Check if user has the specific permission
    return userPermissions.includes(permission);
  };

  // Redirect admin to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const userRole = session.user.role;
      if (userRole === 'admin' || session.user.permissions?.includes('all')) {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  // Filter navigation items based on permissions
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      const filtered: any[] = [];
      
      navigation.forEach((item) => {
        if (item.hasSubmenu && item.submenu) {
          // Filter submenu items
          const filteredSubmenu = item.submenu.filter((subItem: any) => 
            hasPermission(subItem.permission)
          );
          
          // Only add parent if it has at least one visible submenu item
          if (filteredSubmenu.length > 0) {
            filtered.push({
              ...item,
              submenu: filteredSubmenu,
            });
          }
        } else if (hasPermission(item.permission)) {
          // Direct link item
          filtered.push(item);
        }
      });
      
      setAvailableItems(filtered);
    }
  }, [status, session]);

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold">Accueil</h1>
          <p className="mt-2 text-indigo-100">
            Bienvenue, <span className="font-semibold">{session?.user?.name}</span> - {session?.user?.companyName}
          </p>
        </div>

        {/* Available Permissions Grid */}
        {availableItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 text-lg">
              Aucune permission disponible. Veuillez contacter l'administrateur.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableItems.flatMap((item) => {
              if (item.hasSubmenu && item.submenu) {
                // Render submenu items
                return item.submenu.map((subItem: any) => {
                  const Icon = subItem.icon;
                  return (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className="block"
                    >
                      <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden border-l-4 border-l-transparent hover:border-l-indigo-500 group">
                        <div className="p-6">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="bg-indigo-100 group-hover:bg-indigo-500 rounded-lg p-3 transition-colors">
                                <Icon className="h-6 w-6 text-indigo-600 group-hover:text-white transition-colors" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {subItem.name}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                });
              } else {
                // Render direct link item
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block"
                  >
                    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden border-l-4 border-l-transparent hover:border-l-indigo-500 group">
                      <div className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <div className="bg-indigo-100 group-hover:bg-indigo-500 rounded-lg p-3 transition-colors">
                              <Icon className="h-6 w-6 text-indigo-600 group-hover:text-white transition-colors" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.name}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

