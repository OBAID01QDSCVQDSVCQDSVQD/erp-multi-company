'use client';

import { useState, useEffect } from 'react';
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
                  {project.budget ? formatPrice(project.budget, project.currency) : '-'}
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
                  {formatPrice(project.totalCost || 0, project.currency)}
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
                <p className={`mt-2 text-xl sm:text-2xl font-bold ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {project.profit >= 0 ? '+' : ''}{formatPrice(project.profit || 0, project.currency)}
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
                <p className={`mt-2 text-xl sm:text-2xl font-bold ${project.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {project.profitMargin.toFixed(1)}%
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
              <div className="text-center py-12">
                <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Main d'œuvre</h3>
                <p className="text-sm text-gray-600">Le suivi de la main d'œuvre sera bientôt disponible</p>
                <p className="text-sm text-gray-500 mt-2">Coût total: {formatPrice(project.totalLaborCost || 0, project.currency)}</p>
              </div>
            )}

            {/* Report Tab */}
            {activeTab === 'report' && (
              <div className="text-center py-12">
                <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Rapport complet</h3>
                <p className="text-sm text-gray-600">Le rapport complet sera bientôt disponible</p>
              </div>
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

