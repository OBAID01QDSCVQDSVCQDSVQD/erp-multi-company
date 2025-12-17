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
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import toast from 'react-hot-toast';

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
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
            <p className="text-gray-500 animate-pulse">Chargement de votre tableau de bord...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50/50 pb-12">
        <DashboardHeader
          userName={session?.user?.name}
          companyName={session?.user?.companyName}
        />

        {/* Pending Invoices Alert Banner */}
        {pendingSummary && pendingSummary.totalCount > 0 && (
          <div className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 rounded-lg p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Vous avez {pendingSummary.totalCount} facture(s) en attente de paiement
                  </h3>
                  <p className="text-sm text-gray-700 mt-1">
                    Montant total impayé: <span className="font-bold text-orange-600">
                      {formatCurrency(pendingSummary.totalPendingAmount)}
                    </span>
                  </p>
                </div>
              </div>
              <Link
                href="/pending-invoices"
                className="inline-flex items-center gap-2 bg-white text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors text-sm font-medium whitespace-nowrap border border-orange-200 shadow-sm"
              >
                Gérer les impayés
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                subtitle={`${formatNumber(data.stats.invoices.total)} au total`}
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
                subtitle="Produits en rupture"
                icon={ExclamationTriangleIcon}
                color={data.stats.lowStock.total > 0 ? "bg-amber-500" : "bg-gray-400"}
                changeType={data.stats.lowStock.total > 0 ? "negative" : "neutral"}
                delay={0.3}
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            {data?.charts && <RevenueChart data={data.charts.revenue} />}
          </div>
          <div className="lg:col-span-1">
            {data?.charts && <TopProductsChart data={data.charts.topProducts} />}
          </div>
        </div>

        {/* Secondary Stats */}
        {data?.stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center">
              <p className="text-gray-500 text-sm mb-1">Total Clients</p>
              <p className="text-xl font-bold text-gray-800">{formatNumber(data.stats.customers.total)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center">
              <p className="text-gray-500 text-sm mb-1">Total Fournisseurs</p>
              <p className="text-xl font-bold text-gray-800">{formatNumber(data.stats.suppliers.total)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center">
              <p className="text-gray-500 text-sm mb-1">Total Devis</p>
              <p className="text-xl font-bold text-gray-800">{formatNumber(data.stats.quotes.total)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center">
              <p className="text-gray-500 text-sm mb-1">Total Produits</p>
              <p className="text-xl font-bold text-gray-800">{formatNumber(data.stats.products.total)}</p>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {data && (
          <RecentActivity
            invoices={data.recent.invoices}
            payments={data.recent.payments}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
