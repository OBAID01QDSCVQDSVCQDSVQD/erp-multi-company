'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Salary {
  _id: string;
  employeeId: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeNumber?: string;
    position: string;
    department: string;
    baseSalary?: number;
    currency: string;
    paymentMethod: string;
  };
  period: {
    month: number;
    year: number;
    startDate: string;
    endDate: string;
  };
  baseSalary: number;
  currency: string;
  totalDays: number;
  workedDays: number;
  absentDays: number;
  leaveDays: number;
  dailyRate: number;
  earnings: {
    baseSalary: number;
    overtimePay: number;
    bonuses: number;
    allowances: number;
    otherEarnings: number;
    totalEarnings: number;
  };
  deductions: {
    taxes: number;
    socialSecurity: number;
    insurance: number;
    advances: number;
    otherDeductions: number;
    totalDeductions: number;
  };
  netSalary: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'partial' | 'owing' | 'cancelled';
  paymentDate?: string;
  notes?: string;
  deductionsEnabled?: boolean;
}

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string;
  position: string;
  department: string;
  baseSalary?: number;
  currency: string;
  paymentMethod: string;
}

export default function SalariesPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [enableDeductions, setEnableDeductions] = useState(false);

  const [year, month] = selectedMonth.split('-').map(Number);

  useEffect(() => {
    if (tenantId) {
      fetchSalaries();
      fetchEmployees();
    }
  }, [tenantId, selectedMonth]);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/salaries?month=${month}&year=${year}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setSalaries(data.items || []);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors du chargement des salaires');
      }
    } catch (error) {
      console.error('Error fetching salaries:', error);
      toast.error('Erreur lors du chargement des salaires');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/hr/employees', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setEmployees(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCreateSalary = async () => {
    if (!selectedEmployee) {
      toast.error('Veuillez sélectionner un employé');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/hr/salaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          month,
          year,
          enableDeductions,
        })
      });

      if (response.ok) {
        toast.success('Salaire créé avec succès');
        setShowCreateModal(false);
        setSelectedEmployee('');
        setEnableDeductions(false);
        fetchSalaries();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la création du salaire');
      }
    } catch (error) {
      console.error('Error creating salary:', error);
      toast.error('Erreur lors de la création du salaire');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSalary = async (salaryId: string, employeeName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le salaire de ${employeeName} ?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/hr/salaries/${salaryId}`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-Id': tenantId || ''
        }
      });

      if (response.ok) {
        toast.success('Salaire supprimé avec succès');
        fetchSalaries();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression du salaire');
      }
    } catch (error) {
      console.error('Error deleting salary:', error);
      toast.error('Erreur lors de la suppression du salaire');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string = 'TND') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
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

  // Filtered salaries
  const filteredSalaries = useMemo(() => {
    return salaries.filter(salary => {
      const employeeName = `${salary.employeeId.firstName} ${salary.employeeId.lastName}`.toLowerCase();
      const matchesSearch = employeeName.includes(searchQuery.toLowerCase()) ||
        salary.employeeId.employeeNumber?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment = filterDepartment === 'all' || salary.employeeId.department === filterDepartment;
      const matchesStatus = filterStatus === 'all' || salary.paymentStatus === filterStatus;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [salaries, searchQuery, filterDepartment, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const totalSalary = filteredSalaries.reduce((sum, s) => sum + s.netSalary, 0);
    const averageSalary = filteredSalaries.length > 0 ? totalSalary / filteredSalaries.length : 0;
    const paidCount = filteredSalaries.filter(s => s.paymentStatus === 'paid').length;

    return {
      totalSalary,
      averageSalary,
      count: filteredSalaries.length,
      paidCount,
    };
  }, [filteredSalaries]);

  // Unique departments
  const departments = useMemo(() => {
    const depts = new Set(salaries.map(s => s.employeeId.department));
    return Array.from(depts).sort();
  }, [salaries]);

  // Employees without salary for current period
  const employeesWithoutSalary = useMemo(() => {
    const salaryEmployeeIds = new Set(salaries.map(s => s.employeeId._id));
    return employees.filter(emp => !salaryEmployeeIds.has(emp._id));
  }, [employees, salaries]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Salaires</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Gestion des salaires - {getMonthName(month)} {year}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarIcon className="w-5 h-5 text-gray-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Nouveau salaire</span>
            </button>
            <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base">
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Exporter</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Masse salariale</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(stats.totalSalary)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Salaire moyen</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(stats.averageSalary)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Fiches de paie</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {stats.count}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <ArrowDownTrayIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Payées</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {stats.paidCount} / {stats.count}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom ou numéro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="all">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="partial">Paiement partiel</option>
                <option value="owing">Montant dû</option>
                <option value="paid">Payé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
        </div>

        {/* Salaries Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border dark:border-gray-700">
          {loading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4 p-4 items-center border-b dark:border-gray-700 last:border-0">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredSalaries.length === 0 ? (
            <div className="p-12 text-center">
              <CurrencyDollarIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun salaire trouvé</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {salaries.length === 0
                  ? 'Aucune donnée de salaire pour cette période'
                  : 'Aucun résultat ne correspond à vos filtres'}
              </p>
              {salaries.length === 0 && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Créer un salaire
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Employé</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Jours</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Gains</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Déductions</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Net</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSalaries.map((salary) => (
                    <tr key={salary._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {salary.employeeId.firstName} {salary.employeeId.lastName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {salary.employeeId.position} • {salary.employeeId.department}
                            {salary.employeeId.employeeNumber && ` • ${salary.employeeId.employeeNumber}`}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900 dark:text-white">
                        <div className="flex items-center justify-center gap-1">
                          <CalendarIcon className="w-4 h-4 text-gray-400" />
                          <span>{salary.workedDays}j</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {salary.totalDays}j total
                        </div>
                        {salary.absentDays > 0 && (
                          <div className="text-xs text-red-600 dark:text-red-400">
                            {salary.absentDays}j abs
                          </div>
                        )}
                        {salary.leaveDays > 0 && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            {salary.leaveDays}j congé
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                        <div>{formatPrice(salary.earnings.totalEarnings, salary.currency)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Base: {formatPrice(salary.earnings.baseSalary, salary.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                        <div>{formatPrice(salary.deductions.totalDeductions, salary.currency)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Taxes: {formatPrice(salary.deductions.taxes, salary.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatPrice(salary.netSalary, salary.currency)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {salary.paymentStatus === 'paid' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:text-green-300 dark:bg-green-900/40">
                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                            Payé
                          </span>
                        ) : salary.paymentStatus === 'partial' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:text-blue-300 dark:bg-blue-900/40">
                            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                            Paiement partiel
                          </span>
                        ) : salary.paymentStatus === 'owing' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:text-orange-300 dark:bg-orange-900/40">
                            <CurrencyDollarIcon className="w-4 h-4 mr-1" />
                            Montant dû
                          </span>
                        ) : salary.paymentStatus === 'cancelled' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:text-red-300 dark:bg-red-900/40">
                            <XCircleIcon className="w-4 h-4 mr-1" />
                            Annulé
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:text-yellow-300 dark:bg-yellow-900/40">
                            <ClockIcon className="w-4 h-4 mr-1" />
                            En attente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => router.push(`/hr/salaries/${salary._id}`)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          >
                            Voir
                          </button>
                          <button
                            onClick={() => handleDeleteSalary(
                              salary._id,
                              `${salary.employeeId.firstName} ${salary.employeeId.lastName}`
                            )}
                            disabled={loading}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Salary Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Créer un salaire</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Employé
                  </label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="">Sélectionner un employé</option>
                    {employeesWithoutSalary.map(emp => (
                      <option key={emp._id} value={emp._id}>
                        {emp.firstName} {emp.lastName} - {emp.position} ({emp.department})
                      </option>
                    ))}
                  </select>
                  {employeesWithoutSalary.length === 0 && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Tous les employés ont déjà un salaire pour cette période
                    </p>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Période:</strong> {getMonthName(month)} {year}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                    Le salaire sera calculé automatiquement en fonction des heures de travail enregistrées.
                  </p>
                </div>

                <div className="flex items-start gap-3 p-3 border dark:border-gray-600 rounded-lg">
                  <input
                    id="enableDeductions"
                    type="checkbox"
                    checked={enableDeductions}
                    onChange={(e) => setEnableDeductions(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                  <div>
                    <label htmlFor="enableDeductions" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Activer les déductions automatiques
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Applique 10% d'impôts et 9% de sécurité sociale sur les gains. Désactivé par défaut.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedEmployee('');
                    setEnableDeductions(false);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateSalary}
                  disabled={loading || !selectedEmployee || employeesWithoutSalary.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Création...' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
