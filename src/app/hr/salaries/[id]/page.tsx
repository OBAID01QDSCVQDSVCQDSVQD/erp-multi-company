'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { 
  ArrowLeftIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowDownTrayIcon,
  PencilIcon,
  TrashIcon
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
    advancesList?: Array<{
      amount: number;
      date: string;
      notes?: string;
    }>;
    otherDeductions: number;
    totalDeductions: number;
  };
  netSalary: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'cancelled';
  paymentDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SalaryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [salary, setSalary] = useState<Salary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditSalaryModal, setShowEditSalaryModal] = useState(false);
  const [showEditAdvancesModal, setShowEditAdvancesModal] = useState(false);
  const [showAddAdvanceModal, setShowAddAdvanceModal] = useState(false);
  const [editForm, setEditForm] = useState({
    baseSalary: '',
    dailyRate: '',
  });
  const [newAdvance, setNewAdvance] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (tenantId && params.id) {
      fetchSalary();
    }
  }, [tenantId, params.id]);

  const fetchSalary = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/hr/salaries/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSalary(data);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors du chargement du salaire');
        router.push('/hr/salaries');
      }
    } catch (error) {
      console.error('Error fetching salary:', error);
      toast.error('Erreur lors du chargement du salaire');
      router.push('/hr/salaries');
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

  const handleEditSalaryClick = () => {
    if (salary) {
      setEditForm({
        baseSalary: salary.baseSalary.toString(),
        dailyRate: salary.dailyRate.toString(),
      });
      setShowEditSalaryModal(true);
    }
  };

  const handleEditSalarySubmit = async () => {
    if (!salary) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/hr/salaries/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({
          baseSalary: parseFloat(editForm.baseSalary),
          dailyRate: parseFloat(editForm.dailyRate),
        })
      });

      if (response.ok) {
        toast.success('Salaire mis à jour avec succès');
        setShowEditSalaryModal(false);
        fetchSalary();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error updating salary:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdvanceClick = () => {
    setNewAdvance({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setShowAddAdvanceModal(true);
  };

  const handleAddAdvanceSubmit = async () => {
    if (!salary) return;

    if (!newAdvance.amount || parseFloat(newAdvance.amount) <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/hr/salaries/${params.id}/advances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({
          amount: parseFloat(newAdvance.amount),
          date: newAdvance.date,
          notes: newAdvance.notes || undefined,
        })
      });

      if (response.ok) {
        toast.success('Avance ajoutée avec succès');
        setShowAddAdvanceModal(false);
        fetchSalary();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de l\'ajout de l\'avance');
      }
    } catch (error) {
      console.error('Error adding advance:', error);
      toast.error('Erreur lors de l\'ajout de l\'avance');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdvance = async (index: number) => {
    if (!salary) return;

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette avance ?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/hr/salaries/${params.id}/advances`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || ''
        },
        body: JSON.stringify({ index })
      });

      if (response.ok) {
        toast.success('Avance supprimée avec succès');
        fetchSalary();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting advance:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[month - 1];
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            Payé
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircleIcon className="w-4 h-4 mr-1" />
            Annulé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            En attente
          </span>
        );
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return 'Virement bancaire';
      case 'check':
        return 'Chèque';
      case 'cash':
        return 'Espèces';
      default:
        return method;
    }
  };

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

  if (!salary) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/hr/salaries')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Fiche de paie</h1>
              <p className="mt-1 text-sm text-gray-600">
                {getMonthName(salary.period.month)} {salary.period.year}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getPaymentStatusBadge(salary.paymentStatus)}
            <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Télécharger PDF</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Employee Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-gray-400" />
                Informations de l'employé
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Nom complet</p>
                  <p className="text-base font-medium text-gray-900">
                    {salary.employeeId.firstName} {salary.employeeId.lastName}
                  </p>
                </div>
                {salary.employeeId.employeeNumber && (
                  <div>
                    <p className="text-sm text-gray-600">Numéro d'employé</p>
                    <p className="text-base font-medium text-gray-900">
                      {salary.employeeId.employeeNumber}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Poste</p>
                  <p className="text-base font-medium text-gray-900">
                    {salary.employeeId.position}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Département</p>
                  <p className="text-base font-medium text-gray-900">
                    {salary.employeeId.department}
                  </p>
                </div>
              </div>
            </div>

            {/* Period Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-gray-400" />
                Période de paie
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Mois</p>
                  <p className="text-base font-medium text-gray-900">
                    {getMonthName(salary.period.month)} {salary.period.year}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date de début</p>
                  <p className="text-base font-medium text-gray-900">
                    {formatDate(salary.period.startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date de fin</p>
                  <p className="text-base font-medium text-gray-900">
                    {formatDate(salary.period.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Jours totaux</p>
                  <p className="text-base font-medium text-gray-900">
                    {salary.totalDays} jours
                  </p>
                </div>
              </div>
            </div>

            {/* Work Days */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-gray-400" />
                Jours de travail
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{salary.workedDays}</p>
                  <p className="text-sm text-gray-600 mt-1">Jours travaillés</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{salary.absentDays}</p>
                  <p className="text-sm text-gray-600 mt-1">Jours d'absence</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{salary.leaveDays}</p>
                  <p className="text-sm text-gray-600 mt-1">Jours de congé</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{salary.totalDays}</p>
                  <p className="text-sm text-gray-600 mt-1">Total jours</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Taux journalier</span>
                    <button
                      onClick={handleEditSalaryClick}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Modifier le taux journalier"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-base font-semibold text-gray-900">
                    {formatPrice(salary.dailyRate, salary.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
                Gains
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm text-gray-600">Salaire de base</span>
                  <span className="text-base font-medium text-gray-900">
                    {formatPrice(salary.earnings.baseSalary, salary.currency)}
                  </span>
                </div>
                {salary.earnings.overtimePay > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Heures supplémentaires</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.earnings.overtimePay, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.earnings.bonuses > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Primes</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.earnings.bonuses, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.earnings.allowances > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Indemnités</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.earnings.allowances, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.earnings.otherEarnings > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Autres gains</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.earnings.otherEarnings, salary.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                  <span className="text-base font-semibold text-gray-900">Total gains</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatPrice(salary.earnings.totalEarnings, salary.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5 text-red-600" />
                Déductions
              </h2>
              <div className="space-y-3">
                {salary.deductions.taxes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Impôts</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.deductions.taxes, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.deductions.socialSecurity > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Sécurité sociale</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.deductions.socialSecurity, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.deductions.insurance > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Assurance</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.deductions.insurance, salary.currency)}
                    </span>
                  </div>
                )}
                
                {/* Advances Table */}
                <div className="py-2 border-b">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-700">Avances</span>
                    <button
                      onClick={handleAddAdvanceClick}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      title="Ajouter une avance"
                    >
                      <span className="text-lg">+</span>
                      <span>Ajouter</span>
                    </button>
                  </div>
                  
                  {salary.deductions.advancesList && salary.deductions.advancesList.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Montant</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Notes</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {salary.deductions.advancesList.map((advance, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap">
                                {formatDate(advance.date)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                                {formatPrice(advance.amount, salary.currency)}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {advance.notes || '-'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteAdvance(index)}
                                  className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                                  title="Supprimer"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-gray-700 text-right">
                              Total Avances:
                            </td>
                            <td className="px-3 py-2 text-sm font-bold text-gray-900">
                              {formatPrice(salary.deductions.advances || 0, salary.currency)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-gray-500">
                      Aucune avance enregistrée
                    </div>
                  )}
                </div>

                {salary.deductions.otherDeductions > 0 && (
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-gray-600">Autres déductions</span>
                    <span className="text-base font-medium text-gray-900">
                      {formatPrice(salary.deductions.otherDeductions, salary.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                  <span className="text-base font-semibold text-gray-900">Total déductions</span>
                  <span className="text-lg font-bold text-red-600">
                    {formatPrice(salary.deductions.totalDeductions, salary.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Net Salary Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
              <h3 className="text-sm font-medium text-blue-100 mb-2">Salaire net</h3>
              <p className="text-3xl font-bold mb-4">
                {formatPrice(salary.netSalary, salary.currency)}
              </p>
              <div className="pt-4 border-t border-blue-500">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-100">Gains totaux</span>
                    <span className="font-medium">{formatPrice(salary.earnings.totalEarnings, salary.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-100">Déductions</span>
                    <span className="font-medium">{formatPrice(salary.deductions.totalDeductions, salary.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations de paiement</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Méthode de paiement</p>
                  <p className="text-base font-medium text-gray-900">
                    {getPaymentMethodLabel(salary.paymentMethod)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Statut</p>
                  <div className="mt-1">
                    {getPaymentStatusBadge(salary.paymentStatus)}
                  </div>
                </div>
                {salary.paymentDate && (
                  <div>
                    <p className="text-sm text-gray-600">Date de paiement</p>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(salary.paymentDate)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Salaire de base</p>
                  <p className="text-base font-medium text-gray-900">
                    {formatPrice(salary.baseSalary, salary.currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {salary.notes && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{salary.notes}</p>
              </div>
            )}

            {/* Dates */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dates</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600">Créé le</p>
                  <p className="font-medium text-gray-900">{formatDate(salary.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Modifié le</p>
                  <p className="font-medium text-gray-900">{formatDate(salary.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Salary Modal */}
      {showEditSalaryModal && salary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Modifier le salaire</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salaire de base ({salary.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.baseSalary}
                    onChange={(e) => setEditForm({ ...editForm, baseSalary: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Taux journalier ({salary.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.dailyRate}
                    onChange={(e) => setEditForm({ ...editForm, dailyRate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Calcul automatique: {formatPrice(salary.baseSalary / salary.totalDays, salary.currency)}/jour
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditSalaryModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleEditSalarySubmit}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Advance Modal */}
      {showAddAdvanceModal && salary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ajouter une avance</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant ({salary.currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newAdvance.amount}
                    onChange={(e) => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newAdvance.date}
                    onChange={(e) => setNewAdvance({ ...newAdvance, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    rows={3}
                    value={newAdvance.notes}
                    onChange={(e) => setNewAdvance({ ...newAdvance, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Notes sur cette avance..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddAdvanceModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddAdvanceSubmit}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Enregistrement...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

