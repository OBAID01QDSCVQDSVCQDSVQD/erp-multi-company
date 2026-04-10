'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import {
  ArrowLeftIcon,
  CurrencyEuroIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  FunnelIcon,
  BanknotesIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Expense {
  _id: string;
  numero: string;
  date: string;
  categorieId: {
    _id: string;
    nom: string;
    code: string;
    icone?: string;
  };
  totalTTC: number;
  devise: string;
  statut: string;
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  paidBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  } | null;
  paidAt?: string;
  approvedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  } | null;
  approvedAt?: string;
}

interface Advance {
  _id?: string;
  date: string;
  amount: number;
  notes?: string;
  createdBy?: string;
  repaidBy?: string;
  repaidAt?: string;
  isRepaid?: boolean;
  salaryId?: string;
  advanceIndex?: number;
  employeeId?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  currency: string;
}

interface Statistics {
  totalExpenses: number;
  totalAdvances: number;
  completedExpenses: number;
  completedAdvances: number;
  pendingAdvances: number;
}

const statutLabels = {
  brouillon: 'Brouillon',
  en_attente: 'En attente',
  valide: 'Validé',
  paye: 'Payé',
  rejete: 'Rejeté',
};

const statutColors = {
  brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  valide: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  paye: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  rejete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const months = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function ProfileExpensesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [globalUnpaid, setGlobalUnpaid] = useState({ expenses: 0, advances: 0, total: 0 });
  const [statistics, setStatistics] = useState<Statistics>({
    totalExpenses: 0,
    totalAdvances: 0,
    completedExpenses: 0,
    completedAdvances: 0,
    pendingAdvances: 0,
  });
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedType, setSelectedType] = useState<'all' | 'expenses' | 'advances'>('all');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchData();
    }
  }, [tenantId, selectedMonth, selectedYear, selectedType]);

  const fetchData = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (selectedMonth) queryParams.append('month', selectedMonth.toString());
      queryParams.append('year', selectedYear.toString());
      queryParams.append('type', selectedType);

      const response = await fetch(`/api/profile/expenses?${queryParams}`, {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('API Response Data:', data);
        setExpenses(data.expenses || []);
        setAdvances(data.advances || []);
        setStatistics(data.statistics || {
          totalExpenses: 0,
          totalAdvances: 0,
          completedExpenses: 0,
          completedAdvances: 0,
          pendingAdvances: 0,
        });
        setGlobalUnpaid(data.globalUnpaid || { expenses: 0, advances: 0, total: 0 });
        setIsAdmin(data.isAdmin || false);
      } else {
        console.error('Erreur lors du chargement des données');
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string = 'TND') => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(amount) + ' ' + currency;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const unpaidTotals = useMemo(() => {
    const expensesTotal = expenses
      .filter(exp => exp.statut !== 'paye')
      .reduce((sum, exp) => sum + (exp.totalTTC || 0), 0);

    const advancesTotal = advances
      .filter(adv => !adv.isRepaid)
      .reduce((sum, adv) => sum + (adv.amount || 0), 0);

    return {
      expenses: expensesTotal,
      advances: advancesTotal,
      total: expensesTotal + advancesTotal
    };
  }, [expenses, advances]);

  const getStatutBadge = (statut: string) => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statutColors[statut as keyof typeof statutColors]}`}>
        {statutLabels[statut as keyof typeof statutLabels] || statut}
      </span>
    );
  };

  const handleStatusChange = async (expenseId: string, newStatus: string) => {
    // Vérifier que l'utilisateur est admin
    const userRole = session?.user?.role;
    const userPermissions = session?.user?.permissions || [];
    const isAdmin = userRole === 'admin' || userPermissions.includes('all');

    if (!isAdmin) {
      toast.error('Seuls les administrateurs peuvent modifier le statut');
      return;
    }

    // Trouver la dépense actuelle pour vérifier son statut
    const currentExpense = expenses.find(exp => exp._id === expenseId);
    if (currentExpense?.statut === 'paye' && newStatus !== 'paye') {
      toast.error('Impossible de modifier le statut d\'une dépense déjà payée');
      return;
    }

    try {
      // Mettre à jour l'état local immédiatement pour un feedback visuel rapide
      setExpenses(prevExpenses =>
        prevExpenses.map(exp =>
          exp._id === expenseId ? { ...exp, statut: newStatus } : exp
        )
      );

      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ statut: newStatus }),
      });

      if (response.ok) {
        const updatedData = await response.json();
        toast.success('Statut mis à jour avec succès');
        // Rafraîchir les données pour s'assurer de la cohérence
        await fetchData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors de la mise à jour du statut');
        // Recharger les données pour annuler le changement local
        await fetchData();
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      toast.error('Erreur de connexion lors de la mise à jour du statut');
      // Recharger les données pour annuler le changement local
      await fetchData();
    }
  };

  const handleAdvanceStatusChange = async (advance: Advance, newStatus: boolean) => {
    if (!advance.salaryId || advance.advanceIndex === undefined) {
      toast.error('Données invalides pour cette avance');
      return;
    }

    // Vérifier que l'utilisateur est admin
    const userRole = session?.user?.role;
    const userPermissions = session?.user?.permissions || [];
    const isAdminUser = userRole === 'admin' || userPermissions.includes('all');

    if (!isAdminUser) {
      toast.error('Seuls les administrateurs peuvent modifier le statut des avances');
      return;
    }

    try {
      // Mettre à jour l'état local immédiatement pour un feedback visuel rapide
      setAdvances(prevAdvances =>
        prevAdvances.map(adv =>
          adv.salaryId === advance.salaryId && adv.advanceIndex === advance.advanceIndex
            ? { ...adv, isRepaid: newStatus }
            : adv
        )
      );

      const response = await fetch(`/api/hr/salaries/${advance.salaryId}/advances/${advance.advanceIndex}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRepaid: newStatus }),
      });

      if (response.ok) {
        toast.success('Statut de l\'avance mis à jour avec succès');
        // Rafraîchir les données pour s'assurer de la cohérence
        await fetchData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erreur lors de la mise à jour du statut');
        // Recharger les données pour annuler le changement local
        await fetchData();
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      toast.error('Erreur de connexion lors de la mise à jour du statut');
      // Recharger les données pour annuler le changement local
      await fetchData();
    }
  };

  const StatsCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis">
            {value}
          </p>
          {subtext && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0"></span>
              <span className="truncate">{subtext}</span>
            </p>
          )}
        </div>
        <div className={`p-3 sm:p-4 rounded-xl ${color} shadow-sm shrink-0`}>
          <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isAdmin ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                  {isAdmin ? (
                    <BanknotesIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <CurrencyEuroIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {isAdmin ? 'Toutes les Dépenses' : 'Dépenses Personnelles'}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {isAdmin ? (
                      <>
                        <UserIcon className="w-4 h-4" />
                        Vue d'ensemble de toutes les dépenses et avances
                      </>
                    ) : (
                      <>
                        <UserIcon className="w-4 h-4" />
                        {session?.user?.name || 'Utilisateur'}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alert for Unpaid Totals */}
        {/* Alert for Global Unpaid Totals - Stays visible regardless of month filter */}
        {globalUnpaid.total > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm mb-6 animate-pulse-subtle">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  Rappel : Paiements en attente (Total Global)
                </h3>
                <div className="mt-1 text-sm text-amber-700 dark:text-amber-400 font-medium">
                  <p>
                    {isAdmin
                      ? "Il y a un total global de "
                      : "Vous avez un reliquat total de "}
                    <span className="text-lg font-black text-amber-900 dark:text-amber-200 mx-1 whitespace-nowrap">
                      {formatPrice(globalUnpaid.total, 'TND')}
                    </span>
                    à régulariser (toutes périodes confondues).
                  </p>
                  <div className="mt-1 flex flex-wrap gap-4 text-xs opacity-80 font-bold">
                    <span className="whitespace-nowrap">• {isAdmin ? 'Total Dépenses' : 'Mes Dépenses'}: {formatPrice(globalUnpaid.expenses, 'TND')}</span>
                    <span className="whitespace-nowrap">• {isAdmin ? 'Total Avances' : 'Mes Avances'}: {formatPrice(globalUnpaid.advances, 'TND')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filtres</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                Mois
              </label>
              <select
                value={selectedMonth || ''}
                onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white transition-all shadow-sm"
              >
                <option value="">Tous</option>
                {months.map((month, index) => (
                  <option key={index} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
                Année
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white transition-all shadow-sm"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                <FunnelIcon className="w-3.5 h-3.5 text-indigo-500" />
                Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as 'all' | 'expenses' | 'advances')}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white transition-all shadow-sm"
              >
                <option value="all">Tout</option>
                <option value="expenses">Dépenses</option>
                <option value="advances">Avances</option>
              </select>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Total Dépenses"
            value={formatPrice(statistics.totalExpenses, 'TND')}
            icon={CurrencyEuroIcon}
            color="bg-indigo-500"
          />
          <StatsCard
            title="Total Avances"
            value={formatPrice(statistics.totalAdvances, 'TND')}
            icon={BanknotesIcon}
            color="bg-blue-600"
          />
          <StatsCard
            title="Dépenses Complétées"
            value={formatPrice(statistics.completedExpenses, 'TND')}
            icon={CheckCircleIcon}
            color="bg-green-500"
            subtext="Payées ou validées"
          />
          <StatsCard
            title="Avances Complétées"
            value={formatPrice(statistics.completedAdvances, 'TND')}
            icon={CheckCircleIcon}
            color="bg-emerald-500"
            subtext="Remboursées"
          />
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <nav className="flex -mb-px px-4">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-6 py-4 text-sm font-semibold border-b-2 transition-all ${selectedType === 'all'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Tout
              </button>
              <button
                onClick={() => setSelectedType('expenses')}
                className={`px-6 py-4 text-sm font-semibold border-b-2 transition-all ${selectedType === 'expenses'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <CurrencyEuroIcon className="w-4 h-4" />
                  Dépenses
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded-full">
                    {expenses.length}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setSelectedType('advances')}
                className={`px-6 py-4 text-sm font-semibold border-b-2 transition-all ${selectedType === 'advances'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <BanknotesIcon className="w-4 h-4" />
                  Avances
                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded-full">
                    {advances.length}
                  </span>
                </span>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Expenses Table */}
            {(selectedType === 'all' || selectedType === 'expenses') && expenses.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Dépenses
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Numéro</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Catégorie</th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Créé par</th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Montant</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Payé</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Payé par</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Date paiement</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {expenses.map((expense) => (
                        <tr key={expense._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(expense.date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {expense.numero}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {expense.categorieId.icone || '💸'} {expense.categorieId.nom}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {expense.createdBy
                                ? `${expense.createdBy.firstName || ''} ${expense.createdBy.lastName || ''}`.trim() || expense.createdBy.email
                                : '-'}
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(expense.totalTTC || 0, expense.devise || 'TND')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {(() => {
                              const userRole = session?.user?.role;
                              const userPermissions = session?.user?.permissions || [];
                              const isAdmin = userRole === 'admin' || userPermissions.includes('all');
                              const isDisabled = !isAdmin || expense.statut === 'paye';

                              return (
                                <select
                                  value={expense.statut}
                                  onChange={(e) => handleStatusChange(expense._id, e.target.value)}
                                  disabled={isDisabled}
                                  className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} focus:outline-none focus:ring-2 focus:ring-indigo-500 ${expense.statut === 'paye'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                    : expense.statut === 'valide'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                      : expense.statut === 'en_attente'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                        : expense.statut === 'rejete'
                                          ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                  <option value="brouillon">Brouillon</option>
                                  <option value="en_attente">En attente</option>
                                  <option value="valide">Validé</option>
                                  <option value="paye">Payé</option>
                                  <option value="rejete">Rejeté</option>
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {expense.statut === 'paye' ? (
                              <span className="text-green-600 dark:text-green-400">✅ Oui</span>
                            ) : (
                              <span className="text-gray-400">❌ Non</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {expense.paidBy
                              ? `${expense.paidBy.firstName} ${expense.paidBy.lastName}`
                              : expense.statut === 'paye'
                                ? '-'
                                : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {expense.paidAt ? formatDateTime(expense.paidAt) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Advances Table */}
            {(selectedType === 'all' || selectedType === 'advances') && advances.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Avances
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Employé</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Montant</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Notes</th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Créé par</th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Statut</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Remboursé</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Remboursé par</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Date remboursement</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {advances.map((advance, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatDate(advance.date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {advance.employeeId
                              ? `${advance.employeeId.firstName} ${advance.employeeId.lastName}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(advance.amount || 0, advance.currency || 'TND')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {advance.notes || '-'}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {advance.createdBy || '-'}
                            </td>
                          )}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {(() => {
                              const userRole = session?.user?.role;
                              const userPermissions = session?.user?.permissions || [];
                              const isAdmin = userRole === 'admin' || userPermissions.includes('all');

                              return (
                                <select
                                  value={advance.isRepaid ? 'true' : 'false'}
                                  onChange={(e) => handleAdvanceStatusChange(advance, e.target.value === 'true')}
                                  disabled={!isAdmin}
                                  className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${!isAdmin ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} focus:outline-none focus:ring-2 focus:ring-indigo-500 ${advance.isRepaid
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                    }`}
                                >
                                  <option value="false">⏳ Non remboursé</option>
                                  <option value="true">✅ Remboursé</option>
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {advance.isRepaid ? (
                              <span className="text-green-600 dark:text-green-400">✅ Oui</span>
                            ) : (
                              <span className="text-gray-400">❌ Non</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {advance.repaidBy || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {advance.repaidAt ? formatDateTime(advance.repaidAt) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty State */}
            {((selectedType === 'all' && expenses.length === 0 && advances.length === 0) ||
              (selectedType === 'expenses' && expenses.length === 0) ||
              (selectedType === 'advances' && advances.length === 0)) && (
                <div className="text-center py-12">
                  <CurrencyEuroIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aucune donnée</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Aucune dépense ou avance trouvée pour cette période.
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
