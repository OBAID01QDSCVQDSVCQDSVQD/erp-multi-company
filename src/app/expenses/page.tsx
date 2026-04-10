'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ExpenseCategoryModal from '@/components/ExpenseCategoryModal';
import { useTenantId } from '@/hooks/useTenantId';
import { PlusIcon, FunnelIcon, DocumentArrowDownIcon, CogIcon, EyeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
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
    _source?: 'tenant' | 'global';
  };
  description?: string;
  montant: number;
  devise: string;
  tvaPct: number;
  tvaAmount?: number;
  tva?: number;
  fodec?: number;
  timbre?: number;
  timbreFiscal?: number;
  baseHT?: number;
  totalHT?: number;
  totalTTC?: number;
  modePaiement: string;
  isDeclared?: boolean;
  statut: string;
  fournisseurId?: {
    _id: string;
    name: string;
  };
  employeId?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  projetId?: {
    _id: string;
    name: string;
  };
  piecesJointes: Array<{
    nom: string;
    url: string;
    type: string;
  }>;
  createdAt: string;
  createdBy?: {
    _id: string;
    firstName?: string;
    lastName?: string;
  } | null;
}

interface ExpenseCategory {
  _id: string;
  code: string;
  nom: string;
  description?: string;
  icone?: string;
  typeGlobal?: string;
  _source?: 'tenant' | 'global';
}

const statutColors = {
  brouillon: 'bg-gray-100 text-gray-800',
  en_attente: 'bg-yellow-100 text-yellow-800',
  valide: 'bg-green-100 text-green-800',
  paye: 'bg-blue-100 text-blue-800',
  rejete: 'bg-red-100 text-red-800',
};

const modePaiementLabels = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
  carte: 'Carte',
  autre: 'Autre',
};

// Suggestions de catégories prédéfinies
const categorySuggestions = [
  { code: 'DEP_TRANSPORT', nom: 'Transport & Déplacements', description: 'Frais de taxi, carburant, péages, billets de train, parking…', icone: '🚗', typeGlobal: 'exploitation' },
  { code: 'DEP_RESTAURATION', nom: 'Repas & Restauration', description: 'Repas professionnels, collations, cafés…', icone: '🍽️', typeGlobal: 'exploitation' },
  { code: 'DEP_HEBERGEMENT', nom: 'Hébergement & Séjours', description: 'Hôtels, locations temporaires pour missions…', icone: '🏨', typeGlobal: 'exploitation' },
  { code: 'DEP_FOURNITURE', nom: 'Fournitures de bureau', description: 'Papier, stylos, imprimantes, cartouches, classeurs…', icone: '🖇️', typeGlobal: 'exploitation' },
  { code: 'DEP_MATERIEL_CONSOM', nom: 'Matériel consommé', description: 'Petits matériaux utilisés dans le service (vis, colle, peinture…)', icone: '🧰', typeGlobal: 'consommable' },
  { code: 'DEP_ENTRETIEN', nom: 'Entretien & Nettoyage', description: 'Produits d\'entretien, services de ménage, maintenance…', icone: '🧼', typeGlobal: 'exploitation' },
  { code: 'DEP_COMMUNICATION', nom: 'Téléphone & Internet', description: 'Abonnements, téléphones, cartes SIM, fibre, hébergement web…', icone: '📞', typeGlobal: 'exploitation' },
  { code: 'DEP_ENERGIE', nom: 'Électricité & Eau', description: 'Factures d\'électricité, gaz, eau…', icone: '💡', typeGlobal: 'exploitation' },
  { code: 'DEP_LOCATION', nom: 'Loyer & Charges locatives', description: 'Loyer, assurance, taxes locales, copropriété…', icone: '🏢', typeGlobal: 'exploitation' },
  { code: 'DEP_SALAIRE', nom: 'Salaires & Charges sociales', description: 'Rémunérations, cotisations, primes, intérimaires…', icone: '👷', typeGlobal: 'exploitation' },
  { code: 'DEP_FORMATION', nom: 'Formation & Séminaires', description: 'Formations, conférences, certifications…', icone: '🎓', typeGlobal: 'exploitation' },
  { code: 'DEP_MARKETING', nom: 'Marketing & Publicité', description: 'Flyers, réseaux sociaux, campagnes en ligne, impression…', icone: '📣', typeGlobal: 'exploitation' },
  { code: 'DEP_BANQUE', nom: 'Frais bancaires', description: 'Commissions, virements, intérêts, agios…', icone: '💳', typeGlobal: 'financier' },
  { code: 'DEP_ASSURANCE', nom: 'Assurances', description: 'Assurance responsabilité, véhicules, locaux…', icone: '🛡️', typeGlobal: 'exploitation' },
  { code: 'DEP_INFORMATIQUE', nom: 'Informatique & Logiciels', description: 'Licences, hébergements, logiciels, maintenance IT…', icone: '💻', typeGlobal: 'exploitation' },
  { code: 'DEP_INVEST', nom: 'Matériel durable / Investissement', description: 'Achat de machines, outils, véhicules, ordinateurs…', icone: '🏗️', typeGlobal: 'investissement' },
  { code: 'DEP_CONSULTANT', nom: 'Honoraires & Prestations externes', description: 'Comptable, avocat, consultant, sous-traitant…', icone: '🧾', typeGlobal: 'exploitation' },
  { code: 'DEP_EXCEP', nom: 'Dépenses exceptionnelles', description: 'Amendes, dons, pertes, réparations urgentes…', icone: '⚠️', typeGlobal: 'exceptionnel' },
  { code: 'DEP_DIVERS', nom: 'Autres dépenses', description: 'Toute autre dépense non catégorisée', icone: '📁', typeGlobal: 'exploitation' },
];

export default function ExpensesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { tenantId } = useTenantId();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    periode: '',
    categorieId: '',
    statut: '',
    isDeclared: '',
    projetId: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSuggestion, setAppliedSuggestion] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [suggestionData, setSuggestionData] = useState<any>(null);
  const [demoTab, setDemoTab] = useState<'registered' | 'suggestions'>('registered');

  useEffect(() => {
    if (tenantId) {
      fetchExpenses();
      fetchCategories();
    }
  }, [filters, tenantId, pagination.page]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();

      if (filters.periode) queryParams.append('periode', filters.periode);
      if (filters.categorieId) queryParams.append('categorieId', filters.categorieId);
      if (filters.statut) queryParams.append('statut', filters.statut);
      if (filters.isDeclared) queryParams.append('isDeclared', filters.isDeclared);
      if (filters.projetId) queryParams.append('projetId', filters.projetId);
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/expenses?${queryParams}`, {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Expenses data received:', {
          expensesCount: data.expenses?.length || 0,
          pagination: data.pagination,
          total: data.pagination?.total || 0
        });

        // Log first expense to see structure
        if (data.expenses && data.expenses.length > 0) {
          console.log('First expense structure:', data.expenses[0]);
        }

        // Update state first
        setExpenses(data.expenses || []);
        if (data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: data.pagination.total,
            pages: data.pagination.pages,
          }));
        }
        // Clear error on success
        setError('');

        // Keep loading for a brief moment to ensure smooth transition
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // Only log error, don't show to user
        const errorData = await response.json().catch(() => ({}));
        console.error('Erreur lors du chargement des dépenses:', response.status, errorData);
        setExpenses([]);
        setError(''); // Don't show error message to user
      }
    } catch (err) {
      // Only log error, don't show to user
      console.error('Erreur de connexion:', err);
      setExpenses([]);
      setError(''); // Don't show error message to user
    } finally {
      // Set loading to false after all updates are complete
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/expense-categories', {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      } else {
        const errorData = await response.json();
        console.error('Erreur API:', errorData);
        setError(`Erreur lors du chargement des catégories: ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des catégories:', err);
      setError('Erreur de connexion lors du chargement des catégories');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'categorieId' && value === 'create') {
      handleCreateCategory();
      return;
    }
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      periode: '',
      categorieId: '',
      statut: '',
      isDeclared: '',
      projetId: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategorySuccess = () => {
    fetchCategories();
    setShowCategoryModal(false);
    setEditingCategory(null);
    setSuccessMessage('Catégorie sauvegardée avec succès !');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCategoryError = (error: string) => {
    setError(`Erreur lors de la sauvegarde de la catégorie: ${error}`);
    // Garder la modale ouverte pour que l'utilisateur puisse corriger
  };

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const handleViewExpense = (expenseId: string) => {
    router.push(`/expenses/${expenseId}`);
  };

  const handleEditExpense = (expenseId: string) => {
    router.push(`/expenses/${expenseId}/edit`);
  };

  const applySuggestion = (suggestion: typeof categorySuggestions[0]) => {
    // Pour les suggestions, on ne passe pas editingCategory pour forcer la création
    setEditingCategory(null);
    setSuggestionData(suggestion); // Passer les données de suggestion
    setShowCategoryModal(true);

    // Afficher un message de confirmation
    setAppliedSuggestion(suggestion.nom);
    setTimeout(() => setAppliedSuggestion(null), 3000);
  };

  const filteredSuggestions = categorySuggestions.filter(suggestion =>
    suggestion.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suggestion.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suggestion.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPrice = (price: number, currency: string = 'TND', decimals: number = 3) => {
    // Utiliser toLocaleString pour un formatage correct avec espaces insécables
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(price);
    const currencySymbol = currency === 'TND' ? 'TND' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    // Utiliser un espace insécable (\u00A0) pour éviter le retour à la ligne
    return `${formatted}\u00A0${currencySymbol}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
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

    console.log('Changing status for expense:', expenseId, 'to:', newStatus);
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

      console.log('Response status:', response.status);

      if (response.ok) {
        const updatedData = await response.json();
        console.log('Updated expense:', updatedData);
        toast.success('Statut mis à jour avec succès');
        // Rafraîchir les données pour s'assurer de la cohérence
        await fetchExpenses();
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la mise à jour:', errorData);
        toast.error(errorData.error || 'Erreur lors de la mise à jour du statut');
        // Recharger les données pour annuler le changement local
        await fetchExpenses();
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      toast.error('Erreur de connexion lors de la mise à jour du statut');
      // Recharger les données pour annuler le changement local
      await fetchExpenses();
    }
  };

  // Show loading state
  if (loading && expenses.length === 0) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="sm:flex sm:items-center sm:justify-between">
            <div>
              <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Loading spinner */}
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 dark:border-indigo-500 mx-auto mb-4"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Chargement des dépenses...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title="Retour à la page précédente"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💸 Dépenses</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Gérez les dépenses de votre entreprise
              </p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filtres
            </button>
            <Link
              href="/expenses/categories-manage"
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <CogIcon className="h-5 w-5 mr-2" />
              Gérer les catégories
            </Link>
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <EyeIcon className="h-5 w-5 mr-2" />
              {showDemo ? 'Masquer' : 'Voir'} Catégories
            </button>
            <Link
              href="/expenses/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nouvelle dépense
            </Link>
          </div>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Période
                </label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD,YYYY-MM-DD"
                  value={filters.periode}
                  onChange={(e) => handleFilterChange('periode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Catégorie
                </label>
                <select
                  value={filters.categorieId}
                  onChange={(e) => handleFilterChange('categorieId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.icone} {category.nom} {category._source === 'global' ? '(Globale)' : ''}
                    </option>
                  ))}
                  <option value="create" className="text-indigo-600 dark:text-indigo-400 font-medium">
                    ➕ Créer une catégorie…
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Statut
                </label>
                <select
                  value={filters.statut}
                  onChange={(e) => handleFilterChange('statut', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Tous les statuts</option>
                  <option value="brouillon">Brouillon</option>
                  <option value="en_attente">En attente</option>
                  <option value="valide">Validé</option>
                  <option value="paye">Payé</option>
                  <option value="rejete">Rejeté</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Justification
                </label>
                <select
                  value={filters.isDeclared}
                  onChange={(e) => handleFilterChange('isDeclared', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Tous</option>
                  <option value="true">Justifiée</option>
                  <option value="false">Non justifiée</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Effacer les filtres
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Demo Catégories */}
        {showDemo && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🎯 Catégories</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Découvrez les catégories de dépenses disponibles. Cliquez sur une catégorie pour l'utiliser dans le formulaire de création.
                </p>
              </div>
              <button
                onClick={() => setShowDemo(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Onglets */}
            <div className="mb-6">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setDemoTab('registered')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${demoTab === 'registered'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                  >
                    📋 Catégories Enregistrées ({categories.length})
                  </button>
                  <button
                    onClick={() => setDemoTab('suggestions')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${demoTab === 'suggestions'
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                  >
                    💡 Suggestions Prédéfinies ({categorySuggestions.length})
                  </button>
                </nav>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rechercher une catégorie
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tapez 'transport', 'restaurant', 'informatique'..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Grille des catégories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {demoTab === 'registered' ? (
                // Catégories enregistrées
                categories
                  .filter(category =>
                    category.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((category) => (
                    <div
                      key={category._id}
                      onClick={() => applySuggestion({
                        nom: category.nom,
                        code: category.code,
                        typeGlobal: category.typeGlobal,
                        icone: category.icone || '💸',
                        description: category.description || ''
                      })}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-gray-700 group"
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{category.icone || '💸'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {category.nom}
                            </h4>
                            <span className="text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                              {category.code}
                            </span>
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                              {category.typeGlobal}
                            </span>
                            {category._source === 'global' && (
                              <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 px-2 py-1 rounded">
                                Globale
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {category.description || 'Aucune description'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                // Suggestions prédéfinies
                filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => applySuggestion(suggestion)}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all duration-200 hover:bg-indigo-50 dark:hover:bg-gray-700 group"
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{suggestion.icone}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {suggestion.nom}
                          </h4>
                          <span className="text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                            {suggestion.code}
                          </span>
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                            {suggestion.typeGlobal}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {suggestion.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message si aucune catégorie trouvée */}
            {((demoTab === 'registered' && categories.filter(category =>
              category.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
              category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
            ).length === 0) ||
              (demoTab === 'suggestions' && filteredSuggestions.length === 0)) && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">
                    {demoTab === 'registered' ? '📝' : '💡'}
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {searchTerm
                      ? 'Aucune catégorie trouvée'
                      : demoTab === 'registered'
                        ? 'Aucune catégorie enregistrée'
                        : 'Aucune suggestion trouvée'
                    }
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {searchTerm
                      ? 'Essayez avec d\'autres mots-clés ou effacez la recherche'
                      : demoTab === 'registered'
                        ? 'Commencez par créer votre première catégorie de dépenses'
                        : 'Aucune suggestion ne correspond à votre recherche'
                    }
                  </p>
                  {!searchTerm && demoTab === 'registered' && (
                    <button
                      onClick={handleCreateCategory}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    >
                      <PlusIcon className="h-5 w-5 mr-2" />
                      Créer une catégorie
                    </button>
                  )}
                </div>
              )}

            {/* Message de confirmation */}
            {appliedSuggestion && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-800 dark:text-green-300">
                    ✅ Catégorie "{appliedSuggestion}" appliquée avec succès ! La fenêtre de création s'ouvre...
                  </span>
                </div>
              </div>
            )}

            {/* Statistiques */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>
                  {demoTab === 'registered' ? (
                    <>
                      {categories.filter(category =>
                        category.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
                      ).length} catégorie{categories.filter(category =>
                        category.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
                      ).length !== 1 ? 's' : ''} trouvée{categories.filter(category =>
                        category.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        category.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
                      ).length !== 1 ? 's' : ''}
                    </>
                  ) : (
                    <>
                      {filteredSuggestions.length} suggestion{filteredSuggestions.length !== 1 ? 's' : ''} trouvée{filteredSuggestions.length !== 1 ? 's' : ''}
                    </>
                  )}
                </span>
                <span>
                  Total: {demoTab === 'registered' ? categories.length : categorySuggestions.length} {demoTab === 'registered' ? 'catégories enregistrées' : 'suggestions disponibles'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {/* Success message */}
        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-800 dark:text-green-300">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-400 hover:text-green-600 dark:hover:text-green-300 ml-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Error message - Hidden by default, only shown if explicitly needed */}
        {false && error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Expenses Table */}
        {expenses.length === 0 && !loading ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
            <div className="text-6xl mb-4">💸</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Aucune dépense</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Commencez par créer votre première dépense.
            </p>
            <div className="mt-6">
              <Link
                href="/expenses/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Nouvelle dépense
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop View: Table */}
            <div className="hidden sm:block bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md border dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Numéro
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                        Catégorie
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Projet
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Justification
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total TTC
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {expenses.map((expense) => (
                      <tr key={expense._id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white">
                          {expense.numero}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          {expense.categorieId.icone || '💸'} {expense.categorieId.nom}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {expense.projetId?.name || '-'}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs">
                          {expense.isDeclared === false ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              Non justifiée
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              Justifiée
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {expense.createdBy
                            ? `${expense.createdBy.firstName || ''} ${expense.createdBy.lastName || ''}`.trim() || '-'
                            : '-'}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white" style={{ whiteSpace: 'nowrap' }}>
                          {formatPrice(expense.totalTTC || expense.montant || 0, expense.devise || 'TND')}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
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
                                className={`text-xs font-semibold rounded-full px-1.5 py-0.5 border-0 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} focus:outline-none focus:ring-2 focus:ring-indigo-500 ${expense.statut === 'paye' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                                  expense.statut === 'valide' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                    expense.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
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
                        <td className="px-2 py-2 whitespace-nowrap text-xs">
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleViewExpense(expense._id)}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                            >
                              Voir
                            </button>
                            <button
                              onClick={() => handleEditExpense(expense._id)}
                              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 font-medium"
                            >
                              Modifier
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View: Cards */}
            <div className="sm:hidden space-y-4">
              {expenses.map((expense) => (
                <div key={expense._id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 border dark:border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">{formatDate(expense.date)}</span>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{expense.numero}</h4>
                    </div>
                    {expense.isDeclared === false ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        Non justifiée
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        Justifiée
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center text-sm">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Catégorie:</span>
                      <span className="text-gray-900 dark:text-white font-medium truncate">
                        {expense.categorieId.icone || '💸'} {expense.categorieId.nom}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Projet:</span>
                      <span className="text-gray-900 dark:text-white truncate">{expense.projetId?.name || '-'}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Utilisateur:</span>
                      <span className="text-gray-900 dark:text-white truncate">
                        {expense.createdBy
                          ? `${expense.createdBy.firstName || ''} ${expense.createdBy.lastName || ''}`.trim() || '-'
                          : '-'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-20 text-gray-500 dark:text-gray-400">Total TTC:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {formatPrice(expense.totalTTC || expense.montant || 0, expense.devise || 'TND')}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t dark:border-gray-700">
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
                          className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} focus:outline-none focus:ring-2 focus:ring-indigo-500 ${expense.statut === 'paye' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                            expense.statut === 'valide' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                              expense.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
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

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewExpense(expense._id)}
                        className="p-1 text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        title="Voir"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEditExpense(expense._id)}
                        className="p-1 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                        title="Modifier"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 00 2 2h11a2 2 0 00 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6 rounded-b-md shadow-b border-x dark:border-x-gray-700">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Affichage de <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> à{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      sur <span className="font-medium">{pagination.total}</span> résultats
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Précédent</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {/* Page numbers */}
                      {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((pageNum) => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          pageNum === 1 ||
                          pageNum === pagination.pages ||
                          (pageNum >= pagination.page - 1 && pageNum <= pagination.page + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${pageNum === pagination.page
                                ? 'z-10 bg-indigo-50 dark:bg-indigo-900 border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-300'
                                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          pageNum === pagination.page - 2 ||
                          pageNum === pagination.page + 2
                        ) {
                          return (
                            <span
                              key={pageNum}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.pages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Suivant</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modale de catégorie */}
        <ExpenseCategoryModal
          isOpen={showCategoryModal}
          onClose={() => {
            setShowCategoryModal(false);
            setSuggestionData(null);
          }}
          onSuccess={handleCategorySuccess}
          onError={handleCategoryError}
          editingCategory={editingCategory}
          suggestionData={suggestionData}
          tenantId={tenantId}
        />
      </div>
    </DashboardLayout>
  );
}
