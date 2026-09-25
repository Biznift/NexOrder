import React, { useState, useMemo, useEffect } from 'react';
import { Search, Check, X, Package, Plus, CheckSquare, Square } from 'lucide-react';
import { InventoryProduct } from '../types/order';

interface ProductSearchSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryList: InventoryProduct[];
  currentlySelectedNames: string[];
  onConfirmSelection: (selectedProducts: { name: string; defaultPrice: number }[]) => void;
}

export const ProductSearchSelectModal: React.FC<ProductSearchSelectModalProps> = ({
  isOpen,
  onClose,
  inventoryList,
  currentlySelectedNames,
  onConfirmSelection,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Initialize selected items based on what's already in the order
  useEffect(() => {
    if (!isOpen) return;
    const initialSet = new Set<string>();
    const lowerSelected = currentlySelectedNames.map((n) => n.trim().toLowerCase()).filter(Boolean);

    inventoryList.forEach((prod) => {
      if (lowerSelected.includes(prod.name.trim().toLowerCase())) {
        initialSet.add(prod.id);
      }
    });

    setSelectedIds(initialSet);
    setSearchQuery('');
  }, [isOpen, currentlySelectedNames, inventoryList]);

  // Fast, case-insensitive multi-word, Bengali, and English search
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return inventoryList;

    const words = query.split(/\s+/).filter(Boolean);

    return inventoryList.filter((prod) => {
      const prodName = prod.name.toLowerCase();
      // 1. Starts with first letter / prefix
      if (prodName.startsWith(query)) return true;
      // 2. Includes full search phrase
      if (prodName.includes(query)) return true;
      // 3. Matches every word (Bengali or English tokens)
      return words.every((w) => prodName.includes(w));
    });
  }, [inventoryList, searchQuery]);

  if (!isOpen) return null;

  const toggleProduct = (prodId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodId)) {
        next.delete(prodId);
      } else {
        next.add(prodId);
      }
      return next;
    });
  };

  const handleDone = () => {
    const selected = inventoryList
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({
        name: p.name,
        defaultPrice: p.defaultPrice || 0,
      }));

    onConfirmSelection(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">Select Products (প্রোডাক্ট সিলেক্ট করুন)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by first letter, English or Bengali name (e.g. Baby, কাঁথা, B)..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 px-1">
            Search works by first letter, partial name, English or Bengali words. Check multiple products then click OK / DONE.
          </p>
        </div>

        {/* Product List with Checkboxes */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-700">No matching products found</p>
              <p className="text-xs text-slate-400 mt-1">
                "{searchQuery}" দিয়ে কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি।
              </p>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isChecked = selectedIds.has(prod.id);

              return (
                <div
                  key={prod.id}
                  onClick={() => toggleProduct(prod.id)}
                  className={`pt-2 first:pt-0 flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-emerald-50/70 border border-emerald-300/80'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                    <button
                      type="button"
                      className="shrink-0 text-emerald-600 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProduct(prod.id);
                      }}
                    >
                      {isChecked ? (
                        <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-md border-2 border-slate-300 hover:border-emerald-500 bg-white" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isChecked ? 'text-emerald-950 font-bold' : 'text-slate-800'}`}>
                        {prod.name}
                      </p>
                      <div className="flex items-center space-x-3 text-xs mt-0.5">
                        <span className="text-slate-600 font-medium">
                          Price: <strong className="text-emerald-700 font-bold">৳{prod.defaultPrice || 0}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {isChecked && (
                    <span className="shrink-0 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Selected ✓
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer with OK / DONE button */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600 font-medium">
            <span className="font-bold text-emerald-700 text-sm">{selectedIds.size}</span> products selected
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>OK / DONE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
