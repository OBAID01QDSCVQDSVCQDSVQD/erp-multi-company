'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, ShoppingBagIcon, MagnifyingGlassIcon, XMarkIcon, ArrowsRightLeftIcon, EyeIcon, PencilIcon, TrashIcon, BoldIcon, ListBulletIcon, PaintBrushIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';

interface Product { _id: string; sku: string; nom: string; referenceClient?: string; prixVenteHT?: number; taxCode?: string; uomVenteCode?: string; categorieCode?: string; estStocke: boolean; actif: boolean; }

export default function ProductsPage() {
  const { tenantId } = useTenantId();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [viewing, setViewing] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ code: '', nom: '', description: '' });
  const [autoGenerateCode, setAutoGenerateCode] = useState(true);
  const [units, setUnits] = useState<{ code:string; libelle:string; categorie:string }[]>([]);
  const [taxRates, setTaxRates] = useState<{ code:string; libelle:string; tauxPct:number }[]>([]);
  const [categories, setCategories] = useState<{ code:string; nom:string; description?:string }[]>([]);
  const [activeTab, setActiveTab] = useState<'products'|'categories'>('products');
  const [editingCategoryCode, setEditingCategoryCode] = useState<string | null>(null);
  const [viewingCategory, setViewingCategory] = useState<boolean>(false);
  const productDescRef = useRef<HTMLDivElement>(null);
  const categoryDescRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<{ 
    nom:string; sku:string; barcode?:string; categorieCode?:string; description?:string; referenceClient?: string;
    prixVenteHT?:number; taxCode?:string; uomVenteCode?:string; 
    typeProduit:'service'|'stocke'; min?:number; max?:number; leadTimeJours?:number; 
    actif:boolean; tagsText?:string;
  }>({ nom:'', sku:'', barcode: '', categorieCode: undefined, description:'', referenceClient:'', prixVenteHT: undefined, taxCode: undefined, uomVenteCode: undefined, typeProduit:'service', min: undefined, max: undefined, leadTimeJours: undefined, actif:true, tagsText:'' });

  useEffect(() => { fetchProducts(); }, [tenantId]);
  useEffect(() => { if (tenantId) loadRefs(); }, [tenantId]);

  const normalized = (s: string) => s.toLowerCase();
  const filteredCategories = useMemo(() => {
    const query = normalized(q || '');
    if (!query) return categories;
    return categories.filter(c =>
      normalized(c.nom).includes(query) || normalized(c.code).includes(query)
    );
  }, [categories, q]);

  const categoryNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.code, c.nom));
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const query = normalized(q || '');
    if (!query) return products;
    return products.filter(p => {
      const name = normalized(p.nom || '');
      const ref = normalized(p.referenceClient || '');
      const catName = normalized(categoryNameByCode.get(p.categorieCode || '') || '');
      return name.includes(query) || ref.includes(query) || catName.includes(query);
    });
  }, [products, q, categoryNameByCode]);

  const fetchProducts = async () => {
    try {
      if (!tenantId) return;
      const response = await fetch('/api/products', { headers: { 'X-Tenant-Id': tenantId } });
      if (response.ok) {
        const data = await response.json();
        setProducts(data.items || []);
      } else {
        setError('Erreur lors du chargement des produits');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'product' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-purple-100 text-purple-800';
  };

  const getTypeLabel = (type: string) => {
    return type === 'product' ? 'Produit' : 'Service';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
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

  function handleEditCategory(c: {code:string; nom:string; description?:string}) {
    setEditingCategoryCode(c.code);
    setViewingCategory(false);
    setCategoryForm({ code: c.code, nom: c.nom, description: c.description || '' });
    setAutoGenerateCode(false);
    setShowCategoryModal(true);
    // Set editor content
    setTimeout(() => {
      if (categoryDescRef.current) {
        categoryDescRef.current.innerHTML = c.description || '';
      }
    }, 0);
  }

  function handleViewCategory(c: {code:string; nom:string; description?:string}) {
    setEditingCategoryCode(c.code);
    setViewingCategory(true);
    setCategoryForm({ code: c.code, nom: c.nom, description: c.description || '' });
    setAutoGenerateCode(false);
    setShowCategoryModal(true);
  }

  async function handleDeleteCategory(code: string) {
    if (!tenantId) return;
    if (!confirm(`Supprimer la catégorie ${code} ?`)) return;
    const res = await fetch(`/api/product-categories/${code}`, { method: 'DELETE', headers: { 'X-Tenant-Id': tenantId } });
    if (res.ok) {
      await loadRefs();
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      toast.textContent = 'Catégorie supprimée';
      document.body.appendChild(toast);
      setTimeout(()=>toast.remove(), 2500);
    } else {
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      toast.textContent = 'Erreur lors de la suppression';
      document.body.appendChild(toast);
      setTimeout(()=>toast.remove(), 3500);
    }
  }

  async function addProduct() {
    if (!tenantId) return;
    setForm({ nom:'', sku:'', barcode: '', categorieCode: undefined, description:'', referenceClient:'', prixVenteHT: undefined, taxCode: undefined, uomVenteCode: undefined, typeProduit:'service', min: undefined, max: undefined, leadTimeJours: undefined, actif:true, tagsText:'' });
    setEditingSku(null);
    setViewing(false);
    setShowModal(true);
    // Reset editor content
    setTimeout(() => {
      if (productDescRef.current) {
        productDescRef.current.innerHTML = '';
      }
    }, 0);
  }

  async function loadRefs() {
    try {
      const [u, t, c] = await Promise.all([
        fetch('/api/units/union', { headers: { 'X-Tenant-Id': tenantId! } }),
        fetch('/api/tva/rates?actif=false', { headers: { 'X-Tenant-Id': tenantId! } }),
        fetch('/api/product-categories', { headers: { 'X-Tenant-Id': tenantId! } }),
      ]);
      if (u.ok) {
        const data = await u.json();
        setUnits((data.data||[]).map((x:any)=>({ code:x.code, libelle:x.libelle, categorie:x.categorie })));
      }
      if (t.ok) {
        const data = await t.json();
        setTaxRates((data.data||[]).map((x:any)=>({ code:x.code, libelle:x.libelle, tauxPct:x.tauxPct })));
      }
      if (c.ok) {
        const data = await c.json();
        setCategories((data.data||[]).map((x:any)=>({ code:x.code, nom:x.nom, description:x.description })));
      }
    } catch (e) {
      console.error('refs load failed', e);
    }
  }

  async function submitProduct() {
    if (!tenantId || !form.nom) { alert('Nom requis'); return; }
    if (form.prixVenteHT !== undefined && form.prixVenteHT < 0) { alert('Prix HT invalide'); return; }
    try {
      setSaving(true);
      // Find tvaPct from selected taxCode
      const selectedTax = taxRates.find(r => r.code === form.taxCode);
      
      const payload:any = {
        nom: form.nom,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        categorieCode: form.categorieCode || undefined,
        description: form.description || undefined,
        prixVenteHT: form.prixVenteHT ?? undefined,
        referenceClient: form.referenceClient || undefined,
        taxCode: form.taxCode || undefined,
        tvaPct: selectedTax ? selectedTax.tauxPct : undefined,
        uomVenteCode: form.uomVenteCode || undefined,
        estStocke: form.typeProduit === 'stocke',
        min: form.typeProduit === 'stocke' ? (form.min ?? undefined) : undefined,
        max: form.typeProduit === 'stocke' ? (form.max ?? undefined) : undefined,
        leadTimeJours: form.typeProduit === 'stocke' ? (form.leadTimeJours ?? undefined) : undefined,
        actif: form.actif,
        tags: (form.tagsText || '').split(',').map(t=>t.trim()).filter(Boolean),
      };
      const url = editingSku ? `/api/products/${editingSku}` : '/api/products';
      const method = editingSku ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers:{ 'Content-Type':'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify(payload) });
      if (res.ok) {
        setShowModal(false);
        setEditingSku(null);
        await fetchProducts();
      } else {
        const txt = await res.text();
        alert('Erreur: ' + txt);
      }
    } finally {
      setSaving(false);
    }
  }

  function regenerateSku() {
    const year = new Date().getFullYear();
    const seq = String(Math.floor(10000 + Math.random()*90000));
    setForm(prev => ({ ...prev, sku: `P-${year}${seq}` }));
  }

  const selectedTv = taxRates.find(r => r.code === form.taxCode);
  const prixTTC = form.prixVenteHT !== undefined && selectedTv ? Math.round((form.prixVenteHT * (1 + selectedTv.tauxPct/100)) * 1000)/1000 : undefined;

  async function onChangeCategorie(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === '__create__') {
      const code = prompt('Code catégorie ? (ex: EQUIPEMENT)') || '';
      const nom = prompt('Nom de la catégorie ?') || '';
      if (!code || !nom || !tenantId) { return; }
      const res = await fetch('/api/product-categories', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId }, body: JSON.stringify({ code, nom, actif: true }) });
      if (res.ok) {
        await loadRefs();
        setForm(prev => ({ ...prev, categorieCode: code.toUpperCase() }));
      } else {
        alert('Erreur lors de la création de la catégorie');
      }
      return;
    }
    setForm(prev => ({ ...prev, categorieCode: value || undefined }));
  }

  async function handleDelete(sku: string) {
    if (!tenantId) return;
    if (!confirm(`Supprimer le produit ${sku} ?`)) return;
    const res = await fetch(`/api/products/${sku}`, { method: 'DELETE', headers: { 'X-Tenant-Id': tenantId } });
    if (res.ok) {
      await fetchProducts();
    } else {
      alert('Erreur lors de la suppression');
    }
  }

  function handleEdit(p: Product) {
    setEditingSku(p.sku);
    setViewing(false);
    setForm({
      nom: p.nom,
      sku: p.sku,
      barcode: (p as any).barcode || '',
      categorieCode: p.categorieCode,
      description: (p as any).description || '',
      referenceClient: p.referenceClient || '',
      prixVenteHT: p.prixVenteHT,
      taxCode: p.taxCode,
      uomVenteCode: p.uomVenteCode,
      typeProduit: p.estStocke ? 'stocke' : 'service',
      min: (p as any).min,
      max: (p as any).max,
      leadTimeJours: (p as any).leadTimeJours,
      actif: p.actif,
      tagsText: (p as any).tags ? (p as any).tags.join(', ') : '',
    });
    setShowModal(true);
    // Set editor content
    setTimeout(() => {
      if (productDescRef.current) {
        productDescRef.current.innerHTML = (p as any).description || '';
      }
    }, 0);
  }

  function handleView(p: Product) {
    setEditingSku(p.sku);
    setViewing(true);
    setForm({
      nom: p.nom,
      sku: p.sku,
      barcode: (p as any).barcode || '',
      categorieCode: p.categorieCode,
      description: (p as any).description || '',
      referenceClient: p.referenceClient || '',
      prixVenteHT: p.prixVenteHT,
      taxCode: p.taxCode,
      uomVenteCode: p.uomVenteCode,
      typeProduit: p.estStocke ? 'stocke' : 'service',
      min: (p as any).min,
      max: (p as any).max,
      leadTimeJours: (p as any).leadTimeJours,
      actif: p.actif,
      tagsText: (p as any).tags ? (p as any).tags.join(', ') : '',
    });
    setShowModal(true);
  }

  async function addCategory() {
    if (!tenantId) return;
    setCategoryForm({ code: '', nom: '', description: '' });
    setAutoGenerateCode(true);
    setEditingCategoryCode(null);
    setViewingCategory(false);
    setShowCategoryModal(true);
    // Reset editor content
    setTimeout(() => {
      if (categoryDescRef.current) {
        categoryDescRef.current.innerHTML = '';
      }
    }, 0);
  }

  function generateCategoryCode(nom: string): string {
    // Génère un code basé sur le nom (premières lettres de chaque mot)
    const words = nom.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].substring(0, 4).toUpperCase();
    }
    return words.map(w => w.charAt(0)).join('').substring(0, 6).toUpperCase();
  }

  function handleCategoryNomChange(nom: string) {
    setCategoryForm({ ...categoryForm, nom });
    if (autoGenerateCode) {
      const generatedCode = generateCategoryCode(nom);
      setCategoryForm(prev => ({ ...prev, code: generatedCode }));
    }
  }

  async function submitCategory() {
    if (!tenantId) return;
    try {
      const url = editingCategoryCode ? `/api/product-categories/${editingCategoryCode}` : '/api/product-categories';
      const method = editingCategoryCode ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenantId },
        body: JSON.stringify(categoryForm)
      });
      if (res.ok) {
        setShowCategoryModal(false);
        // Recharger les catégories
        const categoriesRes = await fetch('/api/product-categories', { headers: { 'X-Tenant-Id': tenantId } });
        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories((data.data||[]).map((x:any)=>({ code:x.code, nom:x.nom, description:x.description })));
        }
        showToast('Catégorie créée avec succès', 'success');
      } else {
        const txt = await res.text();
        showToast('Erreur: ' + txt, 'error');
      }
    } catch (e) {
      showToast('Erreur: ' + e, 'error');
    }
  }

  function showToast(message: string, type: 'success'|'error' = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 ${type==='success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, type==='success' ? 3000 : 5000);
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Produits & Services</h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Gérez votre catalogue de produits et services
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input 
                value={q} 
                onChange={(e)=>setQ(e.target.value)} 
                placeholder="Rechercher (nom, sku, tags)" 
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm sm:text-base"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button onClick={()=>setActiveTab('products')} className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab==='products' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Produits</button>
            <button onClick={()=>setActiveTab('categories')} className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab==='categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Catégories</button>
          </nav>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Categories List (tab) */}
        {activeTab==='categories' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <span className="mr-2">📁</span>
                  Catégories ({filteredCategories.length})
                </h3>
                <button onClick={addCategory} className="inline-flex items-center px-3 py-1.5 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700"><PlusIcon className="h-4 w-4 mr-1"/>Nouvelle catégorie</button>
              </div>
            </div>
            <div className="p-6">
              {filteredCategories.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune catégorie.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCategories.map(category => (
                      <tr key={category.code}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{category.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{category.nom}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center space-x-3">
                            <button onClick={()=>handleViewCategory(category)} className="text-gray-600 hover:text-gray-900" title="Voir"><EyeIcon className="h-5 w-5" /></button>
                            <button onClick={()=>handleEditCategory(category)} className="text-indigo-600 hover:text-indigo-900" title="Modifier"><PencilIcon className="h-5 w-5" /></button>
                            <button onClick={()=>handleDeleteCategory(category.code)} className="text-red-600 hover:text-red-900" title="Supprimer"><TrashIcon className="h-5 w-5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Products list (tab) */}
        {activeTab==='products' ? (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <span className="mr-2">🛍️</span>
                  Produits ({filteredProducts.length})
                </h3>
                <button onClick={addProduct} className="inline-flex items-center px-3 py-1.5 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700"><PlusIcon className="h-4 w-4 mr-1"/>Nouveau produit</button>
              </div>
            </div>
            <div className="p-6">
              {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBagIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun produit</h3>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer votre premier produit ou service.
            </p>
                </div>
                              ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Réf</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prix (HT)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TVA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((p) => (
                  <tr key={p._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{p.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.referenceClient ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.nom}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.estStocke ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {p.estStocke ? 'ARTICLE' : 'SERVICE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.prixVenteHT ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.taxCode ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.uomVenteCode ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.actif ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{p.actif ? 'ACTIF' : 'INACTIF'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-3">
                        <button onClick={()=>handleView(p)} className="text-gray-600 hover:text-gray-900" title="Voir"><EyeIcon className="h-5 w-5" /></button>
                        <button onClick={()=>handleEdit(p)} className="text-indigo-600 hover:text-indigo-900" title="Modifier"><PencilIcon className="h-5 w-5" /></button>
                        <button onClick={()=>handleDelete(p.sku)} className="text-red-600 hover:text-red-900" title="Supprimer"><TrashIcon className="h-5 w-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">🛍️</span>
                <h3 className="text-lg font-semibold text-gray-900">{viewing ? 'Voir produit' : (editingSku ? 'Modifier produit' : 'Nouveau produit')}</h3>
              </div>
              <button onClick={()=>setShowModal(false)} className="text-gray-500 hover:text-gray-700" type="button"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="px-6 pb-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informations principales */}
              <div className="md:col-span-2">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Informations principales</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit *</label>
                    <input value={form.nom} onChange={(e)=>setForm({...form, nom:e.target.value})} placeholder="Ex : Clavier mécanique" className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Référence client</label>
                    <input value={form.referenceClient || ''} onChange={(e)=>setForm({...form, referenceClient:e.target.value})} placeholder="Ex : REF-CL-2025" className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code SKU</label>
                    <div className="flex items-center space-x-2">
                      <input value={form.sku} readOnly placeholder="AUTO-GÉNÉRÉ" className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50" />
                      {!viewing && !editingSku && (
                        <button type="button" onClick={regenerateSku} className="px-2 py-2 border rounded-md text-sm text-gray-700 hover:bg-gray-50" title="Régénérer"><ArrowsRightLeftIcon className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code-barres</label>
                    <input value={form.barcode || ''} onChange={(e)=>setForm({...form, barcode: e.target.value})} placeholder="Ex : 1234567890123" className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select value={form.categorieCode || ''} onChange={onChangeCategorie} className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing}>
                      <option value="">—</option>
                      {categories.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.nom}</option>
                      ))}
                      <option value="__create__">+ Ajouter une catégorie…</option>
                    </select>
                    {form.categorieCode === '__create__' && (
                      <button onClick={addCategory} className="mt-2 text-sm text-indigo-600 hover:text-indigo-800">Créer une nouvelle catégorie</button>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    {viewing ? (
                      <div className="border border-gray-300 rounded-md bg-gray-50">
                        <div 
                          className="min-h-[80px] px-3 py-2"
                          dangerouslySetInnerHTML={{ __html: form.description || '' }}
                        />
                      </div>
                    ) : (
                      <div className="border border-gray-300 rounded-md">
                        {/* Toolbar */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                          <button
                            type="button"
                            onClick={() => document.execCommand('bold', false)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="Gras"
                          >
                            <BoldIcon className="w-4 h-4" />
                          </button>
                          <div className="h-5 w-px bg-gray-300" />
                          <input
                            type="color"
                            onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                            className="w-6 h-6 cursor-pointer"
                            title="Couleur"
                            defaultValue="#000000"
                          />
                          <div className="h-5 w-px bg-gray-300" />
                          <button
                            type="button"
                            onClick={() => document.execCommand('insertUnorderedList', false)}
                            className="p-1.5 hover:bg-gray-200 rounded"
                            title="Liste"
                          >
                            <ListBulletIcon className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Editable div */}
                        <div className="relative">
                          {!form.description && (
                            <div className="absolute inset-0 px-3 py-2 text-gray-400 pointer-events-none">
                              Ex : Clavier mécanique rétroéclairé
                            </div>
                          )}
                          <div
                            ref={productDescRef}
                            contentEditable
                            onInput={(e) => setForm({...form, description: e.currentTarget.innerHTML})}
                            onBlur={() => {
                              if (productDescRef.current && productDescRef.current.innerHTML !== form.description) {
                                setForm({...form, description: productDescRef.current.innerHTML});
                              }
                            }}
                            className="min-h-[80px] px-3 py-2 focus:outline-none relative"
                            style={{ whiteSpace: 'pre-wrap' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Prix & TVA</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix HT (TND)</label>
                    <input type="number" value={form.prixVenteHT ?? ''} onChange={(e)=>setForm({...form, prixVenteHT: e.target.value? Number(e.target.value): undefined})} placeholder="Ex : 250" className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">TVA</label>
                    <select value={form.taxCode || ''} onChange={(e)=>setForm({...form, taxCode: e.target.value || undefined})} className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing}>
                      <option value="">—</option>
                      {taxRates.map(r => (
                        <option key={r.code} value={r.code}>{r.tauxPct} % ({r.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix TTC (auto)</label>
                    <input value={prixTTC ?? ''} readOnly placeholder="Calcul automatique" className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Unité & Stock</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unité de vente</label>
                    <select value={form.uomVenteCode || ''} onChange={(e)=>setForm({...form, uomVenteCode: e.target.value || undefined})} className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing}>
                      <option value="">—</option>
                      {units.map(u => (
                        <option key={u.code} value={u.code}>📦 {u.code} - {u.libelle}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de produit</label>
                    <div className="flex items-center space-x-4 mt-2">
                      <label className="inline-flex items-center space-x-2"><input type="radio" checked={form.typeProduit==='service'} onChange={()=>setForm({...form, typeProduit:'service'})} disabled={viewing} /><span>Service</span></label>
                      <label className="inline-flex items-center space-x-2"><input type="radio" checked={form.typeProduit==='stocke'} onChange={()=>setForm({...form, typeProduit:'stocke'})} disabled={viewing} /><span>Article stocké</span></label>
                    </div>
                  </div>
                </div>
                {form.typeProduit==='stocke' && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantité minimale</label>
                      <input type="number" value={form.min ?? ''} onChange={(e)=>setForm({...form, min: e.target.value? Number(e.target.value): undefined})} className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantité maximale</label>
                      <input type="number" value={form.max ?? ''} onChange={(e)=>setForm({...form, max: e.target.value? Number(e.target.value): undefined})} className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Délai de réappro (jours)</label>
                      <input type="number" value={form.leadTimeJours ?? ''} onChange={(e)=>setForm({...form, leadTimeJours: e.target.value? Number(e.target.value): undefined})} className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                    </div>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Statut</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex items-center space-x-2"><input type="checkbox" checked={form.actif} onChange={(e)=>setForm({...form, actif:e.target.checked})} disabled={viewing} /><span>Actif</span></label>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (séparés par virgule)</label>
                    <input value={form.tagsText} onChange={(e)=>setForm({...form, tagsText:e.target.value})} placeholder="Ex : new, promo, premium" className="w-full px-3 py-2 border border-gray-300 rounded-md" disabled={viewing} />
                  </div>
            </div>
          </div>
                      </div>
                        </div>
            <div className="flex justify-end space-x-3 px-6 py-4 border-t sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={()=>setShowModal(false)} className="px-4 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md">Fermer</button>
              {!viewing && (
                <button onClick={submitProduct} disabled={saving} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">{saving? 'Sauvegarde...' : (editingSku ? 'Enregistrer' : 'Créer le produit')}</button>
                            )}
                          </div>
                        </div>
                      </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowCategoryModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">📁</span>
                <h3 className="text-lg font-semibold text-gray-900">{viewingCategory ? 'Voir catégorie' : (editingCategoryCode ? 'Modifier catégorie' : 'Nouvelle catégorie')}</h3>
              </div>
              <button onClick={()=>setShowCategoryModal(false)} className="text-gray-500 hover:text-gray-700" type="button"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input type="text" value={categoryForm.nom} onChange={(e)=>handleCategoryNomChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ex: Électronique" disabled={viewingCategory} />
                    </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                    <div className="flex items-center space-x-2">
                    <input type="text" value={categoryForm.code} onChange={(e)=>setCategoryForm({...categoryForm, code: e.target.value.toUpperCase()})} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="ex: ELEC" disabled={!!editingCategoryCode || viewingCategory} />
                    {!editingCategoryCode && !viewingCategory && (<button type="button" onClick={()=>setAutoGenerateCode(!autoGenerateCode)} className={`px-3 py-2 text-sm rounded-md border ${autoGenerateCode ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-gray-50 text-gray-700 border-gray-300'}`}>
                      {autoGenerateCode ? 'Auto' : 'Manuel'}
                    </button>)}
                  </div>
                  {autoGenerateCode && !editingCategoryCode && !viewingCategory && (
                    <p className="text-xs text-gray-500 mt-1">Le code sera généré automatiquement à partir du nom</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  {viewingCategory ? (
                    <div className="border border-gray-300 rounded-md bg-gray-50">
                      <div 
                        className="min-h-[80px] px-3 py-2"
                        dangerouslySetInnerHTML={{ __html: categoryForm.description || '' }}
                      />
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-md">
                      {/* Toolbar */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                        <button
                          type="button"
                          onClick={() => document.execCommand('bold', false)}
                          className="p-1.5 hover:bg-gray-200 rounded"
                          title="Gras"
                        >
                          <BoldIcon className="w-4 h-4" />
                        </button>
                        <div className="h-5 w-px bg-gray-300" />
                        <input
                          type="color"
                          onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                          className="w-6 h-6 cursor-pointer"
                          title="Couleur"
                          defaultValue="#000000"
                        />
                        <div className="h-5 w-px bg-gray-300" />
                        <button
                          type="button"
                          onClick={() => document.execCommand('insertUnorderedList', false)}
                          className="p-1.5 hover:bg-gray-200 rounded"
                          title="Liste"
                        >
                          <ListBulletIcon className="w-4 h-4" />
                        </button>
                      </div>
                      {/* Editable div */}
                      <div className="relative">
                        {!categoryForm.description && (
                          <div className="absolute inset-0 px-3 py-2 text-gray-400 pointer-events-none">
                            Description de la catégorie
                          </div>
                        )}
                        <div
                          ref={categoryDescRef}
                          contentEditable
                          onInput={(e) => setCategoryForm({...categoryForm, description: e.currentTarget.innerHTML})}
                          onBlur={() => {
                            if (categoryDescRef.current && categoryDescRef.current.innerHTML !== categoryForm.description) {
                              setCategoryForm({...categoryForm, description: categoryDescRef.current.innerHTML});
                            }
                          }}
                          className="min-h-[80px] px-3 py-2 focus:outline-none relative"
                          style={{ whiteSpace: 'pre-wrap' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 px-6 py-4 border-t">
              <button onClick={()=>setShowCategoryModal(false)} className="px-4 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md">Annuler</button>
              {!viewingCategory && (
                <button onClick={submitCategory} disabled={!categoryForm.code || !categoryForm.nom} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md disabled:opacity-50">{editingCategoryCode ? 'Enregistrer' : 'Créer'}</button>
        )}
      </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
