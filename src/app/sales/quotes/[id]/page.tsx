'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { DocumentTextIcon, ArrowLeftIcon, ArrowDownTrayIcon, ChatBubbleLeftEllipsisIcon, PhoneIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface Quote {
  _id: string;
  numero: string;
  dateDoc: string;
  customerId?: string;
  dateValidite?: string;
  modePaiement?: string;
  totalTTC: number;
  totalBaseHT?: number;
  totalHT?: number;
  totalTVA: number;
  timbreFiscal?: number;
  devise?: string;
  lignes?: any[];
  fodec?: { enabled: boolean; tauxPct: number; montant?: number; };
  remiseGlobalePct?: number;
}

export default function ViewQuotePage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [quote, setQuote] = useState<Quote | null>(null);
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

  useEffect(() => {
    if (tenantId && params.id) {
      fetchQuote();
      fetchCompanySettings();
    }
  }, [tenantId, params.id]);

  const fetchQuote = async () => {
    try {
      if (!tenantId) {
        console.error('No tenantId found');
        return;
      }
      console.log('Fetching quote:', params.id, 'for tenant:', tenantId);
      setLoading(true);
      const response = await fetch(`/api/sales/quotes/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Quote data:', data);
        console.log('dateValidite:', data.dateValidite);
        setQuote(data);

        // Fetch customer if customerId exists
        if (data.customerId) {
          const custId = typeof data.customerId === 'object' ? data.customerId._id : data.customerId;
          fetchCustomer(custId);
        }
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast.error('Erreur lors du chargement du devis: ' + (errorData.error || 'Unknown'));
        router.push('/sales/quotes');
      }
    } catch (err) {
      console.error('Error fetching quote:', err);
      toast.error('Erreur lors du chargement du devis');
      router.push('/sales/quotes');
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
    if (!quote) return;

    try {
      setGeneratingPDF(true);

      const response = await fetch(`/api/sales/quotes/${quote._id}/pdf`, {
        headers: { 'X-Tenant-Id': tenantId },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Devis-${quote.numero}.pdf`;
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
            setClientSearchResults(data.results || []);
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
    if (!quote) return;
    setWhatsAppNumber('');

    // Check if we have customer loaded
    if (customer && (customer.mobile || customer.telephone)) {
      let phone = customer.mobile || customer.telephone || '';
      let clean = phone.replace(/\D/g, '');
      if (clean.length === 8) clean = '216' + clean;
      setWhatsAppNumber(clean);
    } else if (quote.customerId && tenantId && !customer) {
      // Fetch if not already fetched (though it should be fetched by useEffect)
      try {
        const custId = typeof quote.customerId === 'object' ? (quote.customerId as any)._id : quote.customerId;
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
    if (!quote || !whatsAppNumber) return;

    let numberToSend = whatsAppNumber.replace(/\D/g, '');
    if (numberToSend.length === 8) numberToSend = '216' + numberToSend;

    // Generate public link
    let publicLink = '';
    const toastId = toast.loading('Génération du lien...');

    try {
      const res = await fetch(`/api/sales/quotes/${quote._id}/share`, {
        method: 'POST',
        headers: { 'X-Tenant-Id': tenantId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        publicLink = `${window.location.origin}/i/${data.token}`;
      }
    } catch (e) {
      console.error("Error generating public link", e);
      toast.error("Erreur génération lien", { id: toastId });
    }

    const customerName = (customer && (customer.raisonSociale || customer.nom)) || quote.customerId || 'Cher Client';
    const companyName = companySettings?.societe?.nom || 'notre société';

    let message = `Bonjour ${customerName}, de la part de ${companyName} : Voici votre devis ${quote.numero} du ${new Date(quote.dateDoc).toLocaleDateString('fr-FR')} pour un montant de ${quote.totalTTC.toFixed(3)} ${quote.devise || 'TND'}.`;

    if (publicLink) {
      message += `\n\n📄 Télécharger votre devis ici : ${publicLink}`;
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!quote) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Devis introuvable</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/sales/quotes')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                <DocumentTextIcon className="w-8 h-8" /> Devis {quote.numero}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Créé le {new Date(quote.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            {generatingPDF ? 'Génération...' : 'Télécharger PDF'}
          </button>

          <button
            onClick={handleOpenWhatsAppModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
            WhatsApp
          </button>
        </div>

        {/* Company Header Info */}
        {companySettings?.societe && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              {/* Logo */}
              {companySettings.societe.logoUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={companySettings.societe.logoUrl}
                    alt="Company Logo"
                    className="h-24 w-24 object-contain dark:brightness-100"
                  />
                </div>
              )}

              {/* Company Info */}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{companySettings.societe.nom}</h2>
                {companySettings.societe.enTete?.slogan && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-1">{companySettings.societe.enTete.slogan}</p>
                )}
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>{companySettings.societe.adresse.rue}, {companySettings.societe.adresse.ville} {companySettings.societe.adresse.codePostal}</p>
                  <p>{companySettings.societe.adresse.pays}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="text-left sm:text-right text-sm text-gray-600 dark:text-gray-400">
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

        {/* Quote Details */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Numéro de devis</label>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{quote.numero}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Date</label>
              <p className="text-lg font-medium text-gray-900 dark:text-white">{new Date(quote.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Validité</label>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {quote.dateValidite ? new Date(quote.dateValidite).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Client</label>
              {customer ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 space-y-1">
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'N/A'}
                  </p>
                  {customer.matriculeFiscale && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Matricule fiscal:</span> {customer.matriculeFiscale}
                    </p>
                  )}
                  {customer.adresseFacturation && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Adresse:</span> {[
                        customer.adresseFacturation.ligne1,
                        customer.adresseFacturation.ligne2,
                        customer.adresseFacturation.codePostal,
                        customer.adresseFacturation.ville
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {customer.code && (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Code:</span> {customer.code}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-lg font-medium text-gray-900 dark:text-white">Chargement...</p>
              )}
            </div>
          </div>

          {/* Lines Table */}
          {quote.lignes && quote.lignes.length > 0 && (
            <div className="mt-6">
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[800px]">
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
                    {quote.lignes.map((line: any, index: number) => {
                      const displayText = line.estStocke === false && line.descriptionProduit
                        ? line.descriptionProduit
                        : line.designation;

                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-pink-50 dark:bg-pink-900/10'}>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                            {displayText ? (
                              <div dangerouslySetInnerHTML={{ __html: displayText }} />
                            ) : (
                              line.designation
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{line.quantite}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{line.prixUnitaireHT?.toFixed(3)} {quote.devise}</td>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{line.remisePct || 0}%</td>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200">{line.tvaPct || 0}%</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                            {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {quote.devise}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                            {(((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {quote.devise}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="lg:hidden space-y-4">
                {quote.lignes.map((line: any, index: number) => {
                  const displayText = line.estStocke === false && line.descriptionProduit
                    ? line.descriptionProduit
                    : line.designation;

                  return (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {displayText ? (
                            <div dangerouslySetInnerHTML={{ __html: displayText }} />
                          ) : (
                            line.designation
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="space-y-1">
                          <p className="text-gray-500 dark:text-gray-400">Qté</p>
                          <p className="font-medium text-gray-900 dark:text-white">{line.quantite}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-gray-500 dark:text-gray-400">P.U HT</p>
                          <p className="font-medium text-gray-900 dark:text-white">{line.prixUnitaireHT?.toFixed(3)} {quote.devise}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-gray-500 dark:text-gray-400">TVA / Remise</p>
                          <p className="text-gray-900 dark:text-white">{line.tvaPct || 0}% / {line.remisePct || 0}%</p>
                        </div>
                        <div className="space-y-1 text-right">
                          {/* Empty or extra info */}
                        </div>
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total HT</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))).toFixed(3)} {quote.devise}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded -mx-2">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total TTC</span>
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                          {(((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100)).toFixed(3)} {quote.devise}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-full sm:w-80 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Sous-total HT</span>
                <span className="font-medium text-gray-900 dark:text-white">{quote.totalBaseHT?.toFixed(3) || quote.totalHT?.toFixed(3) || '0.000'} {quote.devise || 'TND'}</span>
              </div>
              {(() => {
                // Calculate remise lignes
                const remiseLignes = quote.lignes?.reduce((sum: number, line: any) => {
                  const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
                  const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
                  return sum + (lineHTBeforeDiscount - lineHT);
                }, 0) || 0;

                return remiseLignes > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Remise lignes</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-{remiseLignes.toFixed(3)} {quote.devise}</span>
                  </div>
                ) : null;
              })()}
              {(() => {
                // Calculate remise globale
                const totalHTAfterLineDiscount = quote.lignes?.reduce((sum: number, line: any) => {
                  const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
                  const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
                  return sum + lineHT;
                }, 0) || 0;

                const remiseGlobalePct = quote.remiseGlobalePct || 0;
                const remiseGlobale = totalHTAfterLineDiscount - (totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100)));

                return remiseGlobale > 0 ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Remise globale{remiseGlobalePct ? ` (${remiseGlobalePct}%)` : ''}</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-{remiseGlobale.toFixed(3)} {quote.devise}</span>
                  </div>
                ) : null;
              })()}
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Total HT</span>
                <span className="font-bold text-gray-900 dark:text-white">{(() => {
                  const totalHTAfterLineDiscount = quote.lignes?.reduce((sum: number, line: any) => {
                    const lineHTBeforeDiscount = (line.quantite || 0) * (line.prixUnitaireHT || 0);
                    const lineHT = lineHTBeforeDiscount * (1 - ((line.remisePct || 0) / 100));
                    return sum + lineHT;
                  }, 0) || 0;
                  const remiseGlobalePct = quote.remiseGlobalePct || 0;
                  const totalHT = totalHTAfterLineDiscount * (1 - (remiseGlobalePct / 100));
                  return totalHT.toFixed(3);
                })()} {quote.devise}</span>
              </div>
              {quote.fodec && quote.fodec.montant && quote.fodec.montant > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">FODEC{quote.fodec.tauxPct ? ` (${quote.fodec.tauxPct}%)` : ''}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{quote.fodec.montant.toFixed(3)} {quote.devise || 'TND'}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">TVA</span>
                <span className="font-medium text-gray-900 dark:text-white">{quote.totalTVA?.toFixed(3) || 0} {quote.devise}</span>
              </div>
              {quote.timbreFiscal && quote.timbreFiscal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">Timbre fiscal</span>
                  <span className="font-medium text-gray-900 dark:text-white">{quote.timbreFiscal.toFixed(3)} {quote.devise}</span>
                </div>
              )}
              <div className="border-t border-blue-200 dark:border-blue-800 pt-3 flex justify-between text-lg font-bold">
                <span className="text-gray-900 dark:text-white">Total TTC</span>
                <span className="text-blue-600 dark:text-blue-400">{quote.totalTTC?.toFixed(3)} {quote.devise}</span>
              </div>
            </div>
          </div>

          {/* Mode de paiement at bottom left */}
          {quote.modePaiement && (
            <div className="mt-4 text-left">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                Mode de paiement: {quote.modePaiement}
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
                                    setClientSearchQuery('');
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
      </div>
    </DashboardLayout>
  );
}



