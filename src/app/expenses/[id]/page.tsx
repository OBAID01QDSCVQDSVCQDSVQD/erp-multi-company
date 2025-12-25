'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { useTenantId } from '@/hooks/useTenantId';
import { ArrowLeftIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import ImageGallery, { ImageItem } from '@/components/common/ImageGallery';
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
  isDeclared?: boolean;
  description?: string;
  centreCoutId?: {
    _id: string;
    code: string;
    nom: string;
  };
  projetId?: {
    _id: string;
    name: string;
  };
  montantType: 'HT' | 'TTC';
  montant: number;
  devise: string;
  taxCode: string;
  tvaPct: number;
  tvaDeductiblePct: number;
  fodecActif: boolean;
  fodecRate: number;
  fodecBase: 'avantRemise' | 'apresRemise';
  retenueActif: boolean;
  retenueRate: number;
  retenueBase: 'TTC_TIMBRE';
  timbreFiscal: number;
  remiseGlobalePct: number;
  modePaiement: string;
  fournisseurId?: {
    _id: string;
    type: 'societe' | 'particulier';
    raisonSociale?: string;
    nom?: string;
    prenom?: string;
  };
  employeId?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  referencePiece?: string;
  notesInterne?: string;
  statut: string;
  // Calculated totals
  baseHT: number;
  fodec: number;
  remise: number;
  baseHTApresRemise: number;
  tvaBase: number;
  tva: number;
  tvaNonDeductible: number;
  retenue: number;
  totalHT: number;
  totalTaxes: number;
  totalTTC: number;
  netADecaisser: number;
  piecesJointes: Array<{
    nom: string;
    url: string;
    publicId?: string;
    type: string;
    taille: number;
    uploadedAt: string;
    width?: number;
    height?: number;
    format?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const statutColors = {
  brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  valide: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  paye: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  rejete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const modePaiementLabels = {
  especes: 'Espèces',
  cheque: 'Chèque',
  virement: 'Virement',
  carte: 'Carte',
  autre: 'Autre',
};

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (params.id && tenantId) {
      fetchExpense();
    }
  }, [params.id, tenantId]);

  const fetchExpense = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/expenses/${params.id}`, {
        headers: {
          'X-Tenant-Id': tenantId || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExpense(data);
      } else {
        setError('Erreur lors du chargement de la dépense');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'TND') => {
    // Format with 3 decimal places for TND
    if (currency === 'TND') {
      return `${amount.toFixed(3)} ${currency}`;
    }
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/expenses/${expense?._id}`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-Id': tenantId || '',
        },
      });

      if (response.ok) {
        toast.success('Dépense supprimée avec succès');
        router.push('/expenses');
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Erreur lors de la suppression';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } catch (err) {
      setError('Erreur de connexion lors de la suppression');
    } finally {
      setLoading(false);
    }
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

  if (error || !expense) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Erreur</h3>
          <p className="mt-1 text-sm text-gray-500">{error || 'Dépense non trouvée'}</p>
          <div className="mt-6">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Retour
            </button>
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
          <div className="flex items-center">
            <button
              onClick={() => router.back()}
              className="mr-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{expense.numero}</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Dépense créée le {formatDate(expense.createdAt)}
              </p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={() => router.push(`/expenses/${expense._id}/edit`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <PencilIcon className="h-5 w-5 mr-2" />
              Modifier
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-800 rounded-md shadow-sm text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashIcon className="h-5 w-5 mr-2" />
              Supprimer
            </button>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statutColors[expense.statut as keyof typeof statutColors]}`}>
            {expense.statut.replace('_', ' ')}
          </span>
          {expense.isDeclared === false && (
            <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-600 text-white">
              Non justifiée (Sans justificatif)
            </span>
          )}
          {expense.isDeclared !== false && (
            <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              Justifiée
            </span>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informations principales */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Informations générales</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatDate(expense.date)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Catégorie</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    <span className="text-lg mr-2">{expense.categorieId.icone || '💸'}</span>
                    {expense.categorieId.nom} ({expense.categorieId.code})
                  </dd>
                </div>
                {expense.description && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.description}</dd>
                  </div>
                )}
                {expense.centreCoutId && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Centre de coût</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {expense.centreCoutId.code} - {expense.centreCoutId.nom}
                    </dd>
                  </div>
                )}
                {expense.projetId && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Projet/Chantier</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.projetId.name}</dd>
                  </div>
                )}
                {expense.fournisseurId && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Fournisseur</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {expense.fournisseurId.type === 'societe'
                        ? expense.fournisseurId.raisonSociale
                        : `${expense.fournisseurId.nom || ''} ${expense.fournisseurId.prenom || ''}`.trim()}
                    </dd>
                  </div>
                )}
                {expense.employeId && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Employé</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {expense.employeId.firstName} {expense.employeId.lastName}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Montant et TVA */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Montant et TVA</h3>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type de montant</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.montantType}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Montant ({expense.montantType})</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(expense.montant, expense.devise)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Devise</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.devise}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Code TVA</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.taxCode} ({expense.tvaPct}%)</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">TVA Déductible (%)</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.tvaDeductiblePct}%</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Mode de paiement</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {modePaiementLabels[expense.modePaiement as keyof typeof modePaiementLabels]}
                  </dd>
                </div>
                {expense.referencePiece && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Référence pièce / N° facture fournisseur</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.referencePiece}</dd>
                  </div>
                )}
              </dl>

              {/* FODEC */}
              {expense.fodecActif && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">FODEC</h4>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Taux</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{expense.fodecRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Base de calcul</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {expense.fodecBase === 'avantRemise' ? 'Avant remise' : 'Après remise'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Retenue */}
              {expense.retenueActif && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Retenue à la source</h4>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Taux</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{expense.retenueRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Base de calcul</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">TTC - Timbre fiscal</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Remise globale */}
              {expense.remiseGlobalePct > 0 && (
                <div className="mt-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Remise globale</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{expense.remiseGlobalePct}%</dd>
                </div>
              )}

              {/* Timbre fiscal */}
              {expense.timbreFiscal > 0 && (
                <div className="mt-4">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Timbre fiscal</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">{formatCurrency(expense.timbreFiscal, expense.devise)}</dd>
                </div>
              )}
            </div>

            {/* Notes internes */}
            {expense.notesInterne && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Notes internes</h3>
                <p className="text-sm text-gray-900 dark:text-white">{expense.notesInterne}</p>
              </div>
            )}

            {/* Pièces jointes - Images seulement */}
            {expense.piecesJointes && expense.piecesJointes.length > 0 && (
              (() => {
                // Filtrer uniquement les images
                const images = expense.piecesJointes
                  .filter(file => file.type.startsWith('image/'))
                  .map((file, index) => ({
                    id: `${file.url}-${index}`,
                    name: file.nom,
                    url: file.url,
                    publicId: file.publicId,
                    type: file.type,
                    size: file.taille,
                    width: file.width,
                    height: file.height,
                    format: file.format,
                  }));

                // Afficher les fichiers non-images (PDF, etc.) dans une liste
                const nonImages = expense.piecesJointes.filter(file => !file.type.startsWith('image/'));

                return (
                  <>
                    {images.length > 0 && (
                      <ImageGallery images={images} title="Images jointes" />
                    )}
                    {nonImages.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Autres pièces jointes</h3>
                        <div className="space-y-3">
                          {nonImages.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <span className="text-2xl">
                                    {file.type === 'application/pdf' ? '📄' : '📎'}
                                  </span>
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{file.nom}</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {formatFileSize(file.taille)} • {formatDate(file.uploadedAt)}
                                  </p>
                                </div>
                              </div>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm font-medium"
                              >
                                Ouvrir
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Totaux calculés</h3>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Base HT:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(expense.baseHT, expense.devise)}</span>
                </div>
                {expense.remise > 0 && (
                  <div className="flex justify-between py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Remise:</span>
                    <span className="text-sm font-medium text-red-600">-{formatCurrency(expense.remise, expense.devise)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Base HT après remise:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(expense.baseHTApresRemise, expense.devise)}</span>
                </div>
                {expense.fodec > 0 && (
                  <div className="flex justify-between py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">FODEC:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(expense.fodec, expense.devise)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">TVA ({expense.tvaPct}%):</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(expense.tva, expense.devise)}</span>
                </div>
                {expense.tvaNonDeductible > 0 && (
                  <div className="flex justify-between py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">TVA non déductible:</span>
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400">{formatCurrency(expense.tvaNonDeductible, expense.devise)}</span>
                  </div>
                )}
                {expense.timbreFiscal > 0 && (
                  <div className="flex justify-between py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Timbre fiscal:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(expense.timbreFiscal, expense.devise)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total HT:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(expense.totalHT, expense.devise)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-300 dark:border-gray-600">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">Total TTC:</span>
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(expense.totalTTC, expense.devise)}</span>
                </div>
                {expense.retenue > 0 && (
                  <div className="flex justify-between py-2 border-b dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Retenue à la source:</span>
                    <span className="text-sm font-medium text-orange-600 dark:text-orange-400">{formatCurrency(expense.retenue, expense.devise)}</span>
                  </div>
                )}
                {expense.retenue > 0 && (
                  <div className="flex justify-between py-3 border-t-2 border-gray-300 dark:border-gray-600 mt-2">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">Net à décaisser:</span>
                    <span className="text-base font-bold text-green-600 dark:text-green-400">{formatCurrency(expense.netADecaisser, expense.devise)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
