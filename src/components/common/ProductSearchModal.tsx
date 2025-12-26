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
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-5 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-800">
          <div className="relative group">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher par nom, SKU ou référence..."
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto p-4 space-y-2"
          style={{ maxHeight: 'calc(90vh - 180px)' }}
        >
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
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
                    className={`group px-5 py-4 cursor-pointer rounded-xl transition-all border-2 ${index === selectedIndex
                      ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-lg'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {displayName}
                        </div>
                        {secondaryInfo && (
                          <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-tighter">
                            {secondaryInfo}
                          </div>
                        )}
                      </div>
                      {product.prixVenteHT !== undefined && product.prixVenteHT > 0 && (
                        <div className="text-sm font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                          {product.prixVenteHT.toFixed(3)} TND
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <MagnifyingGlassIcon className="h-12 w-12 mb-4 opacity-20" />
              {searchQuery.trim()
                ? 'Aucun produit trouvé'
                : 'Commencez à taper pour rechercher...'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>
              {filteredProducts.length} produit
              {filteredProducts.length !== 1 ? 's' : ''} trouvé
              {searchQuery.trim() ? ` pour "${searchQuery}"` : ''}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px]">↑↓</span>
            <span>Navigation</span>
            <span className="flex items-center gap-1 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px]">↵</span>
            <span>Sélection</span>
          </div>
        </div>
      </div>
    </div>
  );
}

