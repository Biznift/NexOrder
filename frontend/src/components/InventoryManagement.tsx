import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Search,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { InventoryProduct } from '../types/order';
import {
  fetchInventory,
  createInventoryProduct,
  updateInventoryProduct,
  deleteInventoryProduct,
} from '../api';

interface InventoryManagementProps {
  onBack: () => void;
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({ onBack }) => {
  const [items, setItems] = useState<InventoryProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal / Form state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryProduct | null>(null);

  // Add / Edit form fields
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchInventory();
      setItems(data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setFormName('');
    setFormPrice('');
    setFormError(null);
    setEditingItem(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: InventoryProduct) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormPrice(item.defaultPrice !== undefined ? String(item.defaultPrice) : '');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Product Name is required.');
      return;
    }

    const priceNum = formPrice.trim() !== '' ? Math.max(0, parseInt(formPrice, 10) || 0) : undefined;

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingItem) {
        await updateInventoryProduct(editingItem.id, {
          name: formName.trim(),
          defaultPrice: priceNum,
        });
      } else {
        await createInventoryProduct({
          name: formName.trim(),
          defaultPrice: priceNum,
        });
      }

      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInventoryProduct(id);
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </button>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800">PRODUCT INVENTORY</h2>
        <button
          onClick={openAddModal}
          type="button"
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ADD PRODUCT</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="প্রোডাক্ট খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>
        <div className="flex items-center space-x-3 text-xs font-semibold text-slate-600 w-full sm:w-auto justify-end">
          <span className="px-3 py-1 bg-slate-100 rounded-lg">
            Total Products: <strong className="text-slate-900">{items.length}</strong>
          </span>
        </div>
      </div>

      {/* Products List */}
      {isLoading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2 border border-slate-200">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
          <span>Loading inventory...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <p className="text-slate-600 font-medium">কোনো প্রোডাক্ট পাওয়া যায়নি।</p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            নতুন প্রোডাক্ট যোগ করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredItems.map((prod) => (
            <div
              key={prod.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-base leading-snug">
                    {prod.name}
                  </h4>
                  <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                    {prod.defaultPrice !== undefined && (
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        Price: ৳{prod.defaultPrice}
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit & Delete Action buttons */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => openEditModal(prod)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit Product"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(prod.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Delete confirmation modal / prompt */}
              {deleteConfirmId === prod.id && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-2">
                  <p className="font-semibold text-rose-800">
                    "{prod.name}" প্রোডাক্টটি ডিলিট করতে চান?
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDelete(prod.id)}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-800">
                {editingItem ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Product Name <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. বেবি নকশি কাঁথা / Baby Shoes"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Optional Default Price (BDT)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">৳</span>
                  <input
                    type="number"
                    min={0}
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {formError && (
                <div className="flex items-center space-x-2 text-rose-600 bg-rose-50 p-3 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingItem ? 'Update Product' : 'Save Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
