import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Phone, Calendar, ArrowRight } from 'lucide-react';
import { Order } from '../types/order';
import { searchOrders } from '../api';
import { SteadfastParcelDetailsModal } from './SteadfastParcelDetailsModal';

interface SearchOrdersProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (order: Order) => void;
}

export const SearchOrders: React.FC<SearchOrdersProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Order[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchOrders(q);
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pt-12 sm:pt-16 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center space-x-3 bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Order ID, Phone, Customer Name, Parcel ID..."
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 bg-slate-200/70 rounded-md"
          >
            ESC
          </button>
        </div>

        {/* Results Body */}
        <div className="p-3 sm:p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {isSearching ? (
            <div className="py-8 text-center text-slate-500 flex items-center justify-center space-x-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              <span>Searching orders...</span>
            </div>
          ) : query && results.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              No matching orders found in database for "{query}".
            </div>
          ) : results.length > 0 ? (
            results.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="p-3 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-all space-y-1.5"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {order.orderId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      order.status === 'SHIPPING'
                        ? 'bg-purple-100 text-purple-800'
                        : order.status === 'COURIER ASSIGN'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="flex justify-between items-baseline text-sm">
                  <span className="font-bold text-slate-800 truncate mr-2">{order.customerName}</span>
                  <span className="font-mono text-xs text-slate-600 flex items-center shrink-0">
                    <Phone className="w-3 h-3 text-slate-400 mr-1" />
                    {order.phone}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <span className="truncate">{order.product}</span>
                  <span className="font-bold text-emerald-700">৳{order.price}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-slate-400 text-xs space-y-1">
              <p>Type to search across all orders stored in the persistent database.</p>
              <p className="text-[11px] text-slate-400">Search by: Order ID, Phone number, Customer Name, or Steadfast Parcel ID.</p>
            </div>
          )}
        </div>
      </div>

      {selectedOrder && (
        <SteadfastParcelDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};
