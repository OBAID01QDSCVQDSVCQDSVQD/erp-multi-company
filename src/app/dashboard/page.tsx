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
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// New Components
import StatCard from '@/components/dashboard/StatCard';
import { RevenueChart, TopProductsChart } from '@/components/dashboard/Charts';
import RecentActivity from '@/components/dashboard/RecentActivity';
import DashboardHeader from '@/components/dashboard/DashboardHeader';

interface DashboardData {
  stats: {
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
  };
  charts: {
    revenue: { name: string; revenus: number; depenses: number }[];
    topProducts: { name: string; value: number }[];
  };
  recent: {
    invoices: any[];
    payments: any[];
  };
}

const DashboardSkeleton = () => (
  <div className="space-y-3 max-w-7xl mx-auto px-2 sm:px-4 py-3 animate-pulse">
    {/* Header Skeleton */}
    <div className="flex justify-between items-center mb-3">
      <div className="space-y-1">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
      </div>
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
    </div>

    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      ))}
    </div>

    {/* Charts Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
      <div className="lg:col-span-2 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="lg:col-span-1 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
    </div>

    {/* Recent Activity Skeleton */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      ))}
    </div>
  </div>
);

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [pendingSummary, setPendingSummary] = useState<{ totalCount: number; totalPendingAmount: number } | null>(null);

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

      const responseData = await response.json();
      setData(responseData);
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

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 pb-4">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3">
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-3"
          >
            <DashboardHeader
              userName={session?.user?.name}
              companyName={session?.user?.companyName}
            />
          </motion.div>

          {/* Pending Invoices Alert Banner */}
          {pendingSummary && pendingSummary.totalCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="mb-3 bg-white dark:bg-gray-800 border-l-2 border-orange-500 rounded-lg p-2 shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                      {pendingSummary.totalCount} factures en attente
                    </h3>
                    <p className="text-[10px] text-gray-600 dark:text-gray-300 leading-none mt-0.5">
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        {formatCurrency(pendingSummary.totalPendingAmount)}
                      </span> à recouvrer
                    </p>
                  </div>
                </div>
                <Link
                  href="/pending-invoices"
                  className="group inline-flex items-center gap-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded transition-colors font-medium text-[10px] whitespace-nowrap"
                >
                  Gérer
                  <ArrowRightIcon className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            {data?.stats && (
              <>
                <StatCard
                  name="Chiffre d'Affaires"
                  value={formatCurrency(data.stats.revenue.total)}
                  change={`${data.stats.revenue.change >= 0 ? '+' : ''}${data.stats.revenue.change}%`}
                  changeType={data.stats.revenue.change >= 0 ? 'positive' : 'negative'}
                  icon={CurrencyEuroIcon}
                  color="bg-blue-500"
                  delay={0}
                />
                <StatCard
                  name="Factures Clients"
                  value={formatNumber(data.stats.invoices.thisMonth)}
                  subtitle={`${formatNumber(data.stats.invoices.total)} total`}
                  change={`${data.stats.invoices.change >= 0 ? '+' : ''}${data.stats.invoices.change}%`}
                  changeType={data.stats.invoices.change >= 0 ? 'positive' : 'negative'}
                  icon={DocumentTextIcon}
                  color="bg-indigo-500"
                  delay={0.1}
                />
                <StatCard
                  name="Dépenses"
                  value={formatCurrency(data.stats.expenses.total)}
                  change={`${data.stats.expenses.change >= 0 ? '+' : ''}${data.stats.expenses.change}%`}
                  changeType={data.stats.expenses.change >= 0 ? 'positive' : 'negative'}
                  icon={BanknotesIcon}
                  color="bg-red-500"
                  delay={0.2}
                />
                <StatCard
                  name="Alerte Stock"
                  value={formatNumber(data.stats.lowStock.total)}
                  subtitle="En rupture"
                  icon={ExclamationTriangleIcon}
                  color={data.stats.lowStock.total > 0 ? "bg-amber-500" : "bg-emerald-500"}
                  changeType={data.stats.lowStock.total > 0 ? "negative" : "neutral"}
                  delay={0.3}
                />
              </>
            )}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-2"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 pl-1">
                  <ChartBarIcon className="w-3.5 h-3.5 text-indigo-500" />
                  Aperçu Financier
                </h3>
              </div>
              <div className="h-48">
                {data?.charts && <RevenueChart data={data.charts.revenue} />}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-2"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 pl-1">
                  <ShoppingBagIcon className="w-3.5 h-3.5 text-purple-500" />
                  Top Produits
                </h3>
              </div>
              <div className="h-48">
                {data?.charts && <TopProductsChart data={data.charts.topProducts} />}
              </div>
            </motion.div>
          </div>

          {/* Secondary Stats */}
          {data?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <motion.div whileHover={{ scale: 1.01 }} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-all hover:shadow cursor-default group">
                <UserGroupIcon className="w-4 h-4 text-blue-500 mx-auto mb-1 bg-blue-50 dark:bg-blue-900/20 p-0.5 rounded group-hover:scale-110 transition-transform" />
                <p className="text-gray-500 dark:text-gray-400 text-[9px] mb-0 font-medium uppercase tracking-wide leading-none">Clients</p>
                <p className="text-base font-bold text-gray-800 dark:text-white tracking-tight leading-none mt-0.5">{formatNumber(data.stats.customers.total)}</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.01 }} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-all hover:shadow cursor-default group">
                <UserGroupIcon className="w-4 h-4 text-indigo-500 mx-auto mb-1 bg-indigo-50 dark:bg-indigo-900/20 p-0.5 rounded group-hover:scale-110 transition-transform" />
                <p className="text-gray-500 dark:text-gray-400 text-[9px] mb-0 font-medium uppercase tracking-wide leading-none">Fournisseurs</p>
                <p className="text-base font-bold text-gray-800 dark:text-white tracking-tight leading-none mt-0.5">{formatNumber(data.stats.suppliers.total)}</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.01 }} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-all hover:shadow cursor-default group">
                <DocumentTextIcon className="w-4 h-4 text-amber-500 mx-auto mb-1 bg-amber-50 dark:bg-amber-900/20 p-0.5 rounded group-hover:scale-110 transition-transform" />
                <p className="text-gray-500 dark:text-gray-400 text-[9px] mb-0 font-medium uppercase tracking-wide leading-none">Devis</p>
                <p className="text-base font-bold text-gray-800 dark:text-white tracking-tight leading-none mt-0.5">{formatNumber(data.stats.quotes.total)}</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.01 }} className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center transition-all hover:shadow cursor-default group">
                <ShoppingBagIcon className="w-4 h-4 text-emerald-500 mx-auto mb-1 bg-emerald-50 dark:bg-emerald-900/20 p-0.5 rounded group-hover:scale-110 transition-transform" />
                <p className="text-gray-500 dark:text-gray-400 text-[9px] mb-0 font-medium uppercase tracking-wide leading-none">Produits</p>
                <p className="text-base font-bold text-gray-800 dark:text-white tracking-tight leading-none mt-0.5">{formatNumber(data.stats.products.total)}</p>
              </motion.div>
            </div>
          )}

          {/* Recent Activity */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <RecentActivity
                invoices={data.recent.invoices}
                payments={data.recent.payments}
              />
            </motion.div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
