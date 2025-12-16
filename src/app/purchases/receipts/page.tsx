'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, ClipboardDocumentCheckIcon, MagnifyingGlassIcon, EyeIcon, ArrowDownTrayIcon, PencilIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Reception {
  _id: string;
  numero: string;
  dateDoc: string;
  fournisseurNom: string;
  statut: 'BROUILLON' | 'VALIDE' | 'ANNULE';
  totaux: {
    totalHT: number;
    fodec?: number;
    totalTVA: number;
    timbre?: number;
    totalTTC: number;
  };
  fodecActif?: boolean;
  timbreActif?: boolean;
}

export default function ReceiptsPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [receptions, setReceptions] = useState<Reception[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statutFilter, setStatutFilter] = useState<string>('');

  useEffect(() => {
    if (tenantId) fetchReceptions();
  }, [tenantId, statutFilter]);

  async function fetchReceptions() {
    if (!tenantId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.append('search', q);
      if (statutFilter) params.append('statut', statutFilter);
      
      const response = await fetch(`/api/purchases/receptions?${params.toString()}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      
      if (response.ok) {
        const data = await response.json();
        setReceptions(data.items || []);
      } else {
        toast.error('Erreur lors du chargement des réceptions');
      }
    } catch (error) {
      console.error('Error fetching receptions:', error);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  const filteredReceptions = receptions.filter((reception) => {
    if (!q) return true;
    const searchLower = q.toLowerCase();
    return (
      reception.numero.toLowerCase().includes(searchLower) ||
      reception.fournisseurNom.toLowerCase().includes(searchLower)
    );
  });

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'VALIDE':
        return 'bg-green-100 text-green-800';
      case 'ANNULE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatutLabel = (statut: string) => {
    switch (statut) {
      case 'VALIDE':
        return 'Validé';
      case 'ANNULE':
        return 'Annulé';
      default:
        return 'Brouillon';
    }
  };

  if (!tenantId) {
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
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
              title="Retour à la page précédente"
            >
              <ArrowLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="w-6 h-6 sm:w-8 sm:h-8" />
              <span className="whitespace-nowrap">Bons de réception</span>
            </h1>
          </div>
          <button
            onClick={() => router.push('/purchases/receptions/new')}
            className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Nouvelle réception</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par numéro ou fournisseur..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm sm:text-base"
            />
          </div>
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm sm:text-base"
          >
            <option value="">Tous les statuts</option>
            <option value="BROUILLON">Brouillon</option>
            <option value="VALIDE">Validé</option>
            <option value="ANNULE">Annulé</option>
          </select>
        </div>

        {/* Receptions list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredReceptions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun bon de réception</h3>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer votre premier bon de réception.
            </p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N° BR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fournisseur</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReceptions.map((reception) => (
                    <tr key={reception._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-blue-600">{reception.numero}</div>
                          {(reception.fodecActif || reception.timbreActif) && (
                            <div className="flex items-center gap-1">
                              {reception.fodecActif && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="FODEC activé">
                                  F
                                </span>
                              )}
                              {reception.timbreActif && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Timbre fiscal activé">
                                  T
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(reception.dateDoc).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{reception.fournisseurNom}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {reception.totaux?.totalTTC?.toFixed(3) || '0.000'} DT
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatutColor(reception.statut)}`}>
                          {getStatutLabel(reception.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/purchases/receptions/${reception._id}`)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded transition-colors"
                            title="Voir"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => router.push(`/purchases/receptions/${reception._id}/edit`)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"
                            title="Modifier"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/purchases/receptions/${reception._id}/pdf`, {
                                  headers: { 'X-Tenant-Id': tenantId },
                                });
                                if (response.ok) {
                                  const blob = await response.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `Reception-${reception.numero}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                  toast.success('PDF téléchargé avec succès');
                                }
                              } catch (error) {
                                console.error('Error downloading PDF:', error);
                                toast.error('Erreur lors du téléchargement du PDF');
                              }
                            }}
                            className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors"
                            title="Télécharger PDF"
                          >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-200">
              {filteredReceptions.map((reception) => (
                <div key={reception._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-blue-600">{reception.numero}</div>
                        {(reception.fodecActif || reception.timbreActif) && (
                          <div className="flex items-center gap-1">
                            {reception.fodecActif && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="FODEC activé">
                                F
                              </span>
                            )}
                            {reception.timbreActif && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Timbre fiscal activé">
                                T
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(reception.dateDoc).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatutColor(reception.statut)}`}>
                      {getStatutLabel(reception.statut)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-900 mb-2">{reception.fournisseurNom}</div>
                  <div className="text-sm font-medium text-gray-900 mb-3">
                    Total: {reception.totaux?.totalTTC?.toFixed(3) || '0.000'} DT
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/purchases/receptions/${reception._id}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Voir
                    </button>
                    <button
                      onClick={() => router.push(`/purchases/receptions/${reception._id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Modifier
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/purchases/receptions/${reception._id}/pdf`, {
                            headers: { 'X-Tenant-Id': tenantId },
                          });
                          if (response.ok) {
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `Reception-${reception.numero}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                            toast.success('PDF téléchargé avec succès');
                          }
                        } catch (error) {
                          console.error('Error downloading PDF:', error);
                          toast.error('Erreur lors du téléchargement du PDF');
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
