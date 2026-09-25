import React, { useState } from 'react';
import { PackageCheck, ArrowLeft, Phone, Package, RefreshCw, Loader2 } from 'lucide-react';
import { Order, OrderDateFilter } from '../types/order';
import { SteadfastParcelDetailsModal } from './SteadfastParcelDetailsModal';
import { syncSteadfastParcelStatus } from '../api';

interface DeliveredOrdersProps {
  orders: Order[];
  onRefresh: () => void;
  onBack: () => void;
  currentFilter?: OrderDateFilter;
}

export const DeliveredOrders: React.FC<DeliveredOrdersProps> = ({
  orders,
  onRefresh,
  onBack,
  currentFilter,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSyncStatus = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    if (!order.steadfastParcelId && !order.orderId) return;
    setSyncingId(order.id);
    try {
      await syncSteadfastParcelStatus(order.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to sync parcel status:', err);
      alert(err instanceof Error ? err.message : 'Failed to sync status from Steadfast');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Dashboard
        </button>
        <div className="flex items-center space-x-2">
          <PackageCheck className="w-5 h-5 text-teal-600" />
          <h2 className="text-xl font-bold text-slate-800">DELIVERED</h2>
          <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
        <div className="w-16" />
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">No delivered orders yet</h3>
          <p className="text-sm text-slate-500">
            {currentFilter && currentFilter !== 'LIFETIME'
              ? `No DELIVERED orders found for ${currentFilter}. Try another date filter.`
              : 'Orders move here after Steadfast reports delivered / returned / cancelled via webhook, or when you sync parcel status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-white hover:bg-slate-50 active:bg-teal-50/40 p-4 rounded-2xl border border-slate-200 hover:border-teal-400 shadow-sm cursor-pointer transition-all space-y-2.5"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {order.orderId}
                </span>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleSyncStatus(e, order)}
                    disabled={syncingId === order.id}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 cursor-pointer disabled:opacity-50"
                    title="Sync status from Steadfast"
                  >
                    {syncingId === order.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <div className="flex items-center space-x-1.5 bg-teal-50 text-teal-700 px-2.5 py-1 rounded-md font-mono font-bold">
                    <span className="text-[10px] text-teal-500 uppercase">Parcel:</span>
                    <span>{order.steadfastParcelId || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-baseline">
                <span className="font-bold text-base text-slate-900 truncate mr-2">
                  {order.customerName}
                </span>
                <span className="text-slate-600 font-mono text-xs flex items-center shrink-0">
                  <Phone className="w-3 h-3 text-slate-400 mr-1" />
                  {order.phone}
                </span>
              </div>

              <div className="text-xs text-slate-600 flex items-center space-x-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800">{order.product}</span>
                <span className="text-slate-300">|</span>
                <span>{order.quantity} pcs</span>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <div className="font-extrabold text-sm text-emerald-700">৳{order.price}</div>
                <div className="flex items-center space-x-1 bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full font-semibold uppercase text-[11px]">
                  <PackageCheck className="w-3 h-3 text-teal-600" />
                  <span>{order.shippingStatus || 'DELIVERED'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <SteadfastParcelDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};
