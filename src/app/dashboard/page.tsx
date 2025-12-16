'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import {
  UserGroupIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  CurrencyEuroIcon,
  BanknotesIcon,
  TruckIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface DashboardStats {
  customers: { total: number; label: string };
  suppliers: { total: number; label: string };
  products: { total: number; label: string };
  invoices: { total: number; thisMonth: number; change: number; label: string };
  quotes: { total: number; label: string };
  deliveries: { total: number; label: string };
  purchaseInvoices: { total: number; thisMonth: number; change: number; label: string };
  revenue: { total: number; change: number; label: string };
  expenses: { total: number; change: number; label: string };
  customerPayments: { total: number; label: string };
  supplierPayments: { total: number; label: string };
  lowStock: { total: number; label: string };
}

interface RecentInvoice {
  id: string;
  numero: string;
  date: string;
  customer: string;
  total: number;
}

interface RecentPayment {
  id: string;
  numero: string;
  date: string;
  customer: string;
  montant: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [pendingSummary, setPendingSummary] = useState<{ totalCount: number; totalPendingAmount: number } | null>(null);

  // Redirect non-admin users to home page
  useEffect(() => {
    if (session?.user) {
      const userRole = session.user.role;
      const hasAllPermissions = session.user.permissions?.includes('all');
      
      if (userRole !== 'admin' && !hasAllPermissions) {
        router.push('/home');
      }
    }
  }, [session, router]);

  useEffect(() => {
    if (tenantId) {
      fetchDashboardData();
      fetchPendingSummary();
    }
  }, [tenantId]);

  const fetchPendingSummary = async () => {
    try {
      const response = await fetch('/api/pending-invoices', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching pending summary:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dashboard/stats', {
        headers: {
          'X-Tenant-Id': tenantId || '',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des données');
      }

      const data = await response.json();
      setStats(data.stats);
      setRecentInvoices(data.recent.invoices || []);
      setRecentPayments(data.recent.payments || []);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency: 'TND',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-TN').format(num);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return ArrowTrendingUpIcon;
    if (change < 0) return ArrowTrendingDownIcon;
    return ChartBarIcon;
  };

  const statCards = stats ? [
    {
      name: stats.revenue.label,
      value: formatCurrency(stats.revenue.total),
      change: `${stats.revenue.change >= 0 ? '+' : ''}${stats.revenue.change.toFixed(1)}%`,
      changeType: stats.revenue.change >= 0 ? 'positive' : 'negative',
      icon: CurrencyEuroIcon,
      color: 'bg-blue-500',
      link: '/sales/invoices',
    },
    {
      name: stats.invoices.label,
      value: formatNumber(stats.invoices.thisMonth),
      subtitle: `${formatNumber(stats.invoices.total)} au total`,
      change: `${stats.invoices.change >= 0 ? '+' : ''}${stats.invoices.change.toFixed(1)}%`,
      changeType: stats.invoices.change >= 0 ? 'positive' : 'negative',
      icon: DocumentTextIcon,
      color: 'bg-indigo-500',
      link: '/sales/invoices',
    },
    {
      name: stats.customers.label,
      value: formatNumber(stats.customers.total),
      icon: UserGroupIcon,
      color: 'bg-green-500',
      link: '/customers',
    },
    {
      name: stats.products.label,
      value: formatNumber(stats.products.total),
      icon: ShoppingBagIcon,
      color: 'bg-purple-500',
      link: '/products',
    },
    {
      name: stats.expenses.label,
      value: formatCurrency(stats.expenses.total),
      change: `${stats.expenses.change >= 0 ? '+' : ''}${stats.expenses.change.toFixed(1)}%`,
      changeType: stats.expenses.change >= 0 ? 'positive' : 'negative',
      icon: BanknotesIcon,
      color: 'bg-red-500',
      link: '/purchases/invoices',
    },
    {
      name: stats.lowStock.label,
      value: formatNumber(stats.lowStock.total),
      icon: ExclamationTriangleIcon,
      color: stats.lowStock.total > 0 ? 'bg-yellow-500' : 'bg-gray-400',
      link: '/stock/alerts',
      alert: stats.lowStock.total > 0,
    },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold">Tableau de bord</h1>
          <p className="mt-2 text-indigo-100">
            Bienvenue, <span className="font-semibold">{session?.user?.name}</span> - {session?.user?.companyName}
          </p>
        </div>

        {/* Pending Invoices Alert Banner */}
        {pendingSummary && pendingSummary.totalCount > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Vous avez {pendingSummary.totalCount} facture(s) en attente de paiement
                  </h3>
                  <p className="text-sm text-gray-700 mt-1">
                    Montant total impayé: <span className="font-bold text-orange-600">
                      {new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'TND',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 3,
                      }).format(pendingSummary.totalPendingAmount)}
                    </span>
                  </p>
                </div>
              </div>
              <Link
                href="/pending-invoices"
                className="inline-flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium whitespace-nowrap"
              >
                Voir les factures en attente
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {statCards.map((card) => {
                const ChangeIcon = card.change ? getChangeIcon(parseFloat(card.change.replace('%', '').replace('+', ''))) : null;
                return (
                  <Link
                    key={card.name}
                    href={card.link || '#'}
                    className="block"
                  >
                    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-200 overflow-hidden border-l-4 border-l-transparent hover:border-l-indigo-500">
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-600 mb-1">
                              {card.name}
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                              {card.value}
                            </p>
                            {card.subtitle && (
                              <p className="text-xs text-gray-500 mt-1">
                                {card.subtitle}
                              </p>
                            )}
                            {card.change && ChangeIcon && (
                              <div className={`flex items-center mt-2 text-sm font-semibold ${getChangeColor(parseFloat(card.change.replace('%', '').replace('+', '')))}`}>
                                <ChangeIcon className="h-4 w-4 mr-1" />
                                {card.change}
                                <span className="text-gray-500 ml-1">vs mois dernier</span>
                              </div>
                            )}
                          </div>
                          <div className={`${card.color} rounded-lg p-3`}>
                            <card.icon className="h-6 w-6 text-white" />
                          </div>
                        </div>
                        {card.alert && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-yellow-600 font-medium">
                              ⚠️ Action requise
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Additional Stats Row */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <TruckIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Devis</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(stats.quotes.total)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <TruckIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Bons de livraison</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(stats.deliveries.total)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <UserGroupIcon className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Fournisseurs</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(stats.suppliers.total)}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <BanknotesIcon className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Paiements clients</p>
                  <p className="text-xl font-bold text-gray-900">{formatNumber(stats.customerPayments.total)}</p>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Invoices */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-500" />
                    Factures récentes
                  </h3>
                  <Link
                    href="/sales/invoices"
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Voir tout →
                  </Link>
                </div>
                <div className="p-6">
                  {recentInvoices.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Aucune facture récente
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {recentInvoices.map((invoice) => (
                        <Link
                          key={invoice.id}
                          href={`/sales/invoices/${invoice.id}`}
                          className="block p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="font-semibold text-gray-900">
                                  {invoice.numero}
                                </span>
                                <span className="ml-2 text-sm text-gray-500">
                                  {invoice.customer}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(invoice.date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(invoice.total)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Payments */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <BanknotesIcon className="h-5 w-5 mr-2 text-green-500" />
                    Paiements récents
                  </h3>
                  <Link
                    href="/sales/payments"
                    className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Voir tout →
                  </Link>
                </div>
                <div className="p-6">
                  {recentPayments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Aucun paiement récent
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {recentPayments.map((payment) => (
                        <Link
                          key={payment.id}
                          href={`/sales/payments/${payment.id}`}
                          className="block p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="font-semibold text-gray-900">
                                  {payment.numero}
                                </span>
                                <span className="ml-2 text-sm text-gray-500">
                                  {payment.customer}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDate(payment.date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600">
                                {formatCurrency(payment.montant)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
