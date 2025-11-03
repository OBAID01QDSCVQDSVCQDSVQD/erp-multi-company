'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

interface StockSettings {
  multiEntrepots: boolean;
  binsActifs: boolean;
  transfertLeadTimeJours: number;
  stockNegatif: 'autorise'|'avertir'|'interdit';
  methodeValorisation: 'fifo'|'lifo'|'cmp';
  decimalesQuantite: number;
  decimalesPrix: number;
  deviseCout: string;
  baseUnits: { quantite: string; poids: string; volume: string; longueur: string; surface: string; temps: string };
  stepMouvement: number;
  reappro: { strategie: 'minmax'|'eoq'|'jit'; minParDefaut: number; maxParDefaut: number; leadTimeJoursParDefaut: number; moqParDefaut: number };
  lotsActifs: boolean; seriesActifs: boolean; expirationActive: boolean; qualiteReception: { actif: boolean; plan: string };
  inventaire: { cycliqueActif: boolean; frequence: 'hebdo'|'mensuel'|'trimestriel'; methodeABC: boolean };
  alertes: { rupture: boolean; expirationProcheJours: number; emails: string[] };
}

interface Warehouse { code: string; libelle: string; adresse?: string; leadTimeJours: number; actif: boolean; }

export default function StockTab({ tenantId }: { tenantId: string }) {
  const [active, setActive] = useState<'entrepots'|'regles'|'reappro'|'trac'|'inventaire'|'alertes'>('entrepots');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<StockSettings | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const { register, handleSubmit, reset } = useForm<StockSettings>();

  useEffect(() => { loadAll(); }, [tenantId]);

  async function loadAll() {
    try {
      setLoading(true);
      const [s, w] = await Promise.all([
        fetch('/api/settings/stock', { headers: { 'X-Tenant-Id': tenantId } }),
        fetch('/api/warehouses', { headers: { 'X-Tenant-Id': tenantId } }),
      ]);
      if (s.ok) {
        const data = await s.json();
        setSettings(data);
        reset(data);
      }
      if (w.ok) {
        const data = await w.json();
        setWarehouses(data.data || []);
      }
    } catch {
      toast.error('Erreur chargement paramètres stock');
    } finally {
      setLoading(false);
    }
  }

  async function savePartial(partial: Partial<StockSettings>) {
    try {
      setSaving(true);
      const res = await fetch('/api/settings/stock', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify(partial) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSettings(prev => ({ ...(prev as any), ...data }));
      toast.success('Paramètres sauvegardés');
    } catch {
      toast.error('Échec de sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function addWarehouse() {
    const code = prompt('Code entrepôt ? (ex: MAIN)') || '';
    const libelle = prompt('Libellé ?') || '';
    if (!code || !libelle) return;
    const res = await fetch('/api/warehouses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify({ code, libelle }) });
    if (res.ok) { toast.success('Entrepôt créé'); loadAll(); } else { toast.error('Échec création'); }
  }

  async function toggleWarehouse(w: Warehouse) {
    const res = await fetch(`/api/warehouses/${w.code}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify({ actif: !w.actif }) });
    if (res.ok) loadAll();
  }

  async function deleteWarehouse(w: Warehouse) {
    if (!confirm(`Désactiver ${w.code} ?`)) return;
    const res = await fetch(`/api/warehouses/${w.code}`, { method: 'DELETE', headers: { 'X-Tenant-Id': tenantId } });
    if (res.ok) loadAll();
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const baseUnits = settings.baseUnits ?? { quantite: 'PIECE', poids: 'G', volume: 'ML', longueur: 'MM', surface: 'CM2', temps: 'MIN' };
  const reappro = settings.reappro ?? { strategie: 'minmax', minParDefaut: 0, maxParDefaut: 0, leadTimeJoursParDefaut: 3, moqParDefaut: 1 };
  const qualiteReception = settings.qualiteReception ?? { actif: false, plan: 'AQL-ISO2859' };
  const inventaire = settings.inventaire ?? { cycliqueActif: true, frequence: 'mensuel', methodeABC: true } as any;
  const alertes = settings.alertes ?? { rupture: true, expirationProcheJours: 30, emails: [] as string[] };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="border-b mb-4">
          <nav className="-mb-px flex space-x-6">
            {[
              { id: 'entrepots', name: 'Entrepôts' },
              { id: 'regles', name: 'Règles & Valorisation' },
              { id: 'reappro', name: 'Réapprovisionnement' },
              { id: 'trac', name: 'Traçabilité' },
              { id: 'inventaire', name: 'Inventaires' },
              { id: 'alertes', name: 'Alertes' },
            ].map(t => (
              <button key={t.id} onClick={()=>setActive(t.id as any)} className={`py-2 px-1 border-b-2 text-sm ${active===t.id?'border-indigo-500 text-indigo-600':'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{t.name}</button>
            ))}
          </nav>
        </div>

        {active==='entrepots' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Entrepôts</h3>
              <button onClick={addWarehouse} className="px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 border border-indigo-300 rounded-md hover:bg-indigo-200">+ Nouvel entrepôt</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Libellé</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead time (j)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {warehouses.map(w => (
                    <tr key={w.code}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{w.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{w.libelle}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{w.leadTimeJours}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${w.actif?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{w.actif?'ACTIF':'INACTIF'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 space-x-3">
                        <button onClick={()=>toggleWarehouse(w)} className="text-gray-600 hover:text-gray-900">{w.actif?'Désactiver':'Activer'}</button>
                        <button onClick={()=>deleteWarehouse(w)} className="text-red-600 hover:text-red-900">Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={settings.multiEntrepots} onChange={(e)=>savePartial({ multiEntrepots: e.target.checked })} /><span className="text-sm">Mode multi-entrepôts</span></label>
              <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={settings.binsActifs} onChange={(e)=>savePartial({ binsActifs: e.target.checked })} /><span className="text-sm">Emplacements (bins) actifs</span></label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Délai transfert (jours)</label>
                <input type="number" defaultValue={settings.transfertLeadTimeJours} onBlur={(e)=>savePartial({ transfertLeadTimeJours: Number(e.currentTarget.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>
        )}

        {active==='regles' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock négatif</label>
                <select defaultValue={settings.stockNegatif} onChange={(e)=>savePartial({ stockNegatif: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="autorise">Autoriser</option>
                  <option value="avertir">Avertir</option>
                  <option value="interdit">Interdire</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de valorisation</label>
                <select defaultValue={settings.methodeValorisation} onChange={(e)=>savePartial({ methodeValorisation: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="cmp">CMP</option>
                  <option value="fifo">FIFO</option>
                  <option value="lifo">LIFO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devise coût</label>
                <input defaultValue={settings.deviseCout} onBlur={(e)=>savePartial({ deviseCout: e.currentTarget.value })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Décimales quantité</label>
                <input type="number" defaultValue={settings.decimalesQuantite} onBlur={(e)=>savePartial({ decimalesQuantite: Number(e.currentTarget.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Décimales prix</label>
                <input type="number" defaultValue={settings.decimalesPrix} onBlur={(e)=>savePartial({ decimalesPrix: Number(e.currentTarget.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pas mouvement</label>
                <input type="number" step="0.001" defaultValue={settings.stepMouvement} onBlur={(e)=>savePartial({ stepMouvement: Number(e.currentTarget.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
              <div className="bg-gray-50 p-4 rounded">
              <h4 className="text-sm font-medium mb-2">Unités de base (lecture seule)</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-gray-700">
                {Object.entries(baseUnits).map(([k,v])=> (
                  <div key={k}><span className="uppercase">{k}</span>: <span className="font-mono">{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {active==='reappro' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stratégie</label>
              <select defaultValue={reappro.strategie} onChange={(e)=>savePartial({ reappro: { ...reappro, strategie: e.target.value as any } })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="minmax">Min/Max</option>
                <option value="eoq">EOQ</option>
                <option value="jit">JIT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min par défaut</label>
              <input type="number" defaultValue={reappro.minParDefaut} onBlur={(e)=>savePartial({ reappro: { ...reappro, minParDefaut: Number(e.currentTarget.value) } })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max par défaut</label>
              <input type="number" defaultValue={reappro.maxParDefaut} onBlur={(e)=>savePartial({ reappro: { ...reappro, maxParDefaut: Number(e.currentTarget.value) } })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead time (jours)</label>
              <input type="number" defaultValue={reappro.leadTimeJoursParDefaut} onBlur={(e)=>savePartial({ reappro: { ...reappro, leadTimeJoursParDefaut: Number(e.currentTarget.value) } })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MOQ par défaut</label>
              <input type="number" defaultValue={reappro.moqParDefaut} onBlur={(e)=>savePartial({ reappro: { ...reappro, moqParDefaut: Number(e.currentTarget.value) } })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="md:col-span-3">
              <button onClick={async()=>{ const res = await fetch('/api/replenishment/suggest', { method:'POST' }); const data = await res.json(); toast.success('Suggestion générée'); console.log(data); }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded">Tester la suggestion</button>
            </div>
          </div>
        )}

        {active==='trac' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={settings.lotsActifs} onChange={(e)=>savePartial({ lotsActifs: e.target.checked })} /><span className="text-sm">Lots actifs</span></label>
            <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={settings.seriesActifs} onChange={(e)=>savePartial({ seriesActifs: e.target.checked })} /><span className="text-sm">Séries actives</span></label>
            <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={settings.expirationActive} onChange={(e)=>savePartial({ expirationActive: e.target.checked })} /><span className="text-sm">Expiration active</span></label>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={qualiteReception.actif} onChange={(e)=>savePartial({ qualiteReception: { ...qualiteReception, actif: e.target.checked } })} /><span className="text-sm">Qualité réception</span></label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan qualité</label>
                <input defaultValue={qualiteReception.plan} onBlur={(e)=>savePartial({ qualiteReception: { ...qualiteReception, plan: e.currentTarget.value } })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
            </div>
          </div>
        )}

        {active==='inventaire' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={inventaire.cycliqueActif} onChange={(e)=>savePartial({ inventaire: { ...inventaire, cycliqueActif: e.target.checked } })} /><span className="textsm">Inventaire cyclique actif</span></label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence</label>
              <select defaultValue={inventaire.frequence} onChange={(e)=>savePartial({ inventaire: { ...inventaire, frequence: e.target.value as any } })} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="hebdo">Hebdomadaire</option>
                <option value="mensuel">Mensuel</option>
                <option value="trimestriel">Trimestriel</option>
              </select>
            </div>
            <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={inventaire.methodeABC} onChange={(e)=>savePartial({ inventaire: { ...inventaire, methodeABC: e.target.checked } })} /><span className="text-sm">Méthode ABC</span></label>
            <div className="md:col-span-3">
              <button onClick={async()=>{ const res = await fetch('/api/inventory/cycle/run?warehouse=MAIN', { method:'POST' }); const data = await res.json(); toast.success('Plan de comptage lancé'); console.log(data); }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded">Lancer le plan de comptage</button>
            </div>
          </div>
        )}

        {active==='alertes' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center space-x-2"><input type="checkbox" defaultChecked={alertes.rupture} onChange={(e)=>savePartial({ alertes: { ...alertes, rupture: e.target.checked } })} /><span className="text-sm">Alerte rupture</span></label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration proche (jours)</label>
              <input type="number" defaultValue={alertes.expirationProcheJours} onBlur={(e)=>savePartial({ alertes: { ...alertes, expirationProcheJours: Number(e.currentTarget.value) } })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Emails</label>
              <input defaultValue={(alertes.emails||[]).join(', ')} onBlur={(e)=>savePartial({ alertes: { ...alertes, emails: e.currentTarget.value.split(',').map(v=>v.trim()).filter(Boolean) } })} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="md:col-span-3">
              <button onClick={()=>toast.success('Email test envoyé (mock)')} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded">Envoyer un email test</button>
            </div>
          </div>
        )}

        {saving && <p className="mt-4 text-xs text-gray-500">Sauvegarde...</p>}
      </div>
    </div>
  );
}
