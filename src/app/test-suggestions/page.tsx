'use client';

import { useState } from 'react';
import ExpenseCategoryModal from '@/components/ExpenseCategoryModal';

export default function TestSuggestionsPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🧪 Test des suggestions de catégories
          </h1>
          
          <div className="space-y-4">
            <p className="text-gray-600">
              Cliquez sur le bouton ci-dessous pour tester le système de suggestions de catégories.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="font-medium text-blue-900 mb-2">Instructions de test :</h3>
              <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                <li>Cliquez sur "Ouvrir la modale"</li>
                <li>Cliquez sur "Voir les suggestions"</li>
                <li>Sélectionnez une catégorie de la liste</li>
                <li>Vérifiez que tous les champs se remplissent automatiquement</li>
                <li>Testez la recherche en tapant dans le champ "Nom"</li>
              </ol>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors"
            >
              Ouvrir la modale de test
            </button>
          </div>
        </div>
      </div>

      <ExpenseCategoryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          console.log('Catégorie créée avec succès !');
          setShowModal(false);
        }}
        tenantId="test-tenant"
      />
    </div>
  );
}











