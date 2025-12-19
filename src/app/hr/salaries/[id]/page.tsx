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
  paymentStatus: 'pending' | 'paid' | 'partial' | 'owing' | 'cancelled';
  paymentDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deductionsEnabled?: boolean;
}

export default function SalaryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [salary, setSalary] = useState<Salary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditSalaryModal, setShowEditSalaryModal] = useState(false);
  const [showEditAdvancesModal, setShowEditAdvancesModal] = useState(false);
  const [toggleDeductionsLoading, setToggleDeductionsLoading] = useState(false);
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

  const handleToggleDeductions = async () => {
    if (!salary) return;

    try {
      setToggleDeductionsLoading(true);
      const response = await fetch(`/api/hr/salaries/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId || '',
        },
        body: JSON.stringify({
          deductionsEnabled: !salary.deductionsEnabled,
        }),
      });

      if (response.ok) {
        toast.success(
          !salary.deductionsEnabled
            ? 'Déductions automatiques activées'
            : 'Déductions automatiques désactivées'
        );
        fetchSalary();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Impossible de mettre à jour les déductions');
      }
    } catch (error) {
      console.error('Error toggling deductions:', error);
      toast.error('Erreur lors de la mise à jour des déductions');
    } finally {
      setToggleDeductionsLoading(false);
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:text-green-300 dark:bg-green-900/40">
            <CheckCircleIcon className="w-4 h-4 mr-1" />
            Payé
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:text-blue-300 dark:bg-blue-900/40">
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            Paiement partiel
          </span>
        );
      case 'owing':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:text-orange-300 dark:bg-orange-900/40">
            <CurrencyDollarIcon className="w-4 h-4 mr-1" />
            Montant dû
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:text-red-300 dark:bg-red-900/40">
            <XCircleIcon className="w-4 h-4 mr-1" />
            Annulé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:text-yellow-300 dark:bg-yellow-900/40">
            <ClockIcon className="w-4 h-4 mr-1" />
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
        <div className="space-y-6 animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-8 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg h-40 p-6 border dark:border-gray-700" />
              <div className="bg-white dark:bg-gray-800 rounded-lg h-40 p-6 border dark:border-gray-700" />
              <div className="bg-white dark:bg-gray-800 rounded-lg h-60 p-6 border dark:border-gray-700" />
            </div>
            <div className="space-y-6">
              <div className="bg-blue-600 rounded-lg h-48 p-6" />
              <div className="bg-white dark:bg-gray-800 rounded-lg h-56 p-6 border dark:border-gray-700" />
            </div>
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
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Fiche de paie</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-gray-400" />
                Informations de l'employé
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Nom complet</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {salary.employeeId.firstName} {salary.employeeId.lastName}
                  </p>
                </div>
                {salary.employeeId.employeeNumber && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Numéro d'employé</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {salary.employeeId.employeeNumber}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Poste</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {salary.employeeId.position}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Département</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {salary.employeeId.department}
                  </p>
                </div>
              </div>
            </div>

            {/* Period Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-gray-400" />
                Période de paie
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Mois</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {getMonthName(salary.period.month)} {salary.period.year}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date de début</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {formatDate(salary.period.startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date de fin</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {formatDate(salary.period.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Jours totaux</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {salary.totalDays} jours
                  </p>
                </div>
              </div>
            </div>

            {/* Work Days */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-gray-400" />
                Jours de travail
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{salary.workedDays}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Jours travaillés</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{salary.absentDays}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Jours d'absence</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{salary.leaveDays}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Jours de congé</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{salary.totalDays}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total jours</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Taux journalier</span>
                    <button
                      onClick={handleEditSalaryClick}
                      className="p-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Modifier le taux journalier"
                    >
                      <PencilIcon className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {formatPrice(salary.dailyRate, salary.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                Gains
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Salaire de base</span>
                  <span className="text-base font-medium text-gray-900 dark:text-white">
                    {formatPrice(salary.earnings.baseSalary, salary.currency)}
                  </span>
                </div>
                {salary.earnings.overtimePay > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Heures supplémentaires</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.earnings.overtimePay, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.earnings.bonuses > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Primes</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.earnings.bonuses, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.earnings.allowances > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Indemnités</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.earnings.allowances, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.earnings.otherEarnings > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Autres gains</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.earnings.otherEarnings, salary.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200 dark:border-gray-600">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">Total gains</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatPrice(salary.earnings.totalEarnings, salary.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Deductions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <CurrencyDollarIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                  Déductions
                </h2>
                <button
                  onClick={handleToggleDeductions}
                  disabled={toggleDeductionsLoading}
                  className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${salary.deductionsEnabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {toggleDeductionsLoading
                    ? 'Patientez...'
                    : salary.deductionsEnabled
                      ? 'Désactiver'
                      : 'Activer'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {salary.deductionsEnabled
                  ? 'Les déductions automatiques (impôts 10% + sécurité sociale 9%) sont activées.'
                  : 'Désactivées par défaut. Activez-les si vous souhaitez appliquer les impôts et la sécurité sociale.'}
              </p>
              <div className="space-y-3">
                {salary.deductions.taxes > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Impôts</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.deductions.taxes, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.deductions.socialSecurity > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Sécurité sociale</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.deductions.socialSecurity, salary.currency)}
                    </span>
                  </div>
                )}
                {salary.deductions.insurance > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Assurance</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.deductions.insurance, salary.currency)}
                    </span>
                  </div>
                )}

                {/* Advances Table */}
                <div className="py-2 border-b dark:border-gray-700">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Avances</span>
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
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Montant</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Notes</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {salary.deductions.advancesList.map((advance, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                {formatDate(advance.date)}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                                {formatPrice(advance.amount, salary.currency)}
                              </td>
                              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                                {advance.notes || '-'}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteAdvance(index)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Supprimer"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">
                              Total Avances:
                            </td>
                            <td className="px-3 py-2 text-sm font-bold text-gray-900 dark:text-white">
                              {formatPrice(salary.deductions.advances || 0, salary.currency)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                      Aucune avance enregistrée
                    </div>
                  )}
                </div>

                {salary.deductions.otherDeductions > 0 && (
                  <div className="flex justify-between items-center py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Autres déductions</span>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {formatPrice(salary.deductions.otherDeductions, salary.currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200 dark:border-gray-600">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">Total déductions</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Informations de paiement</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Méthode de paiement</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {getPaymentMethodLabel(salary.paymentMethod)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Statut</p>
                  <div className="mt-1">
                    {getPaymentStatusBadge(salary.paymentStatus)}
                  </div>
                </div>
                {salary.paymentDate && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Date de paiement</p>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      {formatDate(salary.paymentDate)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Salaire de base</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {formatPrice(salary.baseSalary, salary.currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {salary.notes && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{salary.notes}</p>
              </div>
            )}

            {/* Dates */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dates</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Créé le</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(salary.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Modifié le</p>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(salary.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Salary Modal */}
      {showEditSalaryModal && salary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Modifier le salaire</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Salaire de base ({salary.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.baseSalary}
                    onChange={(e) => setEditForm({ ...editForm, baseSalary: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Taux journalier ({salary.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.dailyRate}
                    onChange={(e) => setEditForm({ ...editForm, dailyRate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Calcul automatique: {formatPrice(salary.baseSalary / salary.totalDays, salary.currency)}/jour
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditSalaryModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full border dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Ajouter une avance</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Montant ({salary.currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newAdvance.amount}
                    onChange={(e) => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newAdvance.date}
                    onChange={(e) => setNewAdvance({ ...newAdvance, date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes (optionnel)
                  </label>
                  <textarea
                    rows={3}
                    value={newAdvance.notes}
                    onChange={(e) => setNewAdvance({ ...newAdvance, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    placeholder="Notes sur cette avance..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddAdvanceModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
