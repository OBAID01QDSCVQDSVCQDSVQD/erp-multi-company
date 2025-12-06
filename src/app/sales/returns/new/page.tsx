'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface BL {
  _id: string;
  numero: string;
  dateDoc: string;
  customerId?: any;
  lignes?: Array<{
    _id?: string;
    productId?: string;
    designation: string;
    quantite: number;
    qtyLivree?: number;
    prixUnitaireHT: number;
    uomCode?: string;
    tvaPct?: number;
    remisePct?: number;
  }>;
}

interface Customer {
  _id: string;
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
}

export default function NewReturnPage() {
  const router = useRouter();
  const { tenantId } = useTenantId();
  const [loading, setLoading] = useState(false);
  const [bls, setBls] = useState<BL[]>([]);
  const [selectedBL, setSelectedBL] = useState<BL | null>(null);
  const [blSearch, setBlSearch] = useState('');
  const [showBlDropdown, setShowBlDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    dateDoc: new Date().toISOString().split('T')[0],
    notes: '',
  });
  
  const [returnLines, setReturnLines] = useState<Array<{
    productId: string;
    designation: string;
    quantite: number;
    quantiteMax: number;
    prixUnitaireHT: number;
    uomCode?: string;
    tvaPct: number;
  }>>([]);

  useEffect(() => {
    if (tenantId) {
      fetchBLs();
    }
  }, [tenantId]);

  const fetchBLs = async () => {
    try {
      const response = await fetch('/api/sales/deliveries', {
        headers: { 'X-Tenant-Id': tenantId },
      });
      if (response.ok) {
        const data = await response.json();
        setBls(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching BLs:', error);
    }
  };

  const filteredBLs = bls.filter((bl) => {
    const searchLower = blSearch.toLowerCase();
    return bl.numero.toLowerCase().includes(searchLower);
  });

  const handleSelectBL = (bl: BL) => {
    setSelectedBL(bl);
    setBlSearch(bl.numero);
    setShowBlDropdown(false);
    
    // Initialize return lines from BL lines
    if (bl.lignes) {
      const lines = bl.lignes.map((line) => ({
        productId: line.productId || '',
        designation: line.designation,
        quantite: 0,
        quantiteMax: line.qtyLivree || line.quantite || 0,
        prixUnitaireHT: line.prixUnitaireHT || 0,
        uomCode: line.uomCode || '',
        tvaPct: line.tvaPct || 0,
      }));
      setReturnLines(lines);
    }
  };

  const updateReturnLineQuantity = (index: number, quantite: number) => {
    const newLines = [...returnLines];
    const maxQty = newLines[index].quantiteMax;
    newLines[index].quantite = Math.min(Math.max(0, quantite), maxQty);
    setReturnLines(newLines);
  };

  const removeReturnLine = (index: number) => {
    setReturnLines(returnLines.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBL) {
      toast.error('Veuillez sélectionner un BL');
      return;
    }
    
    const validLines = returnLines.filter(line => line.quantite > 0);
    if (validLines.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne avec une quantité retournée');
      return;
    }

    setLoading(true);
    try {
      // Prepare return document
      const returnDoc = {
        blId: selectedBL._id,
        customerId: selectedBL.customerId?._id || selectedBL.customerId,
        dateDoc: formData.dateDoc,
        notes: formData.notes,
        lignes: validLines.map(line => ({
          productId: line.productId,
          designation: line.designation,
          quantite: line.quantite,
          prixUnitaireHT: line.prixUnitaireHT,
          uomCode: line.uomCode,
          tvaPct: line.tvaPct ?? 0,
        })),
      };

      const response = await fetch('/api/sales/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantId,
        },
        body: JSON.stringify(returnDoc),
      });

      if (response.ok) {
        toast.success('Retour créé avec succès');
        router.push('/sales/returns');
      } else {
        const error = await response.json();
        const errorMessage = error.error || error.details || 'Erreur lors de la création du retour';
        toast.error(errorMessage, { duration: 5000 });
      }
    } catch (error) {
      console.error('Error creating return:', error);
      toast.error('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customer: any): string => {
    if (!customer) return 'N/A';
    if (typeof customer === 'object') {
      return customer.raisonSociale || `${customer.nom || ''} ${customer.prenom || ''}`.trim() || 'N/A';
    }
    return 'N/A';
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/sales/returns')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nouveau retour</h1>
            <p className="text-sm text-gray-600 mt-1">Créer un bon de retour</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* BL Selection */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Sélectionner le BL</h2>
            
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bon de livraison *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={blSearch}
                  onChange={(e) => {
                    setBlSearch(e.target.value);
                    setShowBlDropdown(true);
                  }}
                  onFocus={() => setShowBlDropdown(true)}
                  placeholder="Rechercher un BL..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {selectedBL && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBL(null);
                      setBlSearch('');
                      setReturnLines([]);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                )}
                
                {showBlDropdown && filteredBLs.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredBLs.map((bl) => (
                      <button
                        key={bl._id}
                        type="button"
                        onClick={() => handleSelectBL(bl)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="font-medium">{bl.numero}</div>
                        <div className="text-sm text-gray-600">
                          {new Date(bl.dateDoc).toLocaleDateString('fr-FR')} - {getCustomerName(bl.customerId)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedBL && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">BL:</span> {selectedBL.numero} | 
                  <span className="font-medium ml-2">Date:</span> {new Date(selectedBL.dateDoc).toLocaleDateString('fr-FR')} |
                  <span className="font-medium ml-2">Client:</span> {getCustomerName(selectedBL.customerId)}
                </p>
              </div>
            )}
          </div>

          {/* Return Lines */}
          {selectedBL && (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Lignes de retour</h2>
              </div>

              {returnLines.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucune ligne disponible dans ce BL</p>
              ) : (
                <div className="space-y-4">
                  {returnLines.map((line, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{line.designation}</p>
                          <p className="text-sm text-gray-600">
                            Quantité livrée: {line.quantiteMax} {line.uomCode || ''}
                          </p>
                        </div>
                        {returnLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeReturnLine(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantité à retourner *
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={line.quantiteMax}
                            value={line.quantite}
                            onChange={(e) => updateReturnLineQuantity(index, parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Maximum: {line.quantiteMax} {line.uomCode || ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Details */}
          {selectedBL && returnLines.some(line => line.quantite > 0) && (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Détails du retour</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date du retour *
                </label>
                <input
                  type="date"
                  value={formData.dateDoc}
                  onChange={(e) => setFormData({ ...formData, dateDoc: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (optionnel)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push('/sales/returns')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !selectedBL || !returnLines.some(line => line.quantite > 0)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Création...' : 'Créer le retour'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

