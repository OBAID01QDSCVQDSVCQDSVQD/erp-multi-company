'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { ShoppingCartIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';
import toast from 'react-hot-toast';

interface PurchaseOrder {
  _id: string;
  numero: string;
  dateDoc: string;
  fournisseurId?: string;
  fournisseurNom?: string;
  fournisseurCode?: string;
  statut?: string;
  conditionsPaiement?: string;
  adresseLivraison?: string;
  notes?: string;
  totalBaseHT?: number;
  totalRemise?: number;
  totalTVA?: number;
  timbreFiscal?: number;
  totalTTC: number;
  devise?: string;
  lignes?: any[];
}

interface Supplier {
  _id: string;
  raisonSociale?: string;
  nom?: string;
  prenom?: string;
  matriculeFiscale?: string;
  telephone?: string;
  adresseFacturation?: any;
  code?: string;
}

export default function ViewPurchaseOrderPage() {
  const router = useRouter();
  const params = useParams();
  const { tenantId } = useTenantId();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId && params.id) {
      fetchOrder();
    }
  }, [tenantId, params.id]);

  const fetchOrder = async () => {
    try {
      if (!tenantId) {
        console.error('No tenantId found');
        return;
      }
      console.log('Fetching order:', params.id, 'for tenant:', tenantId);
      setLoading(true);
      const response = await fetch(`/api/purchases/orders/${params.id}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Order data:', data);
        setOrder(data);
        
        // Fetch supplier if fournisseurId exists
        if (data.fournisseurId) {
          fetchSupplier(data.fournisseurId);
        }
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast.error('Erreur lors du chargement de la commande: ' + (errorData.error || 'Unknown'));
        router.push('/purchases/orders');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      toast.error('Erreur lors du chargement de la commande');
      router.push('/purchases/orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplier = async (supplierId: string) => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}`, {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Supplier data:', data);
        setSupplier(data);
      }
    } catch (err) {
      console.error('Error fetching supplier:', err);
    }
  };

  const getStatusBadge = (statut: string) => {
    const colors: { [key: string]: string } = {
      'BROUILLON': 'bg-gray-100 text-gray-800',
      'VALIDEE': 'bg-green-100 text-green-800',
      'RECEPTION_PARTIELLE': 'bg-yellow-100 text-yellow-800',
      'CLOTUREE': 'bg-blue-100 text-blue-800',
      'ANNULEE': 'bg-red-100 text-red-800'
    };
    
    const labels: { [key: string]: string } = {
      'BROUILLON': 'Brouillon',
      'VALIDEE': 'Validée',
      'RECEPTION_PARTIELLE': 'Réception partielle',
      'CLOTUREE': 'Clôturée',
      'ANNULEE': 'Annulée'
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[statut] || colors['BROUILLON']}`}>
        {labels[statut] || statut}
      </span>
    );
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

  if (!order) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Commande introuvable</p>
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
              onClick={() => router.push('/purchases/orders')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShoppingCartIcon className="w-8 h-8" /> Commande d'achat {order.numero}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Créée le {new Date(order.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div>
            {getStatusBadge(order.statut || 'BROUILLON')}
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm text-gray-600">Numéro de commande</label>
              <p className="text-lg font-bold text-blue-600">{order.numero}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Date</label>
              <p className="text-lg font-medium">{new Date(order.dateDoc).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </div>
            {order.adresseLivraison && (
              <div>
                <label className="text-sm text-gray-600">Adresse de livraison</label>
                <p className="text-lg font-medium">{order.adresseLivraison}</p>
              </div>
            )}
            {order.conditionsPaiement && (
              <div>
                <label className="text-sm text-gray-600">Conditions de paiement</label>
                <p className="text-lg font-medium">{order.conditionsPaiement}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-600">Fournisseur</label>
              {supplier ? (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-1">
                  <p className="text-lg font-medium text-gray-900">
                    {supplier.raisonSociale || `${supplier.nom || ''} ${supplier.prenom || ''}`.trim() || 'N/A'}
                  </p>
                  {supplier.matriculeFiscale && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Matricule fiscal:</span> {supplier.matriculeFiscale}
                    </p>
                  )}
                  {supplier.adresseFacturation && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Adresse:</span> {[
                        supplier.adresseFacturation.ligne1,
                        supplier.adresseFacturation.ligne2,
                        supplier.adresseFacturation.codePostal,
                        supplier.adresseFacturation.ville
                      ].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {supplier.telephone && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Téléphone:</span> {supplier.telephone}
                    </p>
                  )}
                  {supplier.code && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Code:</span> {supplier.code}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-lg font-medium">Chargement...</p>
              )}
            </div>
          </div>

          {/* Lines Table */}
          {order.lignes && order.lignes.length > 0 && (
            <div className="mt-6">
              <table className="w-full">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    {order.lignes.some((l: any) => l.productId) && (
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Produit</th>
                    )}
                    {order.lignes.some((l: any) => l.reference) && (
                      <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Référence</th>
                    )}
                    {order.lignes.some((l: any) => l.designation) && (
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Désignation</th>
                    )}
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Qté</th>
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Unité</th>
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Prix HT</th>
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Remise %</th>
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">TVA %</th>
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Total HT</th>
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Total TVA</th>
                    <th className="px-2 py-3 text-left text-sm font-bold text-gray-700">Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.lignes.map((line: any, index: number) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-blue-50' : 'bg-pink-50'}>
                      {order.lignes.some((l: any) => l.productId) && (
                        <td className="px-4 py-3 text-sm font-medium">{line.productId ? 'Produit' : '-'}</td>
                      )}
                      {order.lignes.some((l: any) => l.reference) && (
                        <td className="px-2 py-3 text-sm">{line.reference || '-'}</td>
                      )}
                      {order.lignes.some((l: any) => l.designation) && (
                        <td className="px-4 py-3 text-sm">
                          {line.designation ? (
                            <div dangerouslySetInnerHTML={{ __html: line.designation }} />
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      <td className="px-2 py-3 text-sm">{line.quantite}</td>
                      <td className="px-2 py-3 text-sm">{line.unite || 'PCE'}</td>
                      <td className="px-2 py-3 text-sm">{line.prixUnitaireHT?.toFixed(3)} {order.devise}</td>
                      <td className="px-2 py-3 text-sm">{line.remisePct || 0}%</td>
                      <td className="px-2 py-3 text-sm">{line.tvaPct || 0}%</td>
                      <td className="px-2 py-3 text-sm font-medium">
                        {(line.totalLigneHT || ((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100)))).toFixed(3)} {order.devise}
                      </td>
                      <td className="px-2 py-3 text-sm font-medium">
                        {(line.totalLigneTVA || (((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * ((line.tvaPct || 0) / 100))).toFixed(3)} {order.devise}
                      </td>
                      <td className="px-2 py-3 text-sm font-medium text-blue-600">
                        {(line.totalLigneTTC || (((line.quantite * line.prixUnitaireHT) * (1 - ((line.remisePct || 0) / 100))) * (1 + (line.tvaPct || 0) / 100))).toFixed(3)} {order.devise}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-80 bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total HT</span>
                <span className="font-medium text-gray-900">{(order.totalBaseHT || 0).toFixed(3)} {order.devise}</span>
              </div>
              {order.totalRemise && order.totalRemise > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Total Remise</span>
                  <span className="font-medium text-red-600">-{order.totalRemise.toFixed(3)} {order.devise}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Total TVA</span>
                <span className="font-medium text-gray-900">{order.totalTVA?.toFixed(3) || 0} {order.devise}</span>
              </div>
              {order.timbreFiscal && order.timbreFiscal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Timbre fiscal</span>
                  <span className="font-medium text-gray-900">{order.timbreFiscal.toFixed(3)} {order.devise}</span>
                </div>
              )}
              <div className="border-t border-blue-200 pt-3 flex justify-between text-lg font-bold">
                <span className="text-gray-900">Total TTC</span>
                <span className="text-blue-600">{order.totalTTC?.toFixed(3)} {order.devise}</span>
              </div>
            </div>
          </div>
          
          {/* Notes */}
          {order.notes && (
            <div className="mt-4 text-left">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <p className="text-sm text-gray-600 mt-1">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

