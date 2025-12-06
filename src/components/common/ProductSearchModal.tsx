'use client';

import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Product {
  _id: string;
  nom: string;
  sku?: string;
  referenceClient?: string;
  prixAchatRef?: number;
  prixVenteHT?: number;
  tvaPct?: number;
  uomAchatCode?: string;
  uomVenteCode?: string;
  uomStockCode?: string;
  taxCode?: string;
}

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
  products: Product[];
  tenantId: string;
  title?: string;
}

export default function ProductSearchModal({
  isOpen,
  onClose,
  onSelect,
  products,
  tenantId,
  title = 'Rechercher un produit',
}: ProductSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products.slice(0, 50)); // Show first 50 products when search is empty
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = products
      .filter((product) => {
        const nom = (product.nom || '').toLowerCase();
        const sku = (product.sku || '').toLowerCase();
        const ref = (product.referenceClient || '').toLowerCase();
        return nom.includes(query) || sku.includes(query) || ref.includes(query);
      })
      .slice(0, 100); // Limit to 100 results for performance

    setFilteredProducts(filtered);
    setSelectedIndex(-1);
  }, [searchQuery, products]);

  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredProducts.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(filteredProducts[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSelect = (product: Product) => {
    onSelect(product);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher par nom, SKU ou référence..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto p-2"
          style={{ maxHeight: 'calc(90vh - 140px)' }}
        >
          {filteredProducts.length > 0 ? (
            <div className="space-y-1">
              {filteredProducts.map((product, index) => {
                const displayName = product.nom;
                const secondaryInfo = [
                  product.sku,
                  product.referenceClient,
                ]
                  .filter(Boolean)
                  .join(' - ');

                return (
                  <div
                    key={product._id}
                    onClick={() => handleSelect(product)}
                    className={`px-4 py-3 cursor-pointer rounded-lg transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm">
                      {displayName}
                    </div>
                    {secondaryInfo && (
                      <div className="text-xs text-gray-500 mt-1">
                        {secondaryInfo}
                      </div>
                    )}
                    {product.prixVenteHT !== undefined && product.prixVenteHT > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        Prix: {product.prixVenteHT.toFixed(3)} TND
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {searchQuery.trim()
                ? 'Aucun produit trouvé'
                : 'Commencez à taper pour rechercher...'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>
              {filteredProducts.length} produit
              {filteredProducts.length !== 1 ? 's' : ''} trouvé
              {searchQuery.trim() ? ` pour "${searchQuery}"` : ''}
            </span>
            <span>Utilisez ↑↓ pour naviguer, Entrée pour sélectionner</span>
          </div>
        </div>
      </div>
    </div>
  );
}

