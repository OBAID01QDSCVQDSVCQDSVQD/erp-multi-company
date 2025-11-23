'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { 
  CalendarIcon, 
  ClockIcon, 
  ChartBarIcon,
  MagnifyingGlassIcon,
  UserIcon,
  FunnelIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface WorkHoursData {
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  totalHours: number;
  daysWorked: number;
  averageHoursPerDay: number;
  overtimeHours: number;
  regularHours: number;
  details: {
    date: string;
    hours: number;
    checkIn: string;
    checkOut: string;
  }[];
}

export default function WorkHoursPage() {
  const { tenantId } = useTenantId();
  const [workHours, setWorkHours] = useState<WorkHoursData[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  useEffect(() => {
    if (tenantId) {
      fetchWorkHours();
    }
  }, [tenantId, period]);

  const fetchWorkHours = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/work-hours?period=${period}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkHours(data.items || []);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors du chargement des données');
      }
    } catch (error) {
      console.error('Error fetching work hours:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = workHours.reduce((sum, emp) => sum + emp.totalHours, 0);
    const totalDays = workHours.reduce((sum, emp) => sum + emp.daysWorked, 0);
    const averagePerDay = totalDays > 0 ? total / totalDays : 0;
    const overtime = workHours.reduce((sum, emp) => sum + emp.overtimeHours, 0);
    
    return {
      total: total.toFixed(2),
      averagePerDay: averagePerDay.toFixed(2),
      overtime: overtime.toFixed(2),
    };
  }, [workHours]);

  // Filter work hours
  const filteredWorkHours = useMemo(() => {
    return workHours.filter(emp => {
      const matchesSearch = 
        emp.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeePosition.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = filterDepartment === 'all' || emp.employeeDepartment === filterDepartment;
      
      return matchesSearch && matchesDepartment;
    });
  }, [workHours, searchQuery, filterDepartment]);

  // Get departments list
  const departments = useMemo(() => {
    return Array.from(new Set(workHours.map(e => e.employeeDepartment))).filter(Boolean);
  }, [workHours]);

  // Format hours
  const formatHours = (hours: number) => {
    if (!hours || hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Heures de travail</h1>
            <p className="mt-1 text-sm text-gray-600">Suivez les heures travaillées par vos employés</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            >
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="quarter">Ce trimestre</option>
              <option value="year">Cette année</option>
            </select>
            <button className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base">
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Exporter</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Heures totales</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{formatHours(parseFloat(stats.total))}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Heures moyennes/jour</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{formatHours(parseFloat(stats.averagePerDay))}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CalendarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Heures supplémentaires</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-orange-600">{formatHours(parseFloat(stats.overtime))}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou poste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              >
                <option value="all">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Work Hours Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : filteredWorkHours.length === 0 ? (
            <div className="p-12 text-center">
              <ClockIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune donnée d'heures</h3>
              <p className="text-gray-600">Les heures de travail apparaîtront ici</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Département</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Jours travaillés</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Heures totales</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Moyenne/jour</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Heures régulières</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Heures supp.</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredWorkHours.map((employee) => (
                    <tr key={employee.employeeId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {employee.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.employeeName}
                            </div>
                            <div className="text-sm text-gray-500">{employee.employeePosition}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{employee.employeeDepartment}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">{employee.daysWorked}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">{formatHours(employee.totalHours)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">{formatHours(employee.averageHoursPerDay)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">{formatHours(employee.regularHours)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className={`text-sm font-medium ${employee.overtimeHours > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                          {formatHours(employee.overtimeHours)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
