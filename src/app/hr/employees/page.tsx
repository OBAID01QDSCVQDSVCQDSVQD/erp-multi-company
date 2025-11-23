'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, UserIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  department: string;
  hireDate: string;
  status: 'active' | 'inactive' | 'on_leave';
  salary?: number;
}

export default function EmployeesPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (tenantId) {
      fetchEmployees();
    }
  }, [tenantId]);

  const fetchEmployees = async () => {
    try {
      if (!tenantId) return;
      
      setLoading(true);
      const response = await fetch(`/api/hr/employees`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.items || []);
      } else {
        const error = await response.json();
        console.error('Error fetching employees:', error);
        toast.error(error.error || 'Erreur lors du chargement des employés');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Erreur lors du chargement des employés');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      on_leave: 'bg-yellow-100 text-yellow-800',
    };
    const labels = {
      active: 'Actif',
      inactive: 'Inactif',
      on_leave: 'En congé',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.inactive}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const handleView = (employeeId: string) => {
    router.push(`/hr/employees/${employeeId}`);
  };

  const handleEdit = (employeeId: string) => {
    router.push(`/hr/employees/${employeeId}/edit`);
  };

  const handleDelete = async (employeeId: string, employeeName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'employé ${employeeName} ?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/hr/employees/${employeeId}`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-Id': tenantId || ''
        }
      });

      if (response.ok) {
        toast.success('Employé supprimé avec succès');
        fetchEmployees();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Erreur lors de la suppression');
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Liste des employés</h1>
            <p className="mt-1 text-sm text-gray-600">Gérez vos employés et leurs informations</p>
          </div>
          <button
            onClick={() => router.push('/hr/employees/new')}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Nouvel employé</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total employés</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{employees.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Actifs</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">
                  {employees.filter(e => e.status === 'active').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En congé</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-yellow-600">
                  {employees.filter(e => e.status === 'on_leave').length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Départements</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
                  {new Set(employees.map(e => e.department)).size}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, email, poste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              />
            </div>
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="inactive">Inactifs</option>
                <option value="on_leave">En congé</option>
              </select>
            </div>
          </div>
        </div>

        {/* Employees Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <UserIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun employé trouvé</h3>
              <p className="text-gray-600 mb-6">Commencez par ajouter votre premier employé</p>
              <button
                onClick={() => router.push('/hr/employees/new')}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="w-5 h-5" />
                Ajouter un employé
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Employé</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Poste</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Département</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date d'embauche</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {employee.firstName[0]}{employee.lastName[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {employee.firstName} {employee.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{employee.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{employee.position}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{employee.department}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(employee.hireDate).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(employee.status)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleView(employee._id)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Voir les détails"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(employee._id)}
                            className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(employee._id, `${employee.firstName} ${employee.lastName}`)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Supprimer"
                          >
                            <TrashIcon className="w-5 h-5" />
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
    </DashboardLayout>
  );
}

