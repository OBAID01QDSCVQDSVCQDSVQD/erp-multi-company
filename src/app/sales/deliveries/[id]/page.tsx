'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { DocumentTextIcon, ArrowLeftIcon, ArrowDownTrayIcon, ChatBubbleLeftEllipsisIcon, PhoneIcon, MagnifyingGlassIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
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
  matriculeTransport?: string;
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

  // WhatsApp Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [includeStamp, setIncludeStamp] = useState(true);

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
          const custId = typeof data.customerId === 'object' ? data.customerId._id : data.customerId;
          fetchCustomer(custId);
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

  // WhatsApp Logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (clientSearchQuery.trim()) {
        setSearchingClients(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(clientSearchQuery)}&type=client`, {
            headers: { 'X-Tenant-Id': tenantId || '' }
          });
          if (res.ok) {
            const data = await res.json();
            setClientSearchResults(Array.isArray(data) ? data : data.results || []);
          }
        } catch (error) {
          console.error("Error searching clients", error);
        } finally {
          setSearchingClients(false);
        }
      } else {
        setClientSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [clientSearchQuery, tenantId]);

  const handleOpenWhatsAppModal = async () => {
    if (!delivery) return;
    setWhatsAppNumber('');
    setIncludeStamp(true);

    // Check if we have customer loaded
    if (customer && (customer.mobile || customer.telephone)) {
      let phone = customer.mobile || customer.telephone || '';
      let clean = phone.replace(/\D/g, '');
      if (clean.length === 8) clean = '216' + clean;
      setWhatsAppNumber(clean);
    } else if (delivery.customerId && tenantId && !customer) {
      // Fetch if not already fetched
      try {
        const custId = typeof delivery.customerId === 'object' ? (delivery.customerId as any)._id : delivery.customerId;
        const res = await fetch(`/api/customers/${custId}`, {
          headers: { 'X-Tenant-Id': tenantId }
        });
        if (res.ok) {
          const data = await res.json();
          let phone = data.mobile || data.telephone || '';
          let clean = phone.replace(/\D/g, '');
          if (clean.length === 8) clean = '216' + clean;
          setWhatsAppNumber(clean);
        }
      } catch (e) {
        console.error("Error fetching customer for whatsapp", e);
      }
    }

    setClientSearchQuery('');
    setClientSearchResults([]);
    setShowWhatsAppModal(true);
  };

  const confirmWhatsAppSend = async () => {
    if (!delivery || !whatsAppNumber) return;

    let numberToSend = whatsAppNumber.replace(/\D/g, '');
    if (numberToSend.length === 8) numberToSend = '216' + numberToSend;

    // Generate public link
    let publicLink = '';
    const toastId = toast.loading('Génération du lien...');

    try {
      const res = await fetch(`/api/sales/deliveries/${delivery._id}/share`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        // Use window.location.origin to get correct domain (localhost or production)
        publicLink = `${window.location.origin}/i/${data.token}?withStamp=${includeStamp}`;
      }
    } catch (e) {
      console.error("Error generating public link", e);
      toast.error("Erreur génération lien", { id: toastId });
    }

    const customerName = (customer && (customer.raisonSociale || customer.nom)) || delivery.customerId || 'Cher Client';
    const companyName = companySettings?.societe?.nom || 'notre société';

    let message = `Bonjour ${customerName}, de la part de ${companyName} : Voici votre bon de livraison ${delivery.numero} du ${new Date(delivery.dateDoc).toLocaleDateString('fr-FR')} pour un montant de ${delivery.totalTTC.toFixed(3)} ${delivery.devise || 'TND'}.`;

    if (publicLink) {
      message += `\n\n📄 Télécharger votre document ici : ${publicLink}`;
    }

    const url = `https://api.whatsapp.com/send?phone=${numberToSend}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    toast.dismiss(toastId);
    setShowWhatsAppModal(false);
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => router.push('/sales/deliveries')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                <DocumentTextIcon className="w-6 h-6 sm:w-8 sm:h-8" />
                <span className="break-words">Bon de livraison {delivery.numero}</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                Créé le {new Date(delivery.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base self-start sm:self-auto"
          >
            {generatingPDF ? (
              <>
                <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Génération du PDF...</span>
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Télécharger PDF</span>
              </>
            )}
          </button>

          <button
            onClick={handleOpenWhatsAppModal}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base self-start sm:self-auto"
          >
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            WhatsApp
          </button>
        </div>

        {/* Company Header Info */}
        {companySettings?.societe && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              {/* Logo */}
              {companySettings.societe.logoUrl && (
                <div className="flex-shrink-0 mx-auto sm:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={companySettings.societe.logoUrl}
                    alt="Company Logo"
                    className="h-16 w-16 sm:h-24 sm:w-24 object-contain"
                  />
                </div>
              )}

              {/* Company Info */}
              <div className="flex-1 text-center sm:text-left">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{companySettings.societe.nom}</h2>
                {companySettings.societe.enTete?.slogan && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-1">{companySettings.societe.enTete.slogan}</p>
                )}
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>{companySettings.societe.adresse.rue}, {companySettings.societe.adresse.ville} {companySettings.societe.adresse.codePostal}</p>
                  <p>{companySettings.societe.adresse.pays}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="text-center sm:text-right text-sm text-gray-600 dark:text-gray-400 w-full sm:w-auto">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Numéro de bon de livraison</label>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{delivery.numero}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Date</label>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{new Date(delivery.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Date livraison prévue</label>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {delivery.dateLivraisonPrevue ? new Date(delivery.dateLivraisonPrevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Date livraison réelle</label>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {delivery.dateLivraisonReelle ? new Date(delivery.dateLivraisonReelle).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            {delivery.lieuLivraison && (
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Lieu de livraison</label>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{delivery.lieuLivraison}</p>
              </div>
            )}
            {delivery.matriculeTransport && (
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400">Matricule camion</label>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{delivery.matriculeTransport}</p>
              </div>
            )}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="text-sm text-gray-600 dark:text-gray-400">Client</label>
              {customer ? (
                <div
                  onClick={() => router.push(`/customers/${customer._id}`)}
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3 md:p-4 shadow-sm space-y-2 mt-1 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <p className="text-base md:text-lg font-semibold text-gray-900 dark:text-white leading-snug">
                    {customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'N/A'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm text-gray-700 dark:text-gray-300">
                    {customer.matriculeFiscale && (
                      <p>
                        <span className="font-medium">Matricule fiscal: </span>{customer.matriculeFiscale}
                      </p>
                    )}
                    {customer.code && (
                      <p>
                        <span className="font-medium">Code: </span>{customer.code}
                      </p>
                    )}
                    {customer.adresseFacturation && (
                      <div className="sm:col-span-2">
                        <span className="font-medium">Adresse: </span>
                        {[
                          customer.adresseFacturation.ligne1,
                          customer.adresseFacturation.ligne2,
                          customer.adresseFacturation.codePostal,
                          customer.adresseFacturation.ville
                        ].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-lg font-medium text-gray-500">Chargement...</p>
              )}
            </div>
          </div>

          {/* Notes / Retours info */}
          {delivery.notes && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Notes / Informations
              </label>
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                {delivery.notes}
              </div>
            </div>
          )}

          {/* Lines Table */}
          {delivery.lignes && delivery.lignes.length > 0 && (
            <div className="mt-6 space-y-4">
              {/* Desktop table */}
              <div className="hidden md:block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Produit</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Qté</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Prix HT</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Remise %</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">TVA</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Total HT</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-200">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {delivery.lignes.map((line: any, index: number) => {
                        const displayText = line.estStocke === false && line.descriptionProduit
                          ? line.descriptionProduit
                          : line.designation;

                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-pink-50 dark:bg-pink-900/10'}>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                              {displayText ? (
                                <div dangerouslySetInnerHTML={{ __html: displayText }} />
                              ) : (
                                line.designation
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{line.quantite}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{line.prixUnitaireHT?.toFixed(3)} {delivery.devise}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{line.remisePct || 0}%</td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{line.tvaPct || 0}%</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {delivery.devise}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">
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
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm bg-white dark:bg-gray-800">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{line.nom || 'Produit'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{line.reference || '-'}</div>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line mb-2">
                        {displayText || line.designation}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <div>Qté: <span className="font-semibold text-gray-900 dark:text-white">{line.quantite}</span></div>
                        <div>Prix HT: <span className="font-semibold text-gray-900 dark:text-white">{line.prixUnitaireHT?.toFixed(3)} {delivery.devise}</span></div>
                        <div>Remise: <span className="font-semibold text-gray-900 dark:text-white">{line.remisePct || 0}%</span></div>
                        <div>TVA: <span className="font-semibold text-gray-900 dark:text-white">{line.tvaPct || 0}%</span></div>
                      </div>
                      <div className="mt-2 text-sm flex justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">Total HT</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {delivery.devise}
                        </span>
                      </div>
                      <div className="text-sm flex justify-between text-blue-600 dark:text-blue-400">
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
            <div className="w-full md:w-80 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Total HT</span>
                <span className="font-medium text-gray-900 dark:text-white">{(delivery.totalBaseHT || delivery.totalHT || 0).toFixed(3)} {delivery.devise}</span>
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
                    <span className="text-gray-700 dark:text-gray-300">Total Remise</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-{totalRemise.toFixed(3)} {delivery.devise}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Total TVA</span>
                <span className="font-medium text-gray-900 dark:text-white">{delivery.totalTVA?.toFixed(3) || 0} {delivery.devise}</span>
              </div>
              <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between text-lg font-bold">
                <span className="text-gray-900 dark:text-white">Total TTC</span>
                <span className="text-blue-600 dark:text-blue-400">{delivery.totalTTC?.toFixed(3)} {delivery.devise}</span>
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
          <div className="border-t border-gray-300 dark:border-gray-700 pt-6 mt-6">
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
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  {footerItems.join(' - ')}
                </div>
              ) : null;
            })()}
          </div>
        )}

      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowWhatsAppModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  <span className="sr-only">Fermer</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                  <ChatBubbleLeftEllipsisIcon className="h-6 w-6 text-green-600 dark:text-green-400" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">
                    Envoyer par WhatsApp
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Confirmez le numéro ou recherchez un autre client.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="wa-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Numéro de téléphone
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <PhoneIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      name="wa-number"
                      id="wa-number"
                      className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                      placeholder="216..."
                      value={whatsAppNumber}
                      onChange={(e) => setWhatsAppNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OU RECHERCHER UN CLIENT</span>
                  <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                </div>

                <div className="relative">
                  <label htmlFor="search-client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Rechercher un autre client
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      type="text"
                      id="search-client"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md h-10"
                      placeholder="Nom du client..."
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      autoComplete="off"
                    />
                    {searchingClients && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                      </div>
                    )}
                  </div>

                  {clientSearchResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                      {clientSearchResults.map((client) => (
                        <li
                          key={client._id}
                          className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100 dark:hover:bg-gray-600"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              const res = await fetch(`/api/customers/${client._id}`, { headers: { 'X-Tenant-Id': tenantId || '' } });
                              if (res.ok) {
                                const data = await res.json();
                                const phone = data.mobile || data.telephone || '';
                                let clean = phone.replace(/\D/g, '');
                                if (clean.length === 8) clean = '216' + clean;

                                if (clean) {
                                  setWhatsAppNumber(clean);
                                  setClientSearchQuery(client.title);
                                  setClientSearchResults([]);
                                } else {
                                  toast.error(`Aucun numéro trouvé pour ${client.title}`);
                                }
                              }
                            } catch (err) {
                              console.error(err);
                              toast.error("Erreur lors de la récupération du numéro");
                            }
                          }}
                        >
                          <div className="flex items-center">
                            <span className="font-medium block truncate text-gray-900 dark:text-white">
                              {client.title}
                            </span>
                          </div>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            {client.subtitle}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Include Stamp Checkbox */}
                <div
                  className="mt-4 flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => setIncludeStamp(!includeStamp)}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeStamp ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white dark:bg-gray-800'}`}>
                    {includeStamp && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    Inclure le cachet
                  </label>
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm"
                  onClick={confirmWhatsAppSend}
                >
                  Envoyer
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={() => setShowWhatsAppModal(false)}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

