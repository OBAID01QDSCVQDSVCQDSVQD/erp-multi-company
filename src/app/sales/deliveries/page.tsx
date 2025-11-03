'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, TruckIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useTenantId } from '@/hooks/useTenantId';

interface Delivery {
  _id: string;
  numero: string;
  dateDoc: string;
  customerId?: string;
  statut: string;
  totalTTC: number;
  devise?: string;
  dateLivraisonReelle?: string;
}

export default function DeliveriesPage() {
  const { tenantId } = useTenantId();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (tenantId) fetchDeliveries();
  }, [tenantId]);

  const fetchDeliveries = async () => {
    try {
      if (!tenantId) return;
      // Note: Endpoint not yet created, using placeholder
      const response = await fetch('/api/sales/deliveries', {
        headers: { 'X-Tenant-Id': tenantId }
      });
      if (response.ok) {
        const data = await response.json();
        setDeliveries(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = deliveries.filter(delivery =>
    delivery.numero.toLowerCase().includes(q.toLowerCase()) ||
    delivery.statut.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TruckIcon className="w-8 h-8" /> Bons de livraison
          </h1>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <PlusIcon className="w-5 h-5" /> Nouveau BL
          </button>
        </div>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par numéro..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Aucun bon de livraison trouvé</div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Numéro</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Client</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total TTC</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((delivery) => (
                  <tr key={delivery._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{delivery.numero}</td>
                    <td className="px-4 py-3 text-sm">{new Date(delivery.dateDoc).toLocaleDateString('fr')}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">-</td>
                    <td>
                      <span className={`px-2 py-1 text-xs rounded ${
                        delivery.statut === 'livre' ? 'bg-green-100 text-green-700' :
                        delivery.statut === 'facture' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {delivery.statut.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {delivery.totalTTC?.toFixed(2)} {delivery.devise || 'TND'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-green-600 hover:bg-green-50 rounded">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
