'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { PencilIcon, PowerIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

interface UnitItem {
  _id?: string;
  code: string;
  libelle: string;
  symbole: string;
  categorie: 'quantite'|'poids'|'volume'|'longueur'|'surface'|'temps';
  baseCategorie: string;
  facteurVersBase: number;
  actif: boolean;
  estParDefaut?: boolean;
  origine: 'global'|'local';
}

export default function UnitsTab({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<null | { code: string; categorie: UnitItem['categorie'] }>(null);
  const [form, setForm] = useState({
    code: '',
    libelle: '',
    symbole: '',
    categorie: 'quantite' as UnitItem['categorie'],
    baseCategorie: '',
    facteurVersBase: 1,
    actif: true,
  });

  useEffect(() => { fetchUnion(); }, [tenantId]);

  const fetchUnion = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/units/union', { headers: { 'X-Tenant-Id': tenantId } });
      if (!res.ok) throw new Error('Erreur chargement unité');
      const data = await res.json();
      setUnits(data.data || []);
    } catch (e) {
      toast.error('Erreur lors du chargement des unités');
    } finally {
      setLoading(false);
    }
  };

  const backfill = async () => {
    try {
      const res = await fetch('/api/units/local/backfill', { method: 'POST', headers: { 'X-Tenant-Id': tenantId } });
      if (!res.ok) throw new Error('Erreur backfill');
      await fetchUnion();
    } catch (e) {
      toast.error('Backfill échoué');
    }
  };

  const grouped = units.reduce<Record<string, UnitItem[]>>((acc, u) => {
    acc[u.categorie] = acc[u.categorie] || [];
    acc[u.categorie].push(u);
    return acc;
  }, {});

  const openCreate = (categorie: UnitItem['categorie']) => {
    setEditing(null);
    setForm({ code: '', libelle: '', symbole: '', categorie, baseCategorie: guessBase(categorie), facteurVersBase: 1, actif: true });
    setShowModal(true);
  };

  const openCreateFromGlobal = (u: UnitItem) => {
    setEditing(null);
    setForm({ code: u.code, libelle: u.libelle, symbole: u.symbole, categorie: u.categorie, baseCategorie: u.baseCategorie, facteurVersBase: u.facteurVersBase, actif: true });
    setShowModal(true);
  };

  const openEditLocal = (u: UnitItem) => {
    setEditing({ code: u.code, categorie: u.categorie });
    setForm({ code: u.code, libelle: u.libelle, symbole: u.symbole, categorie: u.categorie, baseCategorie: u.baseCategorie, facteurVersBase: u.facteurVersBase, actif: u.actif });
    setShowModal(true);
  };

  const saveUnit = async () => {
    try {
      const payload = { ...form, facteurVersBase: Number(form.facteurVersBase) } as any;
      const res = editing
        ? await fetch(`/api/units/local/${editing.code}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify({ libelle: payload.libelle, symbole: payload.symbole, facteurVersBase: payload.facteurVersBase, actif: payload.actif }) })
        : await fetch('/api/units/local', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Erreur sauvegarde');
      setShowModal(false);
      await fetchUnion();
      toast.success('Unité sauvegardée');
    } catch {
      toast.error('Échec de sauvegarde');
    }
  };

  const toggleActive = async (u: UnitItem) => {
    try {
      const res = await fetch(`/api/units/local/${u.code}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify({ actif: !u.actif }) });
      if (!res.ok) throw new Error();
      await fetchUnion();
    } catch {
      toast.error('Impossible de changer le statut');
    }
  };

  const removeLocal = async (u: UnitItem) => {
    if (!confirm(`Supprimer l'unité ${u.code} ?`)) return;
    try {
      const res = await fetch(`/api/units/local/${u.code}`, { method: 'DELETE', headers: { 'X-Tenant-Id': tenantId } });
      if (!res.ok) throw new Error();
      await fetchUnion();
    } catch {
      toast.error('Suppression échouée');
    }
  };

  // Removed default selection feature

  function guessBase(cat: UnitItem['categorie']) {
    switch (cat) {
      case 'quantite': return 'PIECE';
      case 'poids': return 'G';
      case 'volume': return 'ML';
      case 'longueur': return 'MM';
      case 'surface': return 'CM2';
      case 'temps': return 'MIN';
      default: return '';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center">
        <p className="text-sm text-gray-600 mb-4">Aucune unité à afficher pour l'instant.</p>
        <button onClick={backfill} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md">Charger les unités par défaut</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([categorie, list]) => (
        <div key={categorie} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 capitalize">{categorie}</h3>
            <button onClick={() => openCreate(categorie as UnitItem['categorie'])} className="inline-flex items-center px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200">
              <PlusIcon className="h-4 w-4 mr-1" /> Nouvelle unité
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libellé</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbole</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origine</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {list.map((u) => (
                  <tr key={`${u.origine}-${u.code}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.libelle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.symbole}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {u.actif ? 'ACTIF' : 'INACTIF'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${u.origine === 'local' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                        {u.origine === 'local' ? 'Locale' : 'Globale'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-3">
                        {u.origine === 'global' && (
                          <button
                            onClick={() => openCreateFromGlobal(u)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Ajouter à l’entreprise"
                            aria-label="Ajouter"
                          >
                            <PlusIcon className="h-5 w-5" />
                          </button>
                        )}
                        {u.origine === 'local' && (
                          <>
                            <button
                              onClick={() => openEditLocal(u)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Modifier"
                              aria-label="Modifier"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => toggleActive(u)}
                              className="text-gray-600 hover:text-gray-900"
                              title={u.actif ? 'Désactiver' : 'Activer'}
                              aria-label={u.actif ? 'Désactiver' : 'Activer'}
                            >
                              <PowerIcon className="h-5 w-5" />
                            </button>
                            {/* Default action removed */}
                            <button
                              onClick={() => removeLocal(u)}
                              className="text-red-600 hover:text-red-900"
                              title="Supprimer"
                              aria-label="Supprimer"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-30" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-semibold text-gray-900">{editing ? 'Modifier unité' : 'Nouvelle unité'}</h4>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700" type="button">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input value={form.code} onChange={(e)=>setForm({...form, code:e.target.value.toUpperCase()})} disabled={!!editing} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
                <input value={form.libelle} onChange={(e)=>setForm({...form, libelle:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symbole *</label>
                <input value={form.symbole} onChange={(e)=>setForm({...form, symbole:e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                <select value={form.categorie} onChange={(e)=>{ const cat = e.target.value as UnitItem['categorie']; setForm({...form, categorie: cat, baseCategorie: guessBase(cat)}); }} disabled={!!editing} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="quantite">quantite</option>
                  <option value="poids">poids</option>
                  <option value="volume">volume</option>
                  <option value="longueur">longueur</option>
                  <option value="surface">surface</option>
                  <option value="temps">temps</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base catégorie</label>
                <input value={form.baseCategorie} onChange={(e)=>setForm({...form, baseCategorie:e.target.value.toUpperCase()})} disabled className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facteur vers base</label>
                <input type="number" value={form.facteurVersBase} onChange={(e)=>setForm({...form, facteurVersBase: Number(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={form.actif} onChange={(e)=>setForm({...form, actif:e.target.checked})} className="mr-2" />
                <label className="text-sm">Actif</label>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={()=>setShowModal(false)} className="px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md">Annuler</button>
              <button onClick={saveUnit} className="px-3 py-2 text-sm text-white bg-indigo-600 border border-transparent rounded-md">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


