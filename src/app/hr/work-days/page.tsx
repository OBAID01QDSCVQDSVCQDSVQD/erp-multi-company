'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  ChartBarIcon,
  MagnifyingGlassIcon,
  UserIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface WorkDaysData {
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  employeeDepartment: string;
  totalDays: number;
  workedDays: number;
  absentDays: number;
  leaveDays: number;
  details: {
    date: string;
    status: 'present' | 'absent' | 'late' | 'on_leave';
  }[];
}

export default function WorkDaysPage() {
  const { tenantId } = useTenantId();
  const [workDays, setWorkDays] = useState<WorkDaysData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  const [year, month] = selectedMonth.split('-').map(Number);

  useEffect(() => {
    if (tenantId) {
      fetchWorkDays();
    }
  }, [tenantId, selectedMonth]);

  const fetchWorkDays = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/attendance?month=${selectedMonth}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Get unique employees
        const employeesMap = new Map<string, any>();
        
        (data.items || []).forEach((record: any) => {
          const empId = typeof record.employeeId === 'object' && record.employeeId?._id
            ? record.employeeId._id.toString()
            : record.employeeId.toString();
          
          if (!employeesMap.has(empId)) {
            employeesMap.set(empId, {
              employeeId: empId,
              employeeName: typeof record.employeeId === 'object' && record.employeeId
                ? `${record.employeeId.firstName} ${record.employeeId.lastName}`
                : 'Unknown',
              employeePosition: typeof record.employeeId === 'object' && record.employeeId
                ? record.employeeId.position || ''
                : '',
              employeeDepartment: typeof record.employeeId === 'object' && record.employeeId
                ? record.employeeId.department || ''
                : '',
              totalDays: 0,
              workedDays: 0,
              absentDays: 0,
              leaveDays: 0,
              details: [],
            });
          }
        });

        // Calculate days for each employee
        (data.items || []).forEach((record: any) => {
          const empId = typeof record.employeeId === 'object' && record.employeeId?._id
            ? record.employeeId._id.toString()
            : record.employeeId.toString();
          
          const employee = employeesMap.get(empId);
          if (employee) {
            employee.totalDays += 1;
            if (record.status === 'present' || record.status === 'late') {
              employee.workedDays += 1;
            } else if (record.status === 'absent') {
              employee.absentDays += 1;
            } else if (record.status === 'on_leave') {
              employee.leaveDays += 1;
            }
            employee.details.push({
              date: record.date,
              status: record.status,
            });
          }
        });

        // Calculate total days in month
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Update total days and calculate absent days for days without records
        employeesMap.forEach((employee) => {
          employee.totalDays = daysInMonth;
          const daysWithRecords = employee.workedDays + employee.absentDays + employee.leaveDays;
          employee.absentDays += (daysInMonth - daysWithRecords);
        });

        setWorkDays(Array.from(employeesMap.values()));
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors du chargement des données');
      }
    } catch (error) {
      console.error('Error fetching work days:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getMonthName = (month: number) => {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[month - 1];
  };

  // Filtered work days
  const filteredWorkDays = useMemo(() => {
    return workDays.filter(emp => {
      const matchesSearch = emp.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.employeePosition.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDepartment = filterDepartment === 'all' || emp.employeeDepartment === filterDepartment;
      
      return matchesSearch && matchesDepartment;
    });
  }, [workDays, searchQuery, filterDepartment]);

  // Statistics
  const stats = useMemo(() => {
    const totalDays = filteredWorkDays.reduce((sum, emp) => sum + emp.totalDays, 0);
    const totalWorkedDays = filteredWorkDays.reduce((sum, emp) => sum + emp.workedDays, 0);
    const totalAbsentDays = filteredWorkDays.reduce((sum, emp) => sum + emp.absentDays, 0);
    const totalLeaveDays = filteredWorkDays.reduce((sum, emp) => sum + emp.leaveDays, 0);
    const averageWorkedDays = filteredWorkDays.length > 0 ? totalWorkedDays / filteredWorkDays.length : 0;
    
    return {
      totalDays,
      totalWorkedDays,
      totalAbsentDays,
      totalLeaveDays,
      averageWorkedDays,
    };
  }, [filteredWorkDays]);

  // Unique departments
  const departments = useMemo(() => {
    const depts = new Set(workDays.map(emp => emp.employeeDepartment));
    return Array.from(depts).sort();
  }, [workDays]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Jours de travail</h1>
            <p className="mt-1 text-sm text-gray-600">
              Suivez les jours travaillés par vos employés - {getMonthName(month)} {year}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
            />
            <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base">
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Exporter</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Jours totaux</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalDays}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Jours travaillés</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">{stats.totalWorkedDays}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Jours d'absence</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-red-600">{stats.totalAbsentDays}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Jours de congé</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600">{stats.totalLeaveDays}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Moyenne/jour</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
                  {stats.averageWorkedDays.toFixed(1)}j
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou poste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Work Days Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : filteredWorkDays.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune donnée</h3>
              <p className="text-gray-600">Aucune donnée de jours de travail pour cette période</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employé</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Département</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Jours travaillés</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Jours d'absence</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Jours de congé</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total jours</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredWorkDays.map((employee) => (
                    <tr key={employee.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold">
                            {employee.employeeName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{employee.employeeName}</div>
                            <div className="text-xs text-gray-500">{employee.employeePosition}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                        {employee.employeeDepartment}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                        {employee.workedDays}j
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-red-600">
                        {employee.absentDays}j
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-blue-600">
                        {employee.leaveDays}j
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                        {employee.totalDays}j
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900">Détails</button>
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

