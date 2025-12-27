'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { DocumentTextIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ReturnDocument {
  _id: string;
  numero: string;
  dateDoc: string;
  customerId?: {
    _id: string;
    raisonSociale?: string;
    nom?: string;
    prenom?: string;
  } | string;
  blId?: string;
  blNumero?: string;
  totalBaseHT?: number;
  totalTVA?: number;
  totalTTC: number;
  devise?: string;
  notes?: string;
  lignes?: Array<{
    designation: string;
    quantite: number;
    prixUnitaireHT: number;
    remisePct?: number;
    tvaPct?: number;
    uomCode?: string;
  }>;
}

export default function ViewReturnPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [retour, setRetour] = useState<ReturnDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchReturn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, params.id]);

  const fetchReturn = async () => {
    try {
      if (!tenantId) return;
      setLoading(true);
      const response = await fetch(`/api/sales/returns/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setRetour(data);
      } else {
        const error = await response.json();
        toast.error(
          error.error || 'Erreur lors du chargement du bon de retour'
        );
        router.push('/sales/returns');
      }
    } catch (err) {
      console.error('Error fetching return:', err);
      toast.error('Erreur de connexion');
      router.push('/sales/returns');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customer: ReturnDocument['customerId']): string => {
    if (!customer) return 'N/A';
    if (typeof customer === 'object') {
      return (
        customer.raisonSociale ||
        `${customer.nom || ''} ${customer.prenom || ''}`.trim() ||
        'N/A'
      );
    }
    return 'N/A';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!retour) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Bon de retour introuvable</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => router.push('/sales/returns')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                <span className="break-words">Bon de retour {retour.numero}</span>
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Créé le{' '}
                {new Date(retour.dateDoc).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 space-y-6">
          {/* Top info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Numéro de retour</label>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{retour.numero}</p>
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Client</label>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {getCustomerName(retour.customerId)}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">BL source</label>
              {retour.blId && retour.blNumero ? (
                <Link
                  href={`/sales/deliveries/${retour.blId}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  {retour.blNumero}
                </Link>
              ) : (
                <p className="text-lg font-medium text-gray-900 dark:text-white">N/A</p>
              )}
            </div>

            {retour.notes && (
              <div className="md:col-span-1">
                <label className="text-sm text-gray-600 dark:text-gray-400">Notes</label>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mt-1">
                  {retour.notes}
                </p>
              </div>
            )}
          </div>

          {/* Lines */}
          {retour.lignes && retour.lignes.length > 0 && (
            <div className="mt-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Lignes de retour
              </h2>
              <div className="hidden md:block overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">
                        Désignation
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">
                        Qté
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">
                        Prix HT
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">
                        Remise %
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">
                        TVA
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">
                        Total HT
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {retour.lignes.map((line, index) => {
                      const remise = line.remisePct || 0;
                      const prixHT =
                        (line.prixUnitaireHT || 0) * (1 - remise / 100);
                      const montantHT = prixHT * (line.quantite || 0);
                      return (
                        <tr
                          key={index}
                          className={`
                            ${index % 2 === 0 ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-pink-50 dark:bg-pink-900/10'}
                            hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                          `}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.designation}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.quantite}{' '}
                            {line.uomCode ? ` ${line.uomCode}` : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.prixUnitaireHT?.toFixed(3)}{' '}
                            {retour.devise || 'TND'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {remise ? `${remise}%` : '0%'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {line.tvaPct || 0}%
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {montantHT.toFixed(3)} {retour.devise || 'TND'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {retour.lignes.map((line, index) => {
                  const remise = line.remisePct || 0;
                  const prixHT = (line.prixUnitaireHT || 0) * (1 - remise / 100);
                  const montantHT = prixHT * (line.quantite || 0);

                  return (
                    <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-900 dark:text-white text-sm">{line.designation}</div>
                        {line.uomCode && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                            {line.uomCode}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 mb-3">
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Qté</span>
                          <span className="font-medium text-gray-900 dark:text-white">{line.quantite}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Prix Unitaire</span>
                          <span className="font-medium text-gray-900 dark:text-white">{line.prixUnitaireHT?.toFixed(3)}</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">Remise</span>
                          <span className="font-medium text-gray-900 dark:text-white">{remise}%</span>
                        </div>
                        <div>
                          <span className="block text-gray-500 dark:text-gray-400">TVA</span>
                          <span className="font-medium text-gray-900 dark:text-white">{line.tvaPct || 0}%</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total HT</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {montantHT.toFixed(3)} {retour.devise || 'TND'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 flex justify-start sm:justify-end">
            <div className="w-full sm:w-80 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm top-info-row">
                <span className="text-gray-700 dark:text-gray-300">Total HT</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(retour.totalBaseHT || 0).toFixed(3)}{' '}
                  {retour.devise || 'TND'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Total TVA</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(retour.totalTVA || 0).toFixed(3)} {retour.devise || 'TND'}
                </span>
              </div>
              <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between text-lg font-bold">
                <span className="text-gray-900 dark:text-white">Total TTC</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {(retour.totalTTC || 0).toFixed(3)}{' '}
                  {retour.devise || 'TND'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}












