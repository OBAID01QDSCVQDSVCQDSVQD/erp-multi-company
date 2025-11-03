'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, TruckIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon, XMarkIcon, FolderIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';

interface Supplier {
  _id: string;
  type: 'societe' | 'particulier';
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  matriculeFiscale?: string;
  email?: string;
  telephone?: string;
  mobile?: string;
  adresseFacturation: {
    ligne1: string;
    ville?: string;
    gouvernorat?: string;
    pays?: string;
  };
  conditionsPaiement?: string;
  devise?: string;
  actif: boolean;
  archive?: boolean;
  delaiLivraisonJours?: number;
  rating?: { noteGlobale?: number };
  risque?: 'faible' | 'moyen' | 'eleve';
  createdAt: string;
}

export default function SuppliersPage() {
  const { tenantId } = useTenantId();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'identite' | 'adresse' | 'paiement' | 'banque'>('identite');

  const [form, setForm] = useState({
    type: 'societe' as 'societe' | 'particulier',
    raisonSociale: '',
    nom: '',
    prenom: '',
    matriculeFiscale: '',
    nRegistreCommerce: '',
    email: '',
    telephone: '',
    mobile: '',
    siteWeb: '',
    adresseFacturation: { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
    adresseLivraison: { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
    contacts: [] as any[],
    rib: '',
    iban: '',
    banqueNom: '',
    swift: '',
    conditionsPaiement: '',
    modePaiementPrefere: '',
    devise: 'TND',
    incoterm: '',
    delaiLivraisonJours: '',
    moq: '',
    remiseCommercialePct: '',
    retenueSource: { actif: false, tauxPct: '' },
    actif: true,
    tags: [] as string[]
  });

  useEffect(() => { if (tenantId) fetchSuppliers(); }, [tenantId]);

  const fetchSuppliers = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/suppliers', { headers: { 'X-Tenant-Id': tenantId } });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.items || data);
      } else {
        setError('Erreur lors du chargement des fournisseurs');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return suppliers;
    return suppliers.filter(f => {
      const nom = f.type === 'societe' ? f.raisonSociale : `${f.nom || ''} ${f.prenom || ''}`.trim();
      return (nom || '').toLowerCase().includes(s) ||
        (f.matriculeFiscale || '').toLowerCase().includes(s) ||
        (f.email || '').toLowerCase().includes(s) ||
        (f.telephone || '').toLowerCase().includes(s) ||
        (f.adresseFacturation?.ville || '').toLowerCase().includes(s);
    });
  }, [suppliers, q]);

  async function submitSupplier() {
    if (!tenantId) return;
    if (form.type === 'societe' && !form.raisonSociale.trim()) { alert('Raison sociale requise'); return; }
    if (form.type === 'particulier' && !form.nom.trim()) { alert('Nom requis'); return; }
    try {
      setSaving(true);
      const payload: any = {
        ...form,
        conditionsPaiement: form.conditionsPaiement || undefined,
        modePaiementPrefere: form.modePaiementPrefere || undefined,
        delaiLivraisonJours: form.delaiLivraisonJours ? Number(form.delaiLivraisonJours) : undefined,
        moq: form.moq ? Number(form.moq) : undefined,
        remiseCommercialePct: form.remiseCommercialePct ? Number(form.remiseCommercialePct) : undefined,
        retenueSource: form.retenueSource.actif ? {
          actif: true,
          tauxPct: Number(form.retenueSource.tauxPct) || 0
        } : undefined,
        rib: form.rib || undefined,
        iban: form.iban || undefined,
        banqueNom: form.banqueNom || undefined,
        swift: form.swift || undefined
      };
      const url = editingId ? `/api/suppliers/${editingId}` : '/api/suppliers';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify(payload) });
      if (res.ok) { setShowModal(false); setEditingId(null); setViewingId(null); await fetchSuppliers(); }
      else { const txt = await res.text(); alert('Erreur: ' + txt); }
    } finally { setSaving(false); }
  }

  function handleNew() {
    setEditingId(null);
    setViewingId(null);
    setForm({
      type: 'societe',
      raisonSociale: '',
      nom: '',
      prenom: '',
      matriculeFiscale: '',
      nRegistreCommerce: '',
      email: '',
      telephone: '',
      mobile: '',
      siteWeb: '',
      adresseFacturation: { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
      adresseLivraison: { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
      contacts: [],
      rib: '',
      iban: '',
      banqueNom: '',
      swift: '',
      conditionsPaiement: '',
      modePaiementPrefere: '',
      devise: 'TND',
      incoterm: '',
      delaiLivraisonJours: '',
      moq: '',
      remiseCommercialePct: '',
      retenueSource: { actif: false, tauxPct: '' },
      actif: true,
      tags: []
    });
    setActiveTab('identite');
    setShowModal(true);
  }

  function handleEdit(id: string) {
    const s = suppliers.find(x => x._id === id);
    if (!s) return;
    setEditingId(id);
    setViewingId(null);
    setForm({
      type: s.type || 'societe',
      raisonSociale: s.raisonSociale || '',
      nom: s.nom || '',
      prenom: s.prenom || '',
      matriculeFiscale: s.matriculeFiscale || '',
      nRegistreCommerce: '',
      email: s.email || '',
      telephone: s.telephone || '',
      mobile: s.mobile || '',
      siteWeb: '',
      adresseFacturation: s.adresseFacturation ? {
        ligne1: s.adresseFacturation.ligne1 || '',
        ligne2: '',
        ville: s.adresseFacturation.ville || '',
        codePostal: '',
        gouvernorat: s.adresseFacturation.gouvernorat || '',
        pays: s.adresseFacturation.pays || 'TN'
      } : { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
      adresseLivraison: { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
      contacts: [],
      rib: '',
      iban: '',
      banqueNom: '',
      swift: '',
      conditionsPaiement: s.conditionsPaiement || '',
      modePaiementPrefere: '',
      devise: s.devise || 'TND',
      incoterm: '',
      delaiLivraisonJours: s.delaiLivraisonJours ? String(s.delaiLivraisonJours) : '',
      moq: '',
      remiseCommercialePct: '',
      retenueSource: { actif: false, tauxPct: '' },
      actif: s.actif !== false,
      tags: []
    });
    setActiveTab('identite');
    setShowModal(true);
  }

  function handleView(id: string) {
    const s = suppliers.find(x => x._id === id);
    if (!s) return;
    setEditingId(null);
    setViewingId(id);
    setForm({
      type: s.type || 'societe',
      raisonSociale: s.raisonSociale || '',
      nom: s.nom || '',
      prenom: s.prenom || '',
      matriculeFiscale: s.matriculeFiscale || '',
      nRegistreCommerce: '',
      email: s.email || '',
      telephone: s.telephone || '',
      mobile: s.mobile || '',
      siteWeb: '',
      adresseFacturation: s.adresseFacturation ? {
        ligne1: s.adresseFacturation.ligne1 || '',
        ligne2: '',
        ville: s.adresseFacturation.ville || '',
        codePostal: '',
        gouvernorat: s.adresseFacturation.gouvernorat || '',
        pays: s.adresseFacturation.pays || 'TN'
      } : { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
      adresseLivraison: { ligne1: '', ligne2: '', ville: '', codePostal: '', gouvernorat: '', pays: 'TN' },
      contacts: [],
      rib: '',
      iban: '',
      banqueNom: '',
      swift: '',
      conditionsPaiement: s.conditionsPaiement || '',
      modePaiementPrefere: '',
      devise: s.devise || 'TND',
      incoterm: '',
      delaiLivraisonJours: s.delaiLivraisonJours ? String(s.delaiLivraisonJours) : '',
      moq: '',
      remiseCommercialePct: '',
      retenueSource: { actif: false, tauxPct: '' },
      actif: s.actif !== false,
      tags: []
    });
    setActiveTab('identite');
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce fournisseur ?')) return;
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE', headers: { 'X-Tenant-Id': tenantId } });
      if (res.ok) await fetchSuppliers();
      else alert('Erreur suppression');
    } catch (err) { alert('Erreur'); }
  }

  const isViewingOrEditing = viewingId !== null || editingId !== null;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TruckIcon className="w-8 h-8" /> Fournisseurs
          </h1>
          <button onClick={handleNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <PlusIcon className="w-5 h-5" /> Nouveau fournisseur
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule, email, téléphone, ville..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>

        {/* Suppliers List */}
        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : error ? (
          <div className="text-red-600 py-4">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Aucun fournisseur trouvé</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((supplier) => {
              const displayName = supplier.type === 'societe' ? supplier.raisonSociale : `${supplier.nom || ''} ${supplier.prenom || ''}`.trim();
              const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
              return (
                <div key={supplier._id} className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{displayName}</h3>
                        {supplier.matriculeFiscale && (
                          <p className="text-sm text-gray-600">MF: {supplier.matriculeFiscale}</p>
                        )}
                      </div>
                    </div>
                    {supplier.actif ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">Actif</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">Inactif</span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    {supplier.email && (
                      <p className="text-sm text-gray-600 flex items-center gap-2"><EnvelopeIcon className="w-4 h-4" /> {supplier.email}</p>
                    )}
                    {supplier.telephone && (
                      <p className="text-sm text-gray-600 flex items-center gap-2"><PhoneIcon className="w-4 h-4" /> {supplier.telephone}</p>
                    )}
                    {supplier.adresseFacturation?.ville && (
                      <p className="text-sm text-gray-600">{supplier.adresseFacturation.ville}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-sm text-gray-500">{supplier.devise || 'TND'}</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleView(supplier._id)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(supplier._id)} className="p-2 text-green-600 hover:bg-green-50 rounded">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(supplier._id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-xl font-bold">
                  {viewingId ? 'Voir fournisseur' : editingId ? 'Modifier fournisseur' : 'Nouveau fournisseur'}
                </h2>
                <button onClick={() => { setShowModal(false); setViewingId(null); setEditingId(null); }} className="text-gray-500 hover:text-gray-700">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Tabs */}
              <div className="px-6 pt-4 border-b sticky top-[73px] bg-white">
                <div className="flex gap-4">
                  {(['identite', 'adresse', 'paiement', 'banque'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 font-medium transition-colors ${
                        activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {tab === 'identite' && 'Identité & TVA'}
                      {tab === 'adresse' && 'Adresses'}
                      {tab === 'paiement' && 'Paiement & Achat'}
                      {tab === 'banque' && 'Banque'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1">
                {activeTab === 'identite' && (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="type" checked={form.type === 'societe'} onChange={() => setForm({ ...form, type: 'societe' })} disabled={isViewingOrEditing} />
                        Société
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="type" checked={form.type === 'particulier'} onChange={() => setForm({ ...form, type: 'particulier' })} disabled={isViewingOrEditing} />
                        Particulier
                      </label>
                    </div>

                    {form.type === 'societe' ? (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-1">Raison sociale *</label>
                          <input
                            type="text"
                            value={form.raisonSociale}
                            onChange={(e) => setForm({ ...form, raisonSociale: e.target.value })}
                            disabled={viewingId !== null}
                            className="w-full px-3 py-2 border rounded-lg"
                            placeholder="Raison sociale"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Nom *</label>
                            <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Prénom</label>
                            <input type="text" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Matricule fiscale</label>
                        <input type="text" value={form.matriculeFiscale} onChange={(e) => setForm({ ...form, matriculeFiscale: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" placeholder="1234567A123" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">N° Registre Commerce</label>
                        <input type="text" value={form.nRegistreCommerce} onChange={(e) => setForm({ ...form, nRegistreCommerce: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Téléphone</label>
                        <input type="text" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Mobile</label>
                        <input type="text" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Site web</label>
                        <input type="url" value={form.siteWeb} onChange={(e) => setForm({ ...form, siteWeb: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'adresse' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-3">Adresse de facturation</h3>
                      <div className="space-y-3">
                        <input type="text" placeholder="Ligne 1 *" value={form.adresseFacturation.ligne1} onChange={(e) => setForm({ ...form, adresseFacturation: { ...form.adresseFacturation, ligne1: e.target.value } })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                        <input type="text" placeholder="Ligne 2" value={form.adresseFacturation.ligne2} onChange={(e) => setForm({ ...form, adresseFacturation: { ...form.adresseFacturation, ligne2: e.target.value } })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Ville *" value={form.adresseFacturation.ville} onChange={(e) => setForm({ ...form, adresseFacturation: { ...form.adresseFacturation, ville: e.target.value } })} disabled={viewingId !== null} className="px-3 py-2 border rounded-lg" />
                          <input type="text" placeholder="Code postal" value={form.adresseFacturation.codePostal} onChange={(e) => setForm({ ...form, adresseFacturation: { ...form.adresseFacturation, codePostal: e.target.value } })} disabled={viewingId !== null} className="px-3 py-2 border rounded-lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'paiement' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Conditions de paiement</label>
                      <input type="text" value={form.conditionsPaiement} onChange={(e) => setForm({ ...form, conditionsPaiement: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" placeholder="Ex: Comptant, 30 jours, Fin de mois +10" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Mode de paiement préféré</label>
                      <select value={form.modePaiementPrefere} onChange={(e) => setForm({ ...form, modePaiementPrefere: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg">
                        <option value="">Sélectionner</option>
                        <option value="Espèces">Espèces</option>
                        <option value="Virement">Virement</option>
                        <option value="Chèque">Chèque</option>
                        <option value="Carte">Carte</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Devise</label>
                        <input type="text" value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" placeholder="TND" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Délai livraison (jours)</label>
                        <input type="number" value={form.delaiLivraisonJours} onChange={(e) => setForm({ ...form, delaiLivraisonJours: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })} disabled={viewingId !== null} />
                        Actif
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'banque' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">RIB</label>
                      <input type="text" value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">IBAN</label>
                      <input type="text" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Banque</label>
                        <input type="text" value={form.banqueNom} onChange={(e) => setForm({ ...form, banqueNom: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">SWIFT</label>
                        <input type="text" value={form.swift} onChange={(e) => setForm({ ...form, swift: e.target.value })} disabled={viewingId !== null} className="w-full px-3 py-2 border rounded-lg" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
                <button onClick={() => { setShowModal(false); setViewingId(null); setEditingId(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  {viewingId ? 'Fermer' : 'Annuler'}
                </button>
                {!viewingId && (
                  <button onClick={submitSupplier} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Enregistrement...' : (editingId ? 'Modifier' : 'Créer')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}