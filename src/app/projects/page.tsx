'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { 
  BriefcaseIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Project {
  _id: string;
  projectNumber: string;
  name: string;
  description?: string;
  customerId: {
    _id: string;
    nom?: string;
    prenom?: string;
    raisonSociale?: string;
  };
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  budget?: number;
  currency: string;
  totalCost: number;
  profit: number;
  profitMargin: number;
  assignedEmployees?: Array<{
    employeeId: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    role: string;
  }>;
  computedTotalCost?: number;
  computedProfit?: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [costSummary, setCostSummary] = useState({
    totalBudget: 0,
    totalCost: 0,
    profit: 0,
    profitMargin: 0,
  });

  useEffect(() => {
    if (tenantId) {
      fetchProjects();
    }
  }, [tenantId]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects', {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      
      if (response.ok) {
        const data = await response.json();
        const items: Project[] = data.items || [];
        const enriched = await enrichProjectsWithCosts(items);
        setProjects(enriched);
        await fetchCostSummary();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors du chargement des projets');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le projet "${projectName}" ?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-Id': tenantId || ''
        }
      });

      if (response.ok) {
        toast.success('Projet supprimé avec succès');
        fetchProjects();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const fetchCostSummary = async () => {
    try {
      const response = await fetch('/api/projects/report-summary', {
        headers: { 'X-Tenant-Id': tenantId || '' },
      });
      if (response.ok) {
        const data = await response.json();
        setCostSummary({
          totalBudget: data.totalBudget || 0,
          totalCost: data.totalCostTTC || 0,
          profit: data.profit || 0,
          profitMargin: data.profitMargin || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching project summary:', error);
    }
  };

  const enrichProjectsWithCosts = async (projectList: Project[]): Promise<Project[]> => {
    return Promise.all(
      projectList.map(async (project) => {
        try {
          const [expensesRes, laborRes, productsRes] = await Promise.all([
            fetch(`/api/projects/${project._id}/expenses`, {
              headers: { 'X-Tenant-Id': tenantId || '' },
            }),
            fetch(`/api/projects/${project._id}/labor`, {
              headers: { 'X-Tenant-Id': tenantId || '' },
            }),
            fetch(`/api/projects/${project._id}/products`, {
              headers: { 'X-Tenant-Id': tenantId || '' },
            }),
          ]);

          const expensesData = expensesRes.ok ? await expensesRes.json() : { expenses: [] };
          const laborData = laborRes.ok ? await laborRes.json() : { labor: [] };
          const productsData = productsRes.ok ? await productsRes.json() : { products: [], total: 0 };

          const totalExpensesTTC = (expensesData.expenses || []).reduce(
            (sum: number, expense: any) => sum + (expense.totalTTC || expense.totalHT || 0),
            0
          );
          const totalLaborCost = (laborData.labor || []).reduce(
            (sum: number, entry: any) => sum + (entry.laborCost || 0),
            0
          );
          const totalProductsTTC =
            typeof productsData.totalTTC === 'number'
              ? productsData.totalTTC
              : typeof productsData.total === 'number'
              ? productsData.total
              : (productsData.products || []).reduce(
                  (sum: number, item: any) => sum + (item.totalCostTTC ?? item.totalCost ?? 0),
                  0
                );

          const totalCostTTC = totalExpensesTTC + totalLaborCost + totalProductsTTC;
          const budgetValue = project.budget || 0;

          return {
            ...project,
            computedTotalCost: totalCostTTC,
            computedProfit: budgetValue - totalCostTTC,
          };
        } catch (error) {
          console.error(`Error computing cost for project ${project._id}:`, error);
          const fallbackTotal = project.totalCost || 0;
          const fallbackBudget = project.budget || 0;
          return {
            ...project,
            computedTotalCost: fallbackTotal,
            computedProfit: fallbackBudget - fallbackTotal,
          };
        }
      })
    );
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
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'En attente',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.projectNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const inProgress = filteredProjects.filter(p => p.status === 'in_progress').length;
    const completed = filteredProjects.filter(p => p.status === 'completed').length;
    
    return { total, inProgress, completed, totalBudget: costSummary.totalBudget };
  }, [filteredProjects, costSummary]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Projets</h1>
            <p className="mt-1 text-sm text-gray-600">Gérez vos projets et suivez leur progression</p>
          </div>
          <button
            onClick={() => router.push('/projects/new')}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Nouveau projet</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total projets</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BriefcaseIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En cours</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Terminés</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <BriefcaseIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Budget total</p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">
                  {formatPrice(stats.totalBudget, 'TND')}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
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
                placeholder="Rechercher par nom, numéro, description..."
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
                <option value="pending">En attente</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Terminé</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>
        </div>

        {/* Projects Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Chargement...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 text-center">
              <BriefcaseIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun projet trouvé</h3>
              <p className="text-gray-600 mb-6">Commencez par créer votre premier projet</p>
              <button
                onClick={() => router.push('/projects/new')}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
              >
                <PlusIcon className="w-5 h-5" />
                Créer un projet
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Projet</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Dates</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Budget</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Coût</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProjects.map((project) => {
                    const customerName = project.customerId.raisonSociale || 
                      `${project.customerId.nom || ''} ${project.customerId.prenom || ''}`.trim() || 
                      'N/A';
                    
                    return (
                      <tr key={project._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{project.name}</div>
                            <div className="text-sm text-gray-500">{project.projectNumber}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{customerName}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(project.startDate)}
                          </div>
                          {project.expectedEndDate && (
                            <div className="text-xs text-gray-500">
                              Fin prévue: {formatDate(project.expectedEndDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {project.budget ? formatPrice(project.budget, project.currency) : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatPrice(project.computedTotalCost ?? project.totalCost ?? 0, project.currency)}
                          </div>
                          {project.computedProfit !== undefined ? (
                            <div className={`text-xs ${project.computedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {project.computedProfit >= 0 ? '+' : ''}
                              {formatPrice(project.computedProfit, project.currency)}
                            </div>
                          ) : project.profit !== undefined ? (
                            <div className={`text-xs ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {project.profit >= 0 ? '+' : ''}
                              {formatPrice(project.profit, project.currency)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {getStatusBadge(project.status)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => router.push(`/projects/${project._id}`)}
                              className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Voir les détails"
                            >
                              <EyeIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => router.push(`/projects/${project._id}/edit`)}
                              className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(project._id, project.name)}
                              disabled={loading}
                              className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Supprimer"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

