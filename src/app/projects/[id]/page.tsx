'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  PencilIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CubeIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

// Import Tabs
import ExpensesTab from './tabs/ExpensesTab';
import ProductsTab from './tabs/ProductsTab';
import LaborTab from './tabs/LaborTab';
import ReportTab from './tabs/ReportTab';

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
    email?: string;
    phone?: string;
  };
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  budget?: number;
  currency: string;
  devisIds?: Array<{
    _id: string;
    numero: string;
    dateDoc?: string;
    date?: string;
    totalBaseHT?: number;
    totalHT?: number;
    totalTTC: number;
    statut?: string;
  }>;
  blIds?: Array<{
    _id: string;
    numero: string;
    dateDoc?: string;
    date?: string;
    totalBaseHT?: number;
    totalHT?: number;
    totalTTC: number;
    statut?: string;
  }>;
  assignedEmployees: Array<{
    employeeId: {
      _id: string;
      firstName: string;
      lastName: string;
      position: string;
      department: string;
    };
    role: string;
    hourlyRate?: number;
    dailyRate?: number;
    startDate: string;
    endDate?: string;
  }>;
  totalProductsCost: number;
  totalExpensesCost: number;
  totalLaborCost: number;
  totalCost: number;
  profit: number;
  profitMargin: number;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'products' | 'expenses' | 'labor' | 'report'>('overview');

  // Modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkType, setLinkType] = useState<'devis' | 'bl'>('devis');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [costSummary, setCostSummary] = useState({
    budget: 0,
    totalExpensesTTC: 0,
    totalLaborCost: 0,
    totalProductsTTC: 0,
    totalCostTTC: 0,
    profit: 0,
    profitMargin: 0,
  });

  useEffect(() => {
    if (tenantId && projectId) {
      fetchProject();
    }
  }, [tenantId, projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data);
        fetchCostSummary(data.budget || 0);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors du chargement');
        router.push('/projects');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Erreur lors du chargement');
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchCostSummary = async (projectBudget: number) => {
    try {
      const [expensesRes, laborRes, productsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/expenses`, {
          headers: { 'X-Tenant-Id': tenantId || '' }
        }),
        fetch(`/api/projects/${projectId}/labor`, {
          headers: { 'X-Tenant-Id': tenantId || '' }
        }),
        fetch(`/api/projects/${projectId}/products`, {
          headers: { 'X-Tenant-Id': tenantId || '' }
        })
      ]);

      const expensesData = expensesRes.ok ? await expensesRes.json() : { expenses: [] };
      const laborData = laborRes.ok ? await laborRes.json() : { labor: [] };
      const productsData = productsRes.ok ? await productsRes.json() : { products: [], total: 0 };

      const totalExpensesTTC = (expensesData.expenses || []).reduce(
        (sum: number, expense: any) => sum + (expense.totalTTC || expense.totalHT || 0),
        0
      );
      const totalLaborCost = (laborData.labor || []).reduce(
        (sum: number, record: any) => sum + (record.laborCost || 0),
        0
      );
      const totalProductsTTC =
        typeof productsData.totalTTC === 'number'
          ? productsData.totalTTC
          : typeof productsData.total === 'number'
            ? productsData.total
            : (productsData.products || []).reduce(
              (sum: number, item: any) => sum + (item.totalCostTTC || item.totalCost || 0),
              0
            );

      const totalCostTTC = totalExpensesTTC + totalLaborCost + totalProductsTTC;
      const budgetValue = projectBudget || 0;
      const profit = budgetValue - totalCostTTC;
      const profitMargin = budgetValue > 0 ? (profit / budgetValue) * 100 : 0;

      setCostSummary({
        budget: budgetValue,
        totalExpensesTTC,
        totalLaborCost,
        totalProductsTTC,
        totalCostTTC,
        profit,
        profitMargin,
      });
    } catch (error) {
      console.error('Error fetching project summary:', error);
    }
  };

  const formatPrice = (amount: number, currency: string = 'TND') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    const labels = {
      pending: 'En attente',
      in_progress: 'En cours',
      completed: 'Terminé',
      cancelled: 'Annulé',
    };
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getCustomerName = () => {
    if (!project?.customerId) return 'N/A';
    return project.customerId.raisonSociale ||
      `${project.customerId.nom || ''} ${project.customerId.prenom || ''}`.trim() ||
      'N/A';
  };

  const handleSearchDocuments = async () => {
    try {
      setSearching(true);
      const endpoint = linkType === 'devis' ? '/api/sales/quotes' : '/api/sales/deliveries';
      const url = searchQuery.trim()
        ? `${endpoint}?q=${encodeURIComponent(searchQuery)}&limit=100`
        : `${endpoint}?limit=100`;
      const response = await fetch(url, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        const allResults = data.items || [];

        // Fetch all projects to check which documents are linked to which projects
        const projectsResponse = await fetch('/api/projects?limit=1000', {
          headers: { 'X-Tenant-Id': tenantId || '' }
        });

        let allProjects: any[] = [];
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          allProjects = projectsData.items || [];
        }

        const documentToProjectMap = new Map<string, string>();
        allProjects.forEach((proj: any) => {
          const projId = proj._id?.toString() || proj.toString();

          if (proj.devisIds && Array.isArray(proj.devisIds)) {
            proj.devisIds.forEach((devis: any) => {
              const devisId = devis._id?.toString() || devis.toString();
              documentToProjectMap.set(devisId, projId);
            });
          }

          if (proj.blIds && Array.isArray(proj.blIds)) {
            proj.blIds.forEach((bl: any) => {
              const blId = bl._id?.toString() || bl.toString();
              documentToProjectMap.set(blId, projId);
            });
          }
        });

        const linkedIds = linkType === 'devis'
          ? (project?.devisIds || []).map((d: any) => d._id?.toString() || d.toString())
          : (project?.blIds || []).map((b: any) => b._id?.toString() || b.toString());

        const enrichedResults = allResults.map((doc: any) => {
          const docId = doc._id?.toString() || doc.toString();
          const isAlreadyLinkedToThisProject = linkedIds.includes(docId);

          const linkedProjectId = documentToProjectMap.get(docId) || null;
          const hasProjetId = linkedProjectId !== null;

          const normalizedLinkedProjectId = linkedProjectId ? linkedProjectId.trim() : null;
          const normalizedCurrentProjectId = projectId ? projectId.trim() : null;

          const isLinkedToThisProject = normalizedLinkedProjectId && normalizedLinkedProjectId === normalizedCurrentProjectId;
          const isLinkedToOtherProject = hasProjetId && normalizedLinkedProjectId && !isLinkedToThisProject;

          const cannotLink = isAlreadyLinkedToThisProject || isLinkedToOtherProject;

          return {
            ...doc,
            isAlreadyLinkedToThisProject,
            isLinkedToThisProject,
            isLinkedToOtherProject,
            hasProjetId,
            linkedProjectId: normalizedLinkedProjectId,
            cannotLink
          };
        });

        setSearchResults(enrichedResults);
      } else {
        toast.error('Erreur lors de la recherche');
      }
    } catch (error) {
      console.error('Error searching documents:', error);
      toast.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  };

  const handleLinkDocument = async (documentId: string) => {
    try {
      setLoading(true);

      const currentIds = linkType === 'devis'
        ? (project?.devisIds || []).map((d: any) => d._id?.toString() || d.toString())
        : (project?.blIds || []).map((b: any) => b._id?.toString() || b.toString());

      if (currentIds.includes(documentId)) {
        toast.error('Ce document est déjà lié');
        return;
      }

      const updateData: any = {};
      if (linkType === 'devis') {
        const currentDevisIds = (project?.devisIds || []).map((d: any) => d._id?.toString() || d.toString());
        updateData.devisIds = [...currentDevisIds, documentId];
      } else {
        const currentBlIds = (project?.blIds || []).map((b: any) => b._id?.toString() || b.toString());
        updateData.blIds = [...currentBlIds, documentId];
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success(linkType === 'devis' ? 'Devis lié avec succès' : 'BL lié avec succès');
        setShowLinkModal(false);
        setSearchQuery('');
        setSearchResults([]);
        fetchProject();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la liaison');
      }
    } catch (error) {
      console.error('Error linking document:', error);
      toast.error('Erreur lors de la liaison');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkDocument = async (type: 'devis' | 'bl', documentId?: string) => {
    try {
      setLoading(true);
      const updateData: any = {};

      if (type === 'devis') {
        const currentDevisIds = (project?.devisIds || []).map((d: any) => d._id?.toString() || d.toString());
        updateData.devisIds = documentId
          ? currentDevisIds.filter((id: string) => id !== documentId)
          : [];
      } else {
        const currentBlIds = (project?.blIds || []).map((b: any) => b._id?.toString() || b.toString());
        updateData.blIds = documentId
          ? currentBlIds.filter((id: string) => id !== documentId)
          : [];
      }

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        toast.success(type === 'devis' ? 'Devis délié avec succès' : 'BL délié avec succès');
        fetchProject();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la déliaison');
      }
    } catch (error) {
      console.error('Error unlinking document:', error);
      toast.error('Erreur lors de la déliaison');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showLinkModal) {
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearchDocuments();
      } else {
        handleSearchDocuments();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, linkType, showLinkModal]);

  if (loading && !project) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 sm:p-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>

          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-full" />

          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return null;
  }

  const effectiveBudget = costSummary.budget || project.budget || 0;
  const effectiveTotalCost = costSummary.totalCostTTC || (project as any)?.totalCostTTC || project?.totalCost || 0;
  const effectiveProfit = costSummary.profit || project.profit || (project.budget || 0) - (project.totalCost || 0);
  const effectiveMargin = costSummary.profitMargin || (project.profitMargin || (project.budget ? (effectiveProfit / project.budget) * 100 : 0));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/projects')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
                {getStatusBadge(project.status)}
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{project.projectNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/projects/${projectId}/edit`)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Budget</p>
                <p className="mt-2 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(effectiveBudget, project.currency)}
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Coût total TTC</p>
                <p className="mt-2 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(effectiveTotalCost, project.currency)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BanknotesIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 border dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Profit / Perte</p>
                <p className={`mt-2 text-xl sm:text-2xl font-bold ${effectiveProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {effectiveProfit >= 0 ? '+' : ''}{formatPrice(effectiveProfit, project.currency)}
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
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Marge</p>
                <p className={`mt-2 text-xl sm:text-2xl font-bold ${effectiveMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {effectiveMargin.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex overflow-x-auto -mb-px">
              {[
                { id: 'overview', label: 'Vue d\'ensemble', icon: BriefcaseIcon },
                { id: 'documents', label: 'Documents', icon: DocumentTextIcon },
                { id: 'products', label: 'Produits', icon: CubeIcon },
                { id: 'expenses', label: 'Dépenses', icon: BanknotesIcon },
                { id: 'labor', label: 'Main d\'œuvre', icon: UserGroupIcon },
                { id: 'report', label: 'Rapport', icon: ChartBarIcon },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 sm:px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-4 sm:p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informations générales</h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Client</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{getCustomerName()}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date de début</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(project.startDate)}</dd>
                      </div>
                      {project.expectedEndDate && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date de fin prévue</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(project.expectedEndDate)}</dd>
                        </div>
                      )}
                      {project.actualEndDate && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date de fin réelle</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(project.actualEndDate)}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Statut</dt>
                        <dd className="mt-1">{getStatusBadge(project.status)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Équipe</h3>
                    {project.assignedEmployees.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Aucun employé assigné</p>
                    ) : (
                      <div className="space-y-3">
                        {project.assignedEmployees.map((assignment, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {assignment.employeeId.firstName} {assignment.employeeId.lastName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{assignment.role}</p>
                            </div>
                            {assignment.dailyRate && (
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                {formatPrice(assignment.dailyRate, project.currency)}/jour
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {project.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}
                {project.tags && project.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="space-y-6">
                {/* Devis Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Devis liés</h3>
                    <button
                      onClick={() => {
                        setLinkType('devis');
                        setShowLinkModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <DocumentTextIcon className="w-4 h-4" />
                      Ajouter un Devis
                    </button>
                  </div>
                  {project.devisIds && project.devisIds.length > 0 ? (
                    <div className="space-y-3">
                      {project.devisIds.map((devis: any) => (
                        <div key={devis._id} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                              <span className="font-medium text-gray-900 dark:text-white">{devis.numero}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/sales/quotes/${devis._id}`)}
                                className="text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Voir →
                              </button>
                              <button
                                onClick={() => handleUnlinkDocument('devis', devis._id)}
                                className="text-sm text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Délier
                              </button>
                            </div>
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-gray-500 dark:text-gray-400">Date</dt>
                              <dd className="font-medium text-gray-900 dark:text-white">{formatDate(devis.dateDoc || devis.date)}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 dark:text-gray-400">Total HT</dt>
                              <dd className="font-medium text-gray-900 dark:text-white">{formatPrice(devis.totalBaseHT || devis.totalHT || 0, project.currency)}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-gray-500 dark:text-gray-400">Total TTC</dt>
                              <dd className="font-medium text-gray-900 dark:text-white">{formatPrice(devis.totalTTC || 0, project.currency)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <div className="text-center">
                        <DocumentTextIcon className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Aucun Devis lié</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Ce projet n'a pas de Devis associé</p>
                        <button
                          onClick={() => {
                            setLinkType('devis');
                            setShowLinkModal(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Lier un Devis
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* BL Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bons de livraison liés</h3>
                    <button
                      onClick={() => {
                        setLinkType('bl');
                        setShowLinkModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      <TruckIcon className="w-4 h-4" />
                      Ajouter un BL
                    </button>
                  </div>
                  {project.blIds && project.blIds.length > 0 ? (
                    <div className="space-y-3">
                      {project.blIds.map((bl: any) => (
                        <div key={bl._id} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-700">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <TruckIcon className="w-5 h-5 text-gray-400" />
                              <span className="font-medium text-gray-900 dark:text-white">{bl.numero}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/sales/deliveries/${bl._id}`)}
                                className="text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Voir →
                              </button>
                              <button
                                onClick={() => handleUnlinkDocument('bl', bl._id)}
                                className="text-sm text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                              >
                                Délier
                              </button>
                            </div>
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-gray-500 dark:text-gray-400">Date</dt>
                              <dd className="font-medium text-gray-900 dark:text-white">{formatDate(bl.dateDoc || bl.date)}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500 dark:text-gray-400">Total HT</dt>
                              <dd className="font-medium text-gray-900 dark:text-white">{formatPrice(bl.totalBaseHT || bl.totalHT || 0, project.currency)}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-gray-500 dark:text-gray-400">Total TTC</dt>
                              <dd className="font-medium text-gray-900 dark:text-white">{formatPrice(bl.totalTTC || 0, project.currency)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <div className="text-center">
                        <TruckIcon className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Aucun BL lié</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Ce projet n'a pas de Bon de livraison associé</p>
                        <button
                          onClick={() => {
                            setLinkType('bl');
                            setShowLinkModal(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Lier un BL
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <ProductsTab projectId={projectId} currency={project.currency} tenantId={tenantId || ''} />
            )}

            {/* Expenses Tab */}
            {activeTab === 'expenses' && (
              <ExpensesTab projectId={projectId} currency={project.currency} tenantId={tenantId || ''} />
            )}

            {/* Labor Tab */}
            {activeTab === 'labor' && (
              <LaborTab projectId={projectId} tenantId={tenantId || ''} currency={project.currency} />
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <ReportTab
                projectId={projectId}
                tenantId={tenantId || ''}
                currency={project.currency}
                budget={project.budget || 0}
              />
            )}
          </div>
        </div>
      </div>

      {/* Link Document Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Lier un {linkType === 'devis' ? 'Devis' : 'Bon de livraison'}
              </h2>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Rechercher par numéro ou nom de client...`}
                  className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50">
              {searching ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-500"></div>
                  <p className="mt-4 text-sm sm:text-base text-gray-600 dark:text-gray-400">Recherche en cours...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    {searchQuery.trim()
                      ? 'Aucun résultat trouvé'
                      : 'Commencez à taper pour rechercher'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {searchResults.map((doc: any) => {
                    let customerName = 'N/A';
                    if (doc.customerId) {
                      if (typeof doc.customerId === 'object' && doc.customerId !== null && !Array.isArray(doc.customerId)) {
                        const customer = doc.customerId as any;
                        customerName = customer.raisonSociale ||
                          `${customer.nom || ''} ${customer.prenom || ''}`.trim() ||
                          'N/A';
                      } else if (typeof doc.customerId === 'string' && doc.customerId.trim() !== '') {
                        customerName = `ID: ${doc.customerId.substring(0, 8)}...`;
                      }
                    }

                    const cannotLink = doc.cannotLink;
                    const isLinkedToThisProject = doc.isLinkedToThisProject;
                    const isLinkedToOtherProject = doc.isLinkedToOtherProject;

                    return (
                      <div
                        key={doc._id}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg transition-colors ${cannotLink
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30 opacity-75'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                        <div className="flex-1 mb-3 sm:mb-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1 sm:mb-2">
                            <DocumentTextIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${cannotLink ? 'text-amber-500' : 'text-gray-400'}`} />
                            <span className={`font-medium ${cannotLink ? 'text-amber-900 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                              {doc.numero}
                            </span>
                            {isLinkedToThisProject && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                                ✓ Lié à ce projet
                              </span>
                            )}
                            {isLinkedToOtherProject && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                                ⚠️ Indisponible - Déjà lié à un autre projet
                              </span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-1 sm:space-y-0">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <span>Client: {customerName}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>Date: {formatDate(doc.dateDoc || doc.date || doc.createdAt)}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>Total: {formatPrice(doc.totalTTC || doc.totalBaseHT || 0, project?.currency || 'TND')}</span>
                            </div>
                            {cannotLink && (
                              <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 sm:mt-0 font-medium">
                                {isLinkedToThisProject
                                  ? `Ce ${linkType === 'devis' ? 'devis' : 'bon de livraison'} est déjà lié à ce projet.`
                                  : `⚠️ Ce ${linkType === 'devis' ? 'devis' : 'bon de livraison'} est déjà utilisé dans un autre projet et ne peut pas être sélectionné.`
                                }
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkDocument(doc._id)}
                          disabled={loading || cannotLink}
                          className={`ml-0 sm:ml-4 px-3 sm:px-4 py-2 text-sm rounded-lg transition-colors whitespace-nowrap font-medium ${cannotLink
                              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                        >
                          {cannotLink ? 'Indisponible' : 'Lier'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
