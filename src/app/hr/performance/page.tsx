'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ChartBarIcon, StarIcon, ArrowTrendingUpIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';

export default function PerformancePage() {
  const { tenantId } = useTenantId();
  const [performance, setPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('quarter');

  useEffect(() => {
    if (tenantId) {
      fetchPerformance();
    }
  }, [tenantId, period]);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      setPerformance([]);
    } catch (error) {
      console.error('Error fetching performance:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Performance</h1>
            <p className="mt-1 text-sm text-gray-600">Suivez et évaluez la performance de vos employés</p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
          >
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Note moyenne</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">0/10</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Top performers</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">0</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <StarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En progression</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-orange-600">0</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <ArrowTrendingUpIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Évaluations</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-purple-600">0</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Performance Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : (
            <div className="p-12 text-center">
              <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune donnée de performance</h3>
              <p className="text-gray-600">Les données de performance apparaîtront ici</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

