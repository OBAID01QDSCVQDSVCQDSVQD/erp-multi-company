'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  PencilIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CubeIcon,
  BanknotesIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TruckIcon,
  DocumentArrowDownIcon,
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
  }>;
  blIds?: Array<{
    _id: string;
    numero: string;
    dateDoc?: string;
    date?: string;
    totalBaseHT?: number;
    totalHT?: number;
    totalTTC: number;
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

interface ProjectLaborEntry {
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    position?: string;
    department?: string;
  };
  role: string;
  salaryId?: string;
  startDate?: string;
  endDate?: string;
  dailyRate?: number;
  hourlyRate?: number;
  daysWorked: number;
  totalHours: number;
  laborCost: number;
  attendanceRecords?: number;
  advanceAmount?: number;
  advanceDays?: number;
}

interface LaborSummary {
  totalEmployees: number;
  totalDays: number;
  totalHours: number;
  totalCost: number;
  totalAdvances: number;
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
        typeof productsData.total === 'number'
          ? productsData.total
          : (productsData.products || []).reduce(
              (sum: number, item: any) => sum + (item.totalCost || 0),
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
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const endpoint = linkType === 'devis' ? '/api/sales/quotes' : '/api/sales/deliveries';
      const response = await fetch(`${endpoint}?q=${encodeURIComponent(searchQuery)}&limit=50`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });

      if (response.ok) {
        const data = await response.json();
        const allResults = data.items || [];
        
        // Get already linked document IDs
        const linkedIds = linkType === 'devis'
          ? (project?.devisIds || []).map((d: any) => d._id?.toString() || d.toString())
          : (project?.blIds || []).map((b: any) => b._id?.toString() || b.toString());
        
        // Filter out already linked documents
        const filteredResults = allResults.filter((doc: any) => {
          const docId = doc._id?.toString() || doc.toString();
          return !linkedIds.includes(docId);
        });
        
        setSearchResults(filteredResults);
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
      
      // Check if document is already linked
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

  // Auto-search when query changes
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
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, linkType, showLinkModal]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return null;
  }

  const effectiveBudget = costSummary.budget || project.budget || 0;
  const effectiveTotalCost = costSummary.totalCostTTC || project.totalCost || 0;
  const effectiveProfit =
    costSummary.profit ||
    project.profit ||
    (project.budget || 0) - (project.totalCost || 0);
  const effectiveMargin =
    costSummary.profitMargin ||
    (project.profitMargin || (project.budget ? (effectiveProfit / project.budget) * 100 : 0));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/projects')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{project.name}</h1>
                {getStatusBadge(project.status)}
              </div>
              <p className="mt-1 text-sm text-gray-600">{project.projectNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/projects/${projectId}/edit`)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Budget</p>
                <p className="mt-2 text-xl sm:text-2xl font-bold text-gray-900">
                  {formatPrice(effectiveBudget, project.currency)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Coût total</p>
                <p className="mt-2 text-xl sm:text-2xl font-bold text-gray-900">
                  {formatPrice(effectiveTotalCost, project.currency)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <BanknotesIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Profit / Perte</p>
                <p className={`mt-2 text-xl sm:text-2xl font-bold ${effectiveProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {effectiveProfit >= 0 ? '+' : ''}{formatPrice(effectiveProfit, project.currency)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Marge</p>
                <p className={`mt-2 text-xl sm:text-2xl font-bold ${effectiveMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {effectiveMargin.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
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
                  className={`flex items-center gap-2 px-4 sm:px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h3>
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Client</dt>
                        <dd className="mt-1 text-sm text-gray-900">{getCustomerName()}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Date de début</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatDate(project.startDate)}</dd>
                      </div>
                      {project.expectedEndDate && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Date de fin prévue</dt>
                          <dd className="mt-1 text-sm text-gray-900">{formatDate(project.expectedEndDate)}</dd>
                        </div>
                      )}
                      {project.actualEndDate && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Date de fin réelle</dt>
                          <dd className="mt-1 text-sm text-gray-900">{formatDate(project.actualEndDate)}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Statut</dt>
                        <dd className="mt-1">{getStatusBadge(project.status)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Équipe</h3>
                    {project.assignedEmployees.length === 0 ? (
                      <p className="text-sm text-gray-500">Aucun employé assigné</p>
                    ) : (
                      <div className="space-y-3">
                        {project.assignedEmployees.map((assignment, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {assignment.employeeId.firstName} {assignment.employeeId.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{assignment.role}</p>
                            </div>
                            {assignment.dailyRate && (
                              <p className="text-sm text-gray-600">
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>
                  </div>
                )}
                {project.tags && project.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
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
                    <h3 className="text-lg font-semibold text-gray-900">Devis liés</h3>
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
                        <div key={devis._id} className="p-4 bg-gray-50 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                              <span className="font-medium text-gray-900">{devis.numero}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/sales/quotes/${devis._id}`)}
                                className="text-sm text-blue-600 hover:text-blue-900"
                              >
                                Voir →
                              </button>
                              <button
                                onClick={() => handleUnlinkDocument('devis', devis._id)}
                                className="text-sm text-red-600 hover:text-red-900"
                              >
                                Délier
                              </button>
                            </div>
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-gray-500">Date</dt>
                              <dd className="font-medium text-gray-900">{formatDate(devis.dateDoc || devis.date)}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Total HT</dt>
                              <dd className="font-medium text-gray-900">{formatPrice(devis.totalBaseHT || devis.totalHT || 0, project.currency)}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-gray-500">Total TTC</dt>
                              <dd className="font-medium text-gray-900">{formatPrice(devis.totalTTC || 0, project.currency)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <h4 className="text-sm font-semibold text-gray-700 mb-1">Aucun Devis lié</h4>
                        <p className="text-xs text-gray-500 mb-3">Ce projet n'a pas de Devis associé</p>
                        <button
                          onClick={() => {
                            setLinkType('devis');
                            setShowLinkModal(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-900"
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
                    <h3 className="text-lg font-semibold text-gray-900">Bons de livraison liés</h3>
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
                        <div key={bl._id} className="p-4 bg-gray-50 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <TruckIcon className="w-5 h-5 text-gray-400" />
                              <span className="font-medium text-gray-900">{bl.numero}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push(`/sales/deliveries/${bl._id}`)}
                                className="text-sm text-blue-600 hover:text-blue-900"
                              >
                                Voir →
                              </button>
                              <button
                                onClick={() => handleUnlinkDocument('bl', bl._id)}
                                className="text-sm text-red-600 hover:text-red-900"
                              >
                                Délier
                              </button>
                            </div>
                          </div>
                          <dl className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-gray-500">Date</dt>
                              <dd className="font-medium text-gray-900">{formatDate(bl.dateDoc || bl.date)}</dd>
                            </div>
                            <div>
                              <dt className="text-gray-500">Total HT</dt>
                              <dd className="font-medium text-gray-900">{formatPrice(bl.totalBaseHT || bl.totalHT || 0, project.currency)}</dd>
                            </div>
                            <div className="col-span-2">
                              <dt className="text-gray-500">Total TTC</dt>
                              <dd className="font-medium text-gray-900">{formatPrice(bl.totalTTC || 0, project.currency)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <h4 className="text-sm font-semibold text-gray-700 mb-1">Aucun BL lié</h4>
                        <p className="text-xs text-gray-500 mb-3">Ce projet n'a pas de Bon de livraison associé</p>
                        <button
                          onClick={() => {
                            setLinkType('bl');
                            setShowLinkModal(true);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-900"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Lier un {linkType === 'devis' ? 'Devis' : 'Bon de livraison'}
              </h2>
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="p-6 border-b">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Rechercher par numéro ou nom de client...`}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-6">
              {searching ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Recherche en cours...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchQuery.trim() 
                      ? 'Aucun résultat trouvé' 
                      : 'Commencez à taper pour rechercher'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((doc) => {
                    let customerName = 'N/A';
                    if (doc.customerId) {
                      if (typeof doc.customerId === 'object' && doc.customerId !== null && !Array.isArray(doc.customerId)) {
                        // Populated customer object
                        const customer = doc.customerId as any;
                        customerName = customer.raisonSociale || 
                          `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 
                          'N/A';
                      } else if (typeof doc.customerId === 'string' && doc.customerId.trim() !== '') {
                        // Just ObjectId string - show ID for now
                        customerName = `ID: ${doc.customerId.substring(0, 8)}...`;
                      }
                    }
                    
                    return (
                      <div
                        key={doc._id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                            <span className="font-medium text-gray-900">{doc.numero}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span>Client: {customerName}</span>
                            <span className="mx-2">•</span>
                            <span>Date: {formatDate(doc.dateDoc || doc.date || doc.createdAt)}</span>
                            <span className="mx-2">•</span>
                            <span>Total: {formatPrice(doc.totalTTC || doc.totalBaseHT || 0, project?.currency || 'TND')}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleLinkDocument(doc._id)}
                          disabled={loading}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Lier
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

// Expenses Tab Component
function ExpensesTab({ projectId, currency, tenantId }: { projectId: string; currency: string; tenantId: string }) {
  const router = useRouter();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    fetchExpenses();
  }, [projectId, tenantId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/expenses?projetId=${projectId}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (response.ok) {
        const data = await response.json();
        const expensesList = data.expenses || [];
        setExpenses(expensesList);
        
        // Calculate total cost
        const total = expensesList.reduce((sum: number, exp: any) => {
          return sum + (exp.totalTTC || exp.totalHT || 0);
        }, 0);
        setTotalCost(total);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'TND',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount);
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: { [key: string]: string } = {
      brouillon: 'bg-gray-100 text-gray-800',
      en_attente: 'bg-yellow-100 text-yellow-800',
      valide: 'bg-blue-100 text-blue-800',
      paye: 'bg-green-100 text-green-800',
      rejete: 'bg-red-100 text-red-800',
    };
    const labels: { [key: string]: string } = {
      brouillon: 'Brouillon',
      en_attente: 'En attente',
      valide: 'Validé',
      paye: 'Payé',
      rejete: 'Rejeté',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.brouillon}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Chargement des dépenses...</p>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12">
        <BanknotesIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Dépenses</h3>
        <p className="text-sm text-gray-600">Aucune dépense liée à ce projet</p>
        <p className="text-sm text-gray-500 mt-2">Coût total: {formatPrice(totalCost)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Dépenses liées au projet</h3>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{expenses.length}</span> dépense(s) • 
          <span className="font-medium text-gray-900 ml-1">{formatPrice(totalCost)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numéro</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => (
              <tr key={expense._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{expense.numero}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(expense.date)}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    {expense.categorieId?.icone && (
                      <span className="mr-2">{expense.categorieId.icone}</span>
                    )}
                    <span className="text-sm text-gray-900">
                      {expense.categorieId?.nom || 'N/A'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 max-w-xs truncate">
                    {expense.description || '-'}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                  {formatPrice(expense.totalTTC || expense.totalHT || 0)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getStatusBadge(expense.statut || 'brouillon')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <button
                    onClick={() => router.push(`/expenses/${expense._id}`)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    Voir →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                Total:
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                {formatPrice(totalCost)}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Products Tab Component
function ProductsTab({ projectId, currency, tenantId }: { projectId: string; currency: string; tenantId: string }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, [projectId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/products`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setTotalCost(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'TND',
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
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Chargement des produits...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <CubeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Produits</h3>
        <p className="text-sm text-gray-600">Aucun produit consommé pour ce projet</p>
        <p className="text-sm text-gray-500 mt-2">Coût total: {formatPrice(totalCost)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Produits consommés</h3>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{products.length}</span> produit(s) • 
          <span className="font-medium text-gray-900 ml-1">{formatPrice(totalCost)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantité</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Coût unitaire HT</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Coût unitaire TTC</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Coût total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documents</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((item) => (
              <tr key={item.productId}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.product.nom}</div>
                    <div className="text-xs text-gray-500">{item.product.sku}</div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                  {item.quantity.toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatPrice(item.movements[0]?.unitCostHT || 0)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatPrice(item.movements[0]?.unitCostTTC || 0)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                  {formatPrice(item.totalCost)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  <div className="space-y-1">
                    {item.movements.map((movement: any, idx: number) => (
                      <div key={idx} className="text-xs">
                        {movement.documentType} {movement.documentNumero} • {formatDate(movement.date)}
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                Total:
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                {formatPrice(totalCost)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function LaborTab({ projectId, tenantId, currency }: { projectId: string; tenantId: string; currency: string }) {
  const [labor, setLabor] = useState<ProjectLaborEntry[]>([]);
  const [summary, setSummary] = useState<LaborSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchLabor = async () => {
      if (!tenantId || !projectId) return;
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/projects/${projectId}/labor`, {
          headers: { 'X-Tenant-Id': tenantId },
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || 'Erreur lors du chargement de la main d’œuvre');
        }
        const data = await response.json();
        if (mounted) {
          setLabor(data.labor || []);
          setSummary(data.summary || null);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || 'Erreur lors du chargement de la main d’œuvre');
      } finally {
          if (mounted) setLoading(false);
      }
    };
    fetchLabor();
    return () => {
      mounted = false;
    };
  }, [projectId, tenantId]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value || 0);

  const formatNumber = (value: number, decimals = 0) =>
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value || 0);

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-500">
        <div className="mb-4 flex justify-center">
          <div className="h-12 w-12 border-4 border-blue-100 border-t-blue-500 rounded-full animate-spin" />
        </div>
        Chargement des données de main d’œuvre...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (!labor.length) {
    return (
      <div className="text-center py-12">
        <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Main d'œuvre</h3>
        <p className="text-sm text-gray-600">Aucun membre d’équipe n’est associé à ce projet.</p>
        <p className="text-sm text-gray-500 mt-2">Coût total: {formatCurrency(0)}</p>
      </div>
    );
  }

  const totalDays = summary?.totalDays ?? labor.reduce((sum, l) => sum + (l.daysWorked || 0), 0);
  const totalHours = summary?.totalHours ?? labor.reduce((sum, l) => sum + (l.totalHours || 0), 0);
  const totalCost = summary?.totalCost ?? labor.reduce((sum, l) => sum + (l.laborCost || 0), 0);
  const totalAdvances = summary?.totalAdvances ?? labor.reduce((sum, l) => sum + (l.advanceAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Équipe</p>
          <p className="text-2xl font-semibold text-gray-900">{summary?.totalEmployees ?? labor.length}</p>
          <p className="text-xs text-gray-400 mt-1">Membres affectés</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Jours travaillés</p>
          <p className="text-2xl font-semibold text-gray-900">{formatNumber(totalDays)}</p>
          <p className="text-xs text-gray-400 mt-1">Validés via présence</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Heures cumulées</p>
          <p className="text-2xl font-semibold text-gray-900">{formatNumber(totalHours, 1)} h</p>
          <p className="text-xs text-gray-400 mt-1">Basées sur les pointages</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Coût total</p>
          <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalCost)}</p>
          <p className="text-xs text-gray-400 mt-1">Avances: {formatCurrency(totalAdvances)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rôle</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Jours</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Heures</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taux jour</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Coût</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Avances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {labor.map((item) => (
                <tr key={item.employee?._id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/hr/salaries/${item.salaryId ?? ''}`}
                      className="font-medium text-blue-600 hover:text-blue-800 transition-colors underline-offset-2 hover:underline"
                    >
                      {item.employee?.firstName} {item.employee?.lastName}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {item.employee?.position}
                      {item.employee?.department ? ` • ${item.employee.department}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.role || '-'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">
                    {formatNumber(item.daysWorked || 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {formatNumber(item.totalHours || 0, 1)} h
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {formatCurrency(item.dailyRate || item.hourlyRate || 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(item.laborCost || 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(item.advanceAmount || 0)}</span>
                      {item.advanceAmount ? (
                        <span className="text-xs text-gray-400">
                          {formatNumber(item.advanceDays || 0, 1)} j
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                <td></td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">
                  {formatNumber(totalDays)}
                </td>
                <td className="px-4 py-3 text-center font-semibold text-gray-900">
                  {formatNumber(totalHours, 1)} h
                </td>
                <td></td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {formatCurrency(totalCost)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {formatCurrency(totalAdvances)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// Report Tab Component
function ReportTab({ 
  projectId, 
  tenantId, 
  currency, 
  budget 
}: { 
  projectId: string; 
  tenantId: string; 
  currency: string; 
  budget: number;
}) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [labor, setLabor] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReportData();
  }, [projectId, tenantId]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency || 'TND',
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
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const handleExportPdf = async () => {
    if (!summary || !reportRef.current) return;
    try {
      setDownloading(true);
      const [{ default: jsPDF }, html2canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const html2canvas = html2canvasModule.default;
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let position = 0;
      let heightLeft = pdfHeight;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`rapport-projet-${projectId}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [expensesRes, laborRes, productsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/expenses`, {
          headers: { 'X-Tenant-Id': tenantId }
        }),
        fetch(`/api/projects/${projectId}/labor`, {
          headers: { 'X-Tenant-Id': tenantId }
        }),
        fetch(`/api/projects/${projectId}/products`, {
          headers: { 'X-Tenant-Id': tenantId }
        })
      ]);

      const expensesData = expensesRes.ok ? await expensesRes.json() : { expenses: [], total: 0 };
      const laborData = laborRes.ok ? await laborRes.json() : { labor: [], summary: null };
      const productsData = productsRes.ok ? await productsRes.json() : { products: [], total: 0 };

      setExpenses(expensesData.expenses || []);
      setLabor(laborData.labor || []);
      setProducts(productsData.products || []);

      // Calculate totals
      const totalExpensesTTC = (expensesData.expenses || []).reduce(
        (sum: number, e: any) => sum + (e.totalTTC || e.totalHT || 0), 
        0
      );
      const totalLaborCost = (laborData.labor || []).reduce(
        (sum: number, l: any) => sum + (l.laborCost || 0), 
        0
      );
      const totalProductsTTC = productsData.total || 0;

      const totalCostTTC = totalExpensesTTC + totalLaborCost + totalProductsTTC;
      const profit = budget - totalCostTTC;
      const profitMargin = budget > 0 ? (profit / budget) * 100 : 0;

      setSummary({
        budget,
        totalExpensesTTC,
        totalLaborCost,
        totalProductsTTC,
        totalCostTTC,
        profit,
        profitMargin,
        totalEmployees: laborData.labor?.length || 0,
        totalDays: (laborData.labor || []).reduce((sum: number, l: any) => sum + (l.daysWorked || 0), 0),
        totalHours: (laborData.labor || []).reduce((sum: number, l: any) => sum + (l.totalHours || 0), 0),
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Chargement du rapport...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Rapport complet</h3>
        <p className="text-sm text-gray-600">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Rapport détaillé</h3>
        <button
          onClick={handleExportPdf}
          disabled={downloading}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
            downloading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          {downloading ? 'Génération...' : 'Télécharger PDF'}
        </button>
      </div>
      <div
        ref={reportRef}
        className="space-y-6 bg-white p-6 md:p-10 rounded-2xl shadow border border-gray-100"
      >
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Budget</p>
          <p className="text-2xl font-semibold text-gray-900">{formatPrice(summary.budget)}</p>
          <p className="text-xs text-gray-400 mt-1">Montant alloué</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Coût total TTC</p>
          <p className="text-2xl font-semibold text-red-600">{formatPrice(summary.totalCostTTC)}</p>
          <p className="text-xs text-gray-400 mt-1">Tous frais inclus</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Profit / Perte</p>
          <p className={`text-2xl font-semibold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPrice(summary.profit)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Marge: {summary.profitMargin.toFixed(1)}%</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Équipe</p>
          <p className="text-2xl font-semibold text-gray-900">{summary.totalEmployees}</p>
          <p className="text-xs text-gray-400 mt-1">
            {summary.totalDays} jours • {summary.totalHours.toFixed(1)}h
          </p>
        </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition des coûts (TTC)</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Dépenses</span>
            <span className="text-sm font-semibold text-gray-900">{formatPrice(summary.totalExpensesTTC)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Main d'œuvre</span>
            <span className="text-sm font-semibold text-gray-900">{formatPrice(summary.totalLaborCost)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Produits</span>
            <span className="text-sm font-semibold text-gray-900">{formatPrice(summary.totalProductsTTC)}</span>
          </div>
          <div className="border-t pt-4 flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">Total coûts TTC</span>
            <span className="text-base font-bold text-gray-900">{formatPrice(summary.totalCostTTC)}</span>
          </div>
        </div>
        </div>

        {/* Expenses Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Dépenses ({expenses.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant TTC</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucune dépense
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense._id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{expense.numero}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(expense.date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {expense.categorieId?.nom || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                      {expense.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatPrice(expense.totalTTC || expense.totalHT || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                  Total:
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  {formatPrice(summary.totalExpensesTTC)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>

        {/* Labor Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Main d'œuvre ({labor.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Jours</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Heures</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {labor.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucune main d'œuvre
                  </td>
                </tr>
              ) : (
                labor.map((item) => (
                  <tr key={item.employee?._id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.employee?.firstName} {item.employee?.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.role || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      {item.daysWorked || 0}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-700">
                      {(item.totalHours || 0).toFixed(1)} h
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatPrice(item.laborCost || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                  Total:
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  {formatPrice(summary.totalLaborCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>

        {/* Products Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Produits consommés ({products.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantité</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût unitaire TTC</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Coût total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucun produit
                  </td>
                </tr>
              ) : (
                products.map((item) => (
                  <tr key={item.productId}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{item.product.nom}</div>
                        <div className="text-xs text-gray-500">{item.product.sku}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {item.quantity.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatPrice(item.movements[0]?.unitCostTTC || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatPrice(item.totalCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                  Total:
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                  {formatPrice(summary.totalProductsTTC)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}

