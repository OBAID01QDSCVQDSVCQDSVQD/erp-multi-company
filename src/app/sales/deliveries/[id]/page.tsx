'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { DocumentTextIcon, ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Delivery {
  _id: string;
  numero: string;
  dateDoc: string;
  customerId?: string;
  dateLivraisonPrevue?: string;
  dateLivraisonReelle?: string;
  modePaiement?: string;
  totalTTC: number;
  totalBaseHT?: number;
  totalHT?: number;
  totalTVA: number;
  timbreFiscal?: number;
  devise?: string;
  lieuLivraison?: string;
  moyenTransport?: string;
  notes?: string;
  lignes?: any[];
}

export default function ViewDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchDelivery();
      fetchCompanySettings();
    }
  }, [tenantId, params.id]);

  const fetchDelivery = async () => {
    try {
      if (!tenantId) {
        console.error('No tenantId found');
        return;
      }
      console.log('Fetching delivery:', params.id, 'for tenant:', tenantId);
      setLoading(true);
      const response = await fetch(`/api/sales/deliveries/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Delivery data:', data);
        setDelivery(data);
        
        // Fetch customer if customerId exists
        if (data.customerId) {
          fetchCustomer(data.customerId);
        }
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast.error('Erreur lors du chargement du bon de livraison: ' + (errorData.error || 'Unknown'));
        router.push('/sales/deliveries');
      }
    } catch (err) {
      console.error('Error fetching delivery:', err);
      toast.error('Erreur lors du chargement du bon de livraison');
      router.push('/sales/deliveries');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomer = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Customer data:', data);
        setCustomer(data);
      }
    } catch (err) {
      console.error('Error fetching customer:', err);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const settings = await response.json();
        setCompanySettings(settings);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const handleDownloadPDF = async () => {
    if (!delivery) return;
    
    try {
      setGeneratingPDF(true);
      
      const response = await fetch(`/api/sales/deliveries/${delivery._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bon-de-livraison-${delivery.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF téléchargé avec succès');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Erreur lors du téléchargement du PDF');
    } finally {
      setGeneratingPDF(false);
    }
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

  if (!delivery) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Bon de livraison introuvable</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/sales/deliveries')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <DocumentTextIcon className="w-8 h-8" /> Bon de livraison {delivery.numero}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Créé le {new Date(delivery.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {generatingPDF ? 'Génération...' : 'Télécharger PDF'}
          </button>
        </div>

        {/* Company Header Info */}
        {companySettings?.societe && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-start gap-4">
              {/* Logo */}
              {companySettings.societe.logoUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={companySettings.societe.logoUrl}
                    alt="Company Logo"
                    className="h-24 w-24 object-contain"
                  />
                </div>
              )}
              
              {/* Company Info */}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{companySettings.societe.nom}</h2>
                {companySettings.societe.enTete?.slogan && (
                  <p className="text-sm text-gray-600 italic mt-1">{companySettings.societe.enTete.slogan}</p>
                )}
                <div className="mt-2 text-sm text-gray-600">
                  <p>{companySettings.societe.adresse.rue}, {companySettings.societe.adresse.ville} {companySettings.societe.adresse.codePostal}</p>
                  <p>{companySettings.societe.adresse.pays}</p>
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="text-right text-sm text-gray-600">
                {companySettings.societe.enTete?.telephone && (
                  <p>Tél: {companySettings.societe.enTete.telephone}</p>
                )}
                {companySettings.societe.enTete?.email && (
                  <p>Email: {companySettings.societe.enTete.email}</p>
                )}
                {companySettings.societe.enTete?.siteWeb && (
                  <p>Web: {companySettings.societe.enTete.siteWeb}</p>
                )}
                {companySettings.societe.enTete?.matriculeFiscal && (
                  <p>Matricule: {companySettings.societe.enTete.matriculeFiscal}</p>
                )}
              </div>
            </div>
          </div>
        )}

          {/* Delivery Details */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm text-gray-600">Numéro de bon de livraison</label>
              <p className="text-lg font-bold text-blue-600">{delivery.numero}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Date</label>
              <p className="text-lg font-medium">{new Date(delivery.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Date livraison prévue</label>
              <p className="text-lg font-medium">
                {delivery.dateLivraisonPrevue ? new Date(delivery.dateLivraisonPrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Date livraison réelle</label>
              <p className="text-lg font-medium">
                {delivery.dateLivraisonReelle ? new Date(delivery.dateLivraisonReelle).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            {delivery.lieuLivraison && (
              <div>
                <label className="text-sm text-gray-600">Lieu de livraison</label>
                <p className="text-lg font-medium">{delivery.lieuLivraison}</p>
              </div>
            )}
            {delivery.moyenTransport && (
              <div>
                <label className="text-sm text-gray-600">Moyen de transport</label>
                <p className="text-lg font-medium">{delivery.moyenTransport}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-600">Client</label>
              {customer ? (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-1">
                  <p className="text-lg font-medium text-gray-900">
                    {customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'N/A'}
                  </p>
                  {customer.matriculeFiscale && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Matricule fiscal:</span> {customer.matriculeFiscale}
                    </p>
                  )}
                  {customer.adresseFacturation && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Adresse:</span> {[
                        customer.adresseFacturation.ligne1,
                        customer.adresseFacturation.ligne2,
                        customer.adresseFacturation.codePostal,
                        customer.adresseFacturation.ville
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {customer.code && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Code:</span> {customer.code}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-lg font-medium">Chargement...</p>
              )}
            </div>
          </div>

          {/* Notes / Retours info */}
          {delivery.notes && (
            <div className="border-t border-gray-200 pt-4 mt-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Notes / Informations
              </label>
              <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">
                {delivery.notes}
              </div>
            </div>
          )}

          {/* Lines Table */}
          {delivery.lignes && delivery.lignes.length > 0 && (
            <div className="mt-6 space-y-4">
              {/* Desktop table */}
              <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Produit</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Qté</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Prix HT</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Remise %</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">TVA</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Total HT</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {delivery.lignes.map((line: any, index: number) => {
                        const displayText = line.estStocke === false && line.descriptionProduit 
                          ? line.descriptionProduit 
                          : line.designation;
                        
                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-pink-50'}>
                            <td className="px-4 py-3 text-sm">
                              {displayText ? (
                                <div dangerouslySetInnerHTML={{ __html: displayText }} />
                              ) : (
                                line.designation
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">{line.quantite}</td>
                            <td className="px-4 py-3 text-sm">{line.prixUnitaireHT?.toFixed(3)} {delivery.devise}</td>
                            <td className="px-4 py-3 text-sm">{line.remisePct || 0}%</td>
                            <td className="px-4 py-3 text-sm">{line.tvaPct || 0}%</td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {delivery.devise}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600">
                              {(((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {delivery.devise}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {delivery.lignes.map((line: any, index: number) => {
                  const displayText = line.estStocke === false && line.descriptionProduit 
                    ? line.descriptionProduit 
                    : line.designation;

                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 shadow-sm bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm font-semibold text-gray-900">{line.nom || 'Produit'}</div>
                        <div className="text-xs text-gray-500">{line.reference || '-'}</div>
                      </div>
                      <div className="text-sm text-gray-700 whitespace-pre-line mb-2">
                        {displayText || line.designation}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                        <div>Qté: <span className="font-semibold text-gray-900">{line.quantite}</span></div>
                        <div>Prix HT: <span className="font-semibold text-gray-900">{line.prixUnitaireHT?.toFixed(3)} {delivery.devise}</span></div>
                        <div>Remise: <span className="font-semibold text-gray-900">{line.remisePct || 0}%</span></div>
                        <div>TVA: <span className="font-semibold text-gray-900">{line.tvaPct || 0}%</span></div>
                      </div>
                      <div className="mt-2 text-sm flex justify-between">
                        <span className="font-medium text-gray-900">Total HT</span>
                        <span className="font-semibold text-gray-900">
                          {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {delivery.devise}
                        </span>
                      </div>
                      <div className="text-sm flex justify-between text-blue-600">
                        <span className="font-medium">Total TTC</span>
                        <span className="font-semibold">
                          {(((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {delivery.devise}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 flex justify-start md:justify-end">
            <div className="w-full md:w-80 bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total HT</span>
                <span className="font-medium text-gray-900">{(delivery.totalBaseHT || delivery.totalHT || 0).toFixed(3)} {delivery.devise}</span>
              </div>
              {(() => {
                // Calculate total remise from lines
                const totalRemise = delivery.lignes?.reduce((sum: number, line: any) => {
                  const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
                  const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
                  return sum + (lineHTBeforeDiscount - lineHT);
                }, 0) || 0;
                
                return totalRemise > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Total Remise</span>
                    <span className="font-medium text-red-600">-{totalRemise.toFixed(3)} {delivery.devise}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total TVA</span>
                <span className="font-medium text-gray-900">{delivery.totalTVA?.toFixed(3) || 0} {delivery.devise}</span>
              </div>
              <div className="border-t border-blue-200 pt-3 flex justify-between text-lg font-bold">
                <span className="text-gray-900">Total TTC</span>
                <span className="text-blue-600">{delivery.totalTTC?.toFixed(3)} {delivery.devise}</span>
              </div>
            </div>
          </div>
          
          {/* Mode de paiement at bottom left */}
          {delivery.modePaiement && (
            <div className="mt-4 text-left">
              <p className="text-xs text-red-600 font-medium">
                Mode de paiement: {delivery.modePaiement}
              </p>
            </div>
          )}
        </div>

        {/* Company Footer Info */}
        {companySettings?.societe && (
          <div className="border-t border-gray-300 pt-6 mt-6">
            {/* Footer content */}
            {(() => {
              const footerItems: string[] = [];

              // Adresse
              const addressParts = [
                companySettings.societe.adresse?.rue,
                companySettings.societe.adresse?.ville,
                companySettings.societe.adresse?.codePostal,
                companySettings.societe.adresse?.pays
              ].filter(Boolean);
              if (addressParts.length > 0) {
                footerItems.push(addressParts.join(', '));
              }

              // Téléphone
              if (companySettings.societe.enTete?.telephone) {
                footerItems.push(`Tél : ${companySettings.societe.enTete.telephone}`);
              }

              // Capital social
              if (companySettings.societe.enTete?.capitalSocial) {
                footerItems.push(`Capital social : ${companySettings.societe.enTete.capitalSocial}`);
              }

              // Banque + RIB (sur une même ligne)
              const banc = companySettings.societe.piedPage?.coordonneesBancaires;
              if (banc?.banque || banc?.rib) {
                const banquePart = banc.banque ? banc.banque : '';
                const ribPart = banc.rib ? `RIB : ${banc.rib}` : '';
                if (banquePart && ribPart) {
                  footerItems.push(`${banquePart}, ${ribPart}`);
                } else if (banquePart) {
                  footerItems.push(banquePart);
                } else if (ribPart) {
                  footerItems.push(ribPart);
                }
              }

              return footerItems.length > 0 ? (
                <div className="text-center text-sm text-gray-600">
                  {footerItems.join(' - ')}
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

