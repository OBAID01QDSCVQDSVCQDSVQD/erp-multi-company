'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Document {
  _id: string;
  number: string;
  type: 'quote' | 'delivery' | 'invoice' | 'credit_note' | 'expense_note';
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  customerId: {
    name: string;
  };
  date: string;
  total: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchDocuments();
  }, [filter]);

  const fetchDocuments = async () => {
    try {
      const url = filter === 'all' ? '/api/documents' : `/api/documents?type=${filter}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      } else {
        setError('Erreur lors du chargement des documents');
      }
    } catch (err) {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quote':
        return 'bg-blue-100 text-blue-800';
      case 'delivery':
        return 'bg-yellow-100 text-yellow-800';
      case 'invoice':
        return 'bg-green-100 text-green-800';
      case 'credit_note':
        return 'bg-red-100 text-red-800';
      case 'expense_note':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'quote':
        return 'Devis';
      case 'delivery':
        return 'Bon de livraison';
      case 'invoice':
        return 'Facture';
      case 'credit_note':
        return 'Avoir';
      case 'expense_note':
        return 'Note d\'honoraires';
      default:
        return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-yellow-100 text-yellow-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'sent':
        return 'Envoyé';
      case 'paid':
        return 'Payé';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'unpaid':
        return 'Impayé';
      case 'partial':
        return 'Partiellement payé';
      case 'paid':
        return 'Payé';
      default:
        return status;
    }
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérez vos devis, factures et autres documents
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nouveau document
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">Tous les documents</option>
            <option value="quote">Devis</option>
            <option value="delivery">Bons de livraison</option>
            <option value="invoice">Factures</option>
            <option value="credit_note">Avoirs</option>
            <option value="expense_note">Notes d'honoraires</option>
          </select>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Documents list */}
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun document</h3>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer votre premier document.
            </p>
            <div className="mt-6">
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Nouveau document
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {documents.map((document) => (
                <li key={document._id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <DocumentTextIcon className="h-10 w-10 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">
                            {document.number}
                          </p>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(document.type)}`}>
                            {getTypeLabel(document.type)}
                          </span>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                            {getStatusLabel(document.status)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-gray-500">
                            Client: {document.customerId.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            Date: {new Date(document.date).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-sm text-gray-500">
                            Montant: {formatPrice(document.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(document.paymentStatus)}`}>
                        {getPaymentStatusLabel(document.paymentStatus)}
                      </span>
                      <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                        Voir
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
