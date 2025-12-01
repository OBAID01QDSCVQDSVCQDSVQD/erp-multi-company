'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, UserGroupIcon, MagnifyingGlassIcon, BuildingOfficeIcon, XMarkIcon, EyeIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';

interface Customer {
  _id: string;
  type: 'societe' | 'particulier';
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  matriculeFiscale?: string;
  tvaCode?: string;
  email?: string;
  telephone?: string;
  mobile?: string;
  adresseFacturation: {
    ligne1: string;
    ville: string;
    gouvernorat?: string;
    pays?: string;
  };
  stats?: {
    caCumule?: number;
    soldeDu?: number;
    dernierAchat?: Date;
    nbFactures?: number;
  };
  actif: boolean;
  bloque?: boolean;
}

export default function CustomersPage() {
  const { tenantId } = useTenantId();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('identite');
  const [taxRates, setTaxRates] = useState<{ code: string; libelle: string; tauxPct: number }[]>([]);
  
  const [form, setForm] = useState({
    type: 'societe' as 'societe' | 'particulier',
    raisonSociale: '',
    nom: '',
    prenom: '',
    matriculeFiscale: '',
    tvaCode: '',
    email: '',
    telephone: '',
    mobile: '',
    siteWeb: '',
    adresseFacturation: {
      ligne1: '',
      ligne2: '',
      ville: '',
      codePostal: '',
      gouvernorat: '',
      pays: 'TN'
    },
    adresseLivraisonIdentique: false,
    adresseLivraison: {
      ligne1: '',
      ligne2: '',
      ville: '',
      codePostal: '',
      gouvernorat: '',
      pays: 'TN'
    },
    conditionsPaiement: '',
    modePaiementPrefere: '',
    plafondCredit: '',
    delaiGraceJours: '',
    rib: '',
    iban: '',
    banqueNom: '',
    swift: '',
    tagsText: '',
    actif: true
  });

  const handleTypeChange = (newType: 'societe' | 'particulier') => {
    setForm((prev) => ({
      ...prev,
      type: newType,
      raisonSociale: newType === 'societe' ? prev.raisonSociale : '',
      nom: newType === 'particulier' ? prev.nom : '',
      prenom: newType === 'particulier' ? prev.prenom : '',
      matriculeFiscale: newType === 'particulier' ? '' : prev.matriculeFiscale,
      tvaCode: newType === 'particulier' ? '' : prev.tvaCode,
    }));
  };

  useEffect(() => {
    fetchCustomers();
    fetchTaxRates();
  }, [tenantId]);

  const fetchCustomers = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/customers', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.items || []);
      } else {
        setError('Erreur lors du chargement des clients');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxRates = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch(`/api/tva/rates?actif=false`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setTaxRates((data.data || []).map((x: any) => ({ code: x.code, libelle: x.libelle, tauxPct: x.tauxPct })));
      }
    } catch (err) {
      console.error('Erreur chargement TVA rates:', err);
    }
  };

  const normalized = (s: string) => s.toLowerCase();
  const filteredCustomers = useMemo(() => {
    const query = normalized(q || '');
    if (!query) return customers;
    return customers.filter(c => {
      const raisonSociale = normalized(c.raisonSociale || '');
      const nom = normalized(c.nom || '');
      const prenom = normalized(c.prenom || '');
      const matricule = normalized(c.matriculeFiscale || '');
      const email = normalized(c.email || '');
      const telephone = normalized(c.telephone || c.mobile || '');
      const ville = normalized(c.adresseFacturation.ville || '');
      
      return raisonSociale.includes(query) || 
             nom.includes(query) || 
             prenom.includes(query) ||
             matricule.includes(query) ||
             email.includes(query) ||
             telephone.includes(query) ||
             ville.includes(query);
    });
  }, [customers, q]);

  const getTypeColor = (type: string) => {
    return type === 'particulier' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-blue-100 text-blue-800';
  };

  const getTypeLabel = (type: string) => {
    return type === 'particulier' ? 'Particulier' : 'Société';
  };

  const getDisplayName = (c: Customer) => {
    if (c.type === 'societe') {
      return c.raisonSociale || 'Société';
    }
    return `${c.nom || ''} ${c.prenom || ''}`.trim() || 'Particulier';
  };

  async function submitCustomer() {
    if (!tenantId) return;
    
    // Validation
    if (form.type === 'societe' && !form.raisonSociale.trim()) {
      alert('Raison sociale requise pour une société');
      return;
    }
    if (form.type === 'particulier' && !form.nom.trim()) {
      alert('Nom requis pour un particulier');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        type: form.type,
        raisonSociale: form.type === 'societe' ? form.raisonSociale : undefined,
        nom: form.type === 'particulier' ? form.nom : undefined,
        prenom: form.type === 'particulier' ? form.prenom : undefined,
        matriculeFiscale:
          form.type === 'particulier' ? undefined : form.matriculeFiscale || undefined,
        tvaCode:
          form.type === 'particulier' ? undefined : form.tvaCode || undefined,
        email: form.email || undefined,
        telephone: form.telephone || undefined,
        mobile: form.mobile || undefined,
        siteWeb: form.siteWeb || undefined,
        adresseFacturation: form.adresseFacturation,
        adresseLivraison: form.adresseLivraisonIdentique 
          ? form.adresseFacturation 
          : form.adresseLivraison.ligne1 
            ? form.adresseLivraison 
            : undefined,
        conditionsPaiement: form.conditionsPaiement || undefined,
        modePaiementPrefere: form.modePaiementPrefere || undefined,
        plafondCredit: form.plafondCredit ? Number(form.plafondCredit) : undefined,
        delaiGraceJours: form.delaiGraceJours ? Number(form.delaiGraceJours) : undefined,
        rib: form.rib || undefined,
        iban: form.iban || undefined,
        banqueNom: form.banqueNom || undefined,
        swift: form.swift || undefined,
        tags: form.tagsText ? form.tagsText.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        actif: form.actif
      };

      const url = editingId ? `/api/customers/${editingId}` : '/api/customers';
      const method = editingId ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        await fetchCustomers();
      } else {
        const txt = await res.text();
        alert('Erreur: ' + txt);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(customer: Customer) {
    setEditingId(customer._id);
    setViewingId(null);
    setForm({
      type: customer.type,
      raisonSociale: customer.raisonSociale || '',
      nom: customer.nom || '',
      prenom: customer.prenom || '',
      matriculeFiscale: customer.matriculeFiscale || '',
      tvaCode: customer.tvaCode || '',
      email: customer.email || '',
      telephone: customer.telephone || '',
      mobile: customer.mobile || '',
      siteWeb: (customer as any).siteWeb || '',
      adresseFacturation: {
        ligne1: customer.adresseFacturation.ligne1,
        ligne2: (customer.adresseFacturation as any).ligne2 || '',
        ville: customer.adresseFacturation.ville,
        codePostal: (customer.adresseFacturation as any).codePostal || '',
        gouvernorat: customer.adresseFacturation.gouvernorat || '',
        pays: customer.adresseFacturation.pays || 'TN'
      },
      adresseLivraisonIdentique: !(customer as any).adresseLivraison,
      adresseLivraison: (customer as any).adresseLivraison || {
        ligne1: '',
        ligne2: '',
        ville: '',
        codePostal: '',
        gouvernorat: '',
        pays: 'TN'
      },
      conditionsPaiement: (customer as any).conditionsPaiement || '',
      modePaiementPrefere: (customer as any).modePaiementPrefere || '',
      plafondCredit: (customer as any).plafondCredit?.toString() || '',
      delaiGraceJours: (customer as any).delaiGraceJours?.toString() || '',
      rib: (customer as any).rib || '',
      iban: (customer as any).iban || '',
      banqueNom: (customer as any).banqueNom || '',
      swift: (customer as any).swift || '',
      tagsText: (customer as any).tags?.join(', ') || '',
      actif: customer.actif
    });
    setShowModal(true);
  }

  function handleView(customer: Customer) {
    setEditingId(null);
    setViewingId(customer._id);
    setForm({
      type: customer.type,
      raisonSociale: customer.raisonSociale || '',
      nom: customer.nom || '',
      prenom: customer.prenom || '',
      matriculeFiscale: customer.matriculeFiscale || '',
      tvaCode: customer.tvaCode || '',
      email: customer.email || '',
      telephone: customer.telephone || '',
      mobile: customer.mobile || '',
      siteWeb: (customer as any).siteWeb || '',
      adresseFacturation: {
        ligne1: customer.adresseFacturation.ligne1,
        ligne2: (customer.adresseFacturation as any).ligne2 || '',
        ville: customer.adresseFacturation.ville,
        codePostal: (customer.adresseFacturation as any).codePostal || '',
        gouvernorat: customer.adresseFacturation.gouvernorat || '',
        pays: customer.adresseFacturation.pays || 'TN'
      },
      adresseLivraisonIdentique: !(customer as any).adresseLivraison,
      adresseLivraison: (customer as any).adresseLivraison || {
        ligne1: '',
        ligne2: '',
        ville: '',
        codePostal: '',
        gouvernorat: '',
        pays: 'TN'
      },
      conditionsPaiement: (customer as any).conditionsPaiement || '',
      modePaiementPrefere: (customer as any).modePaiementPrefere || '',
      plafondCredit: (customer as any).plafondCredit?.toString() || '',
      delaiGraceJours: (customer as any).delaiGraceJours?.toString() || '',
      rib: (customer as any).rib || '',
      iban: (customer as any).iban || '',
      banqueNom: (customer as any).banqueNom || '',
      swift: (customer as any).swift || '',
      tagsText: (customer as any).tags?.join(', ') || '',
      actif: customer.actif
    });
    setShowModal(true);
  }

  async function handleDelete(customerId: string) {
    if (!tenantId) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return;
    
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId }
      });
      
      if (res.ok) {
        await fetchCustomers();
      } else {
        alert('Erreur lors de la suppression');
      }
    } catch (err) {
      alert('Erreur de connexion');
    }
  }

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
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clients</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Gérez votre base de données clients
            </p>
          </div>
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                placeholder="Rechercher (nom, matricule, email, ville)" 
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm sm:text-base" 
              />
            </div>
            <button
                onClick={() => { 
                  setEditingId(null); 
                  setViewingId(null);
                  setForm({
                    type: 'societe',
                    raisonSociale: '',
                    nom: '',
                    prenom: '',
                    matriculeFiscale: '',
                    tvaCode: '',
                    email: '',
                    telephone: '',
                    mobile: '',
                    siteWeb: '',
                    adresseFacturation: {
                      ligne1: '',
                      ligne2: '',
                      ville: '',
                      codePostal: '',
                      gouvernorat: '',
                      pays: 'TN'
                    },
                    adresseLivraisonIdentique: false,
                    adresseLivraison: {
                      ligne1: '',
                      ligne2: '',
                      ville: '',
                      codePostal: '',
                      gouvernorat: '',
                      pays: 'TN'
                    },
                    conditionsPaiement: '',
                    modePaiementPrefere: '',
                    plafondCredit: '',
                    delaiGraceJours: '',
                    rib: '',
                    iban: '',
                    banqueNom: '',
                    swift: '',
                    tagsText: '',
                    actif: true
                  });
                  setActiveTab('identite');
                  setShowModal(true); 
                }}
                type="button"
                className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 w-full sm:w-auto"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Nouveau client
              </button>
            </div>
          </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Customers list */}
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun client</h3>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par ajouter votre premier client.
            </p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <li key={customer._id}>
                  <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                          {customer.type === 'societe' ? (
                            <BuildingOfficeIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          ) : (
                            <UserGroupIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                          )}
                        </div>
                      </div>
                      <div className="ml-3 sm:ml-4 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                            {getDisplayName(customer)}
                          </p>
                          <span className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(customer.type)}`}>
                            {getTypeLabel(customer.type)}
                          </span>
                          {customer.matriculeFiscale && (
                            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-700">
                              {customer.matriculeFiscale}
                            </span>
                          )}
                          {customer.tvaCode && (
                            <span className="hidden sm:inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                              {customer.tvaCode}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          {customer.email && (
                            <span className="flex items-center truncate max-w-full">
                              <span className="mr-1">📧</span>
                              <span className="truncate">{customer.email}</span>
                            </span>
                          )}
                          {customer.telephone && (
                            <span className="flex items-center">
                              <span className="mr-1">📞</span>
                              {customer.telephone}
                            </span>
                          )}
                          {customer.adresseFacturation.ville && (
                            <span className="flex items-center">
                              <span className="mr-1">📍</span>
                              {customer.adresseFacturation.ville}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:space-x-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5 sm:space-x-2">
                        {customer.bloque && (
                          <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            BLOQUÉ
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          customer.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {customer.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 sm:space-x-2">
                        <button onClick={() => handleView(customer)} className="text-gray-600 hover:text-gray-900 p-1.5 sm:p-0" title="Voir">
                          <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button onClick={() => handleEdit(customer)} className="text-indigo-600 hover:text-indigo-900 p-1.5 sm:p-0" title="Modifier">
                          <PencilIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button onClick={() => handleDelete(customer._id)} className="text-red-600 hover:text-red-900 p-1.5 sm:p-0" title="Supprimer">
                          <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Modal Nouveau Client */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b sticky top-0 bg-white rounded-t-xl sm:rounded-t-2xl z-10">
              <div className="flex items-center space-x-2">
                <span className="text-xl sm:text-2xl">👤</span>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">{viewingId ? 'Voir client' : (editingId ? 'Modifier client' : 'Nouveau client')}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 p-1" type="button">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="border-b overflow-x-auto -mx-4 sm:mx-0">
              <nav className="-mb-px flex space-x-4 sm:space-x-6 px-4 sm:px-6 min-w-max sm:min-w-0">
                {['identite', 'adresses', 'paiement', 'banque'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 text-xs sm:text-sm font-medium ${
                      activeTab === tab
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab === 'identite' && 'Identité'}
                    {tab === 'adresses' && 'Adresses'}
                    {tab === 'paiement' && 'Paiement'}
                    {tab === 'banque' && 'Banque'}
                  </button>
                ))}
              </nav>
            </div>

            <div className="px-4 sm:px-6 pb-4 sm:pb-6 overflow-y-auto">
              {activeTab === 'identite' && (
                <div className="space-y-4 mt-4">
                      <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          checked={form.type === 'societe'}
                          onChange={() => handleTypeChange('societe')}
                          disabled={!!viewingId}
                          className="mr-2"
                        />
                        Société
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          checked={form.type === 'particulier'}
                          onChange={() => handleTypeChange('particulier')}
                          disabled={!!viewingId}
                          className="mr-2"
                        />
                        Particulier
                      </label>
                    </div>
                  </div>

                  {form.type === 'societe' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Raison sociale *</label>
                      <input
                        value={form.raisonSociale}
                        onChange={(e) => setForm({...form, raisonSociale: e.target.value})}
                        placeholder="Ex: Société ABC SARL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={!!viewingId}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                        <input
                          value={form.nom}
                          onChange={(e) => setForm({...form, nom: e.target.value})}
                          placeholder="Ex: Ben Ali"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                        <input
                          value={form.prenom}
                          onChange={(e) => setForm({...form, prenom: e.target.value})}
                          placeholder="Ex: Mohamed"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className={form.type === 'particulier' ? 'opacity-50' : ''}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Matricule fiscale</label>
                      <input
                        value={form.type === 'particulier' ? '' : form.matriculeFiscale}
                        onChange={(e) => {
                          if (form.type === 'particulier') return;
                          setForm({ ...form, matriculeFiscale: e.target.value.toUpperCase() });
                        }}
                        placeholder={form.type === 'particulier' ? 'Non requis pour les particuliers' : 'Ex: 1234567A123'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
                        disabled={form.type === 'particulier'}
                      />
                    </div>
                    <div className={form.type === 'particulier' ? 'opacity-50' : ''}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TVA Code</label>
                      <select
                        value={form.type === 'particulier' ? '' : form.tvaCode}
                        onChange={(e) => {
                          if (form.type === 'particulier') return;
                          setForm({ ...form, tvaCode: e.target.value });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={form.type === 'particulier'}
                      >
                        <option value="">—</option>
                        {taxRates.map(r => (
                          <option key={r.code} value={r.code}>{r.code} - {r.libelle}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({...form, email: e.target.value})}
                      placeholder="exemple@email.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                      <input
                        value={form.telephone}
                        onChange={(e) => setForm({...form, telephone: e.target.value})}
                        placeholder="+216 XX XXX XXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                      <input
                        value={form.mobile}
                        onChange={(e) => setForm({...form, mobile: e.target.value})}
                        placeholder="+216 XX XXX XXX"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (séparés par virgule)</label>
                    <input
                      value={form.tagsText}
                      onChange={(e) => setForm({...form, tagsText: e.target.value})}
                      placeholder="Ex: VIP, Export, Prestataire"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'adresses' && (
                <div className="space-y-6 mt-4">
                  <div className="border-b pb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Adresse de facturation</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse ligne 1 *</label>
                        <input
                          value={form.adresseFacturation.ligne1}
                          onChange={(e) => setForm({...form, adresseFacturation: {...form.adresseFacturation, ligne1: e.target.value}})}
                          placeholder="Ex: 10 Rue de la République"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse ligne 2</label>
                        <input
                          value={form.adresseFacturation.ligne2}
                          onChange={(e) => setForm({...form, adresseFacturation: {...form.adresseFacturation, ligne2: e.target.value}})}
                          placeholder="Appartement, bureau, etc."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                          <input
                            value={form.adresseFacturation.ville}
                            onChange={(e) => setForm({...form, adresseFacturation: {...form.adresseFacturation, ville: e.target.value}})}
                            placeholder="Ex: Tunis"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                          <input
                            value={form.adresseFacturation.codePostal}
                            onChange={(e) => setForm({...form, adresseFacturation: {...form.adresseFacturation, codePostal: e.target.value}})}
                            placeholder="Ex: 1000"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gouvernorat</label>
                        <input
                          value={form.adresseFacturation.gouvernorat}
                          onChange={(e) => setForm({...form, adresseFacturation: {...form.adresseFacturation, gouvernorat: e.target.value}})}
                          placeholder="Ex: Tunis"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={form.adresseLivraisonIdentique}
                        onChange={(e) => setForm({...form, adresseLivraisonIdentique: e.target.checked})}
                      />
                      <span className="text-sm font-medium text-gray-700">Identique à l'adresse de facturation</span>
                    </label>
                  </div>

                  {!form.adresseLivraisonIdentique && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Adresse de livraison</h4>
                      <div className="space-y-3">
                        <input
                          value={form.adresseLivraison.ligne1}
                          onChange={(e) => setForm({...form, adresseLivraison: {...form.adresseLivraison, ligne1: e.target.value}})}
                          placeholder="Adresse ligne 1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <input
                          value={form.adresseLivraison.ligne2}
                          onChange={(e) => setForm({...form, adresseLivraison: {...form.adresseLivraison, ligne2: e.target.value}})}
                          placeholder="Adresse ligne 2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            value={form.adresseLivraison.ville}
                            onChange={(e) => setForm({...form, adresseLivraison: {...form.adresseLivraison, ville: e.target.value}})}
                            placeholder="Ville"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                          <input
                            value={form.adresseLivraison.codePostal}
                            onChange={(e) => setForm({...form, adresseLivraison: {...form.adresseLivraison, codePostal: e.target.value}})}
                            placeholder="Code postal"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'paiement' && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Conditions de paiement</label>
                    <select
                      value={form.conditionsPaiement}
                      onChange={(e) => setForm({...form, conditionsPaiement: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">—</option>
                      <option value="Comptant">Comptant</option>
                      <option value="30 jours">30 jours</option>
                      <option value="60 jours">60 jours</option>
                      <option value="Fin de mois +10">Fin de mois +10</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mode de paiement préféré</label>
                    <select
                      value={form.modePaiementPrefere}
                      onChange={(e) => setForm({...form, modePaiementPrefere: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">—</option>
                      <option value="Espèces">Espèces</option>
                      <option value="Virement">Virement</option>
                      <option value="Chèque">Chèque</option>
                      <option value="Carte">Carte</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Plafond crédit (TND)</label>
                      <input
                        type="number"
                        value={form.plafondCredit}
                        onChange={(e) => setForm({...form, plafondCredit: e.target.value})}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Délai de grâce (jours)</label>
                      <input
                        type="number"
                        value={form.delaiGraceJours}
                        onChange={(e) => setForm({...form, delaiGraceJours: e.target.value})}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'banque' && (
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RIB</label>
                    <input
                      value={form.rib}
                      onChange={(e) => setForm({...form, rib: e.target.value})}
                      placeholder="Ex: 02 890 12345678901234567"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                    <input
                      value={form.iban}
                      onChange={(e) => setForm({...form, iban: e.target.value})}
                      placeholder="Ex: TN59 0208 9012 3456 7890 1234"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Banque</label>
                    <input
                      value={form.banqueNom}
                      onChange={(e) => setForm({...form, banqueNom: e.target.value})}
                      placeholder="Ex: Banque de Tunisie"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT</label>
                    <input
                      value={form.swift}
                      onChange={(e) => setForm({...form, swift: e.target.value})}
                      placeholder="Ex: BTUNITN"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 space-y-0 px-4 sm:px-6 py-3 sm:py-4 border-t sticky bottom-0 bg-white rounded-b-xl sm:rounded-b-2xl">
                <button onClick={() => setShowModal(false)} className="w-full sm:w-auto px-4 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">
                  Annuler
                </button>
                {!viewingId && (
                  <button onClick={submitCustomer} disabled={saving} className="w-full sm:w-auto px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    {saving ? 'Enregistrement...' : (editingId ? 'Enregistrer' : 'Créer le client')}
                  </button>
                )}
              </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

