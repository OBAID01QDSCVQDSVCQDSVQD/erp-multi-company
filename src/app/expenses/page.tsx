'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import ExpenseCategoryModal from '@/components/ExpenseCategoryModal';
import { useTenantId } from '@/hooks/useTenantId';
import { PlusIcon, FunnelIcon, DocumentArrowDownIcon, CogIcon, EyeIcon } from '@heroicons/react/24/outline';

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
  description: string;
  montant: number;
  devise: string;
  tvaPct: number;
  modePaiement: string;
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
  const { tenantId } = useTenantId();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    periode: '',
    categorieId: '',
    statut: '',
    projetId: '',
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
  }, [filters, tenantId]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.periode) queryParams.append('periode', filters.periode);
      if (filters.categorieId) queryParams.append('categorieId', filters.categorieId);
      if (filters.statut) queryParams.append('statut', filters.statut);
      if (filters.projetId) queryParams.append('projetId', filters.projetId);

      const response = await fetch(`/api/expenses?${queryParams}`, {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setExpenses(data.expenses || []);
      } else {
        setError('Erreur lors du chargement des dépenses');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
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
  };

  const clearFilters = () => {
    setFilters({
      periode: '',
      categorieId: '',
      statut: '',
      projetId: '',
    });
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

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💸 Dépenses</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérez les dépenses de votre entreprise
            </p>
          </div>
          <div className="mt-4 sm:mt-0 space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filtres
            </button>
            <Link
              href="/expenses/categories-manage"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <CogIcon className="h-5 w-5 mr-2" />
              Gérer les catégories
            </Link>
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <EyeIcon className="h-5 w-5 mr-2" />
              {showDemo ? 'Masquer' : 'Voir'} Catégories
            </button>
            <Link
              href="/expenses/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nouvelle dépense
            </Link>
          </div>
        </div>

        {/* Filtres */}
        {showFilters && (
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Période
                </label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD,YYYY-MM-DD"
                  value={filters.periode}
                  onChange={(e) => handleFilterChange('periode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={filters.categorieId}
                  onChange={(e) => handleFilterChange('categorieId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.icone} {category.nom} {category._source === 'global' ? '(Globale)' : ''}
                    </option>
                  ))}
                  <option value="create" className="text-indigo-600 font-medium">
                    ➕ Créer une catégorie…
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Statut
                </label>
                <select
                  value={filters.statut}
                  onChange={(e) => handleFilterChange('statut', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Tous les statuts</option>
                  <option value="brouillon">Brouillon</option>
                  <option value="en_attente">En attente</option>
                  <option value="valide">Validé</option>
                  <option value="paye">Payé</option>
                  <option value="rejete">Rejeté</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Effacer les filtres
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Demo Catégories */}
        {showDemo && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">🎯 Catégories</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Découvrez les catégories de dépenses disponibles. Cliquez sur une catégorie pour l'utiliser dans le formulaire de création.
                </p>
              </div>
              <button
                onClick={() => setShowDemo(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Onglets */}
            <div className="mb-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setDemoTab('registered')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      demoTab === 'registered'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    📋 Catégories Enregistrées ({categories.length})
                  </button>
                  <button
                    onClick={() => setDemoTab('suggestions')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      demoTab === 'suggestions'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    💡 Suggestions Prédéfinies ({categorySuggestions.length})
                  </button>
                </nav>
              </div>
            </div>

            {/* Barre de recherche */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher une catégorie
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tapez 'transport', 'restaurant', 'informatique'..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                      className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-200 hover:bg-indigo-50 group"
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{category.icone || '💸'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-gray-900 text-sm truncate">
                              {category.nom}
                            </h4>
                            <span className="text-gray-400 group-hover:text-indigo-500 transition-colors">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {category.code}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {category.typeGlobal}
                            </span>
                            {category._source === 'global' && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                Globale
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">
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
                  className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all duration-200 hover:bg-indigo-50 group"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{suggestion.icone}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900 text-sm truncate">
                          {suggestion.nom}
                        </h4>
                        <span className="text-gray-400 group-hover:text-indigo-500 transition-colors">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {suggestion.code}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {suggestion.typeGlobal}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm 
                    ? 'Aucune catégorie trouvée' 
                    : demoTab === 'registered' 
                      ? 'Aucune catégorie enregistrée'
                      : 'Aucune suggestion trouvée'
                  }
                </h3>
                <p className="text-sm text-gray-500 mb-4">
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
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Créer une catégorie
                  </button>
                )}
              </div>
            )}

            {/* Message de confirmation */}
            {appliedSuggestion && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-800">
                    ✅ Catégorie "{appliedSuggestion}" appliquée avec succès ! La fenêtre de création s'ouvre...
                  </span>
                </div>
              </div>
            )}

            {/* Statistiques */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-500">
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
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-800">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-green-400 hover:text-green-600 ml-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 ml-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Expenses list */}
        {expenses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💸</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucune dépense</h3>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer votre première dépense.
            </p>
            <div className="mt-6">
              <Link
                href="/expenses/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Nouvelle dépense
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {expenses.map((expense) => (
                <li key={expense._id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 font-medium">
                            {expense.categorieId.icone || '💸'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {expense.numero}
                          </p>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statutColors[expense.statut as keyof typeof statutColors]}`}>
                            {expense.statut.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-gray-500">
                            {expense.description}
                          </p>
                          <p className="text-sm text-gray-500">
                            {expense.categorieId.nom} {expense.categorieId._source === 'global' && '(Globale)'} • {modePaiementLabels[expense.modePaiement as keyof typeof modePaiementLabels]} • {formatDate(expense.date)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(expense.montant, expense.devise)}
                        </p>
                        <p className="text-sm text-gray-500">
                          TVA: {expense.tvaPct}%
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleViewExpense(expense._id)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                        >
                          Voir
                        </button>
                        <button 
                          onClick={() => handleEditExpense(expense._id)}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                        >
                          Modifier
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
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
