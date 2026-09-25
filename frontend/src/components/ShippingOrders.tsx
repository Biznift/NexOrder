import React, { useState } from 'react';
import { Truck, ArrowLeft, Phone, Package, CheckCircle2, RefreshCw, Loader2, PackageCheck } from 'lucide-react';
import { Order, OrderDateFilter } from '../types/order';
import { SteadfastParcelDetailsModal } from './SteadfastParcelDetailsModal';
import { syncSteadfastParcelStatus, simulateWebhook } from '../api';

interface ShippingOrdersProps {
  orders: Order[];
  onRefresh: () => void;
  onBack: () => void;
  currentFilter?: OrderDateFilter;
}

export const ShippingOrders: React.FC<ShippingOrdersProps> = ({
  orders,
  onRefresh,
  onBack,
  currentFilter,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSync = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setBusyId(order.id);
    try {
      const result = await syncSteadfastParcelStatus(order.id);
      onRefresh();
      if (result.order?.status === 'DELIVERED') {
        setSelectedOrder(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync status');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkDelivered = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    const parcelId = order.steadfastParcelId || order.orderId;
    if (!parcelId) return;
    setBusyId(order.id);
    try {
      await simulateWebhook(parcelId, 'delivered');
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark delivered');
    } finally {
      setBusyId(null);
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
          <Truck className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-bold text-slate-800">SHIPPING</h2>
          <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
        <div className="w-16" />
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">No orders in SHIPPING</h3>
          <p className="text-sm text-slate-500">
            {currentFilter && currentFilter !== 'LIFETIME'
              ? `No SHIPPING orders found for ${currentFilter}. Try selecting another date filter option above.`
              : 'Orders will move to SHIPPING once Steadfast delivers the pickup/collected status webhook.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-white hover:bg-slate-50 active:bg-purple-50/40 p-4 rounded-2xl border border-slate-200 hover:border-purple-400 shadow-sm cursor-pointer transition-all space-y-2.5"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {order.orderId}
                </span>
                <div className="flex items-center space-x-1.5 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md font-mono font-bold">
                  <span className="text-[10px] text-purple-500 uppercase">Parcel:</span>
                  <span>{order.steadfastParcelId || 'N/A'}</span>
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

              <div className="pt-2 border-t border-slate-100 flex flex-wrap justify-between items-center text-xs gap-2">
                <div className="font-extrabold text-sm text-emerald-700">৳{order.price}</div>
                <div className="flex items-center space-x-1.5 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={(e) => handleSync(e, order)}
                    disabled={busyId === order.id}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    title="Sync live status from Steadfast"
                  >
                    {busyId === order.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Sync</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleMarkDelivered(e, order)}
                    disabled={busyId === order.id}
                    className="px-2 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    title="Mark as delivered"
                  >
                    <PackageCheck className="w-3 h-3" />
                    <span>Delivered</span>
                  </button>
                  <div className="flex items-center space-x-1 bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full font-semibold uppercase text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                    <span>{order.shippingStatus || 'PICKED UP'}</span>
                  </div>
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
