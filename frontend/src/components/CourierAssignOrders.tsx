import React, { useState } from 'react';
import { Send, ArrowLeft, Phone, MapPin, Package, Tag, Clock } from 'lucide-react';
import { Order, OrderDateFilter } from '../types/order';
import { SteadfastParcelDetailsModal } from './SteadfastParcelDetailsModal';
import { simulateWebhook } from '../api';

interface CourierAssignOrdersProps {
  orders: Order[];
  onRefresh: () => void;
  onBack: () => void;
  currentFilter?: OrderDateFilter;
}

export const CourierAssignOrders: React.FC<CourierAssignOrdersProps> = ({
  orders,
  onRefresh,
  onBack,
  currentFilter,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulatePickup = async (parcelId: string) => {
    setIsSimulating(true);
    try {
      await simulateWebhook(parcelId, 'picked_up');
      onRefresh();
      setSelectedOrder(null);
    } catch (err) {
      console.error('Error simulating webhook:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Dashboard
        </button>
        <div className="flex items-center space-x-2">
          <Send className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-800">COURIER ASSIGN</h2>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
        <div className="w-16" />
      </div>

      {/* Info Notice about Courier Assign Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-800 flex items-start space-x-2.5">
        <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Awaiting Courier Pickup:</span> These orders have been submitted to Steadfast and are awaiting physical collection. Once Steadfast sends the pickup/collected webhook, they will automatically move to <strong>SHIPPING</strong>.
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">No orders in COURIER ASSIGN</h3>
          <p className="text-sm text-slate-500">
            {currentFilter && currentFilter !== 'LIFETIME'
              ? `No COURIER ASSIGN orders found for ${currentFilter}. Try selecting another date filter option above.`
              : 'Submit orders to Steadfast from ON HOLD to see them here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-white hover:bg-slate-50 active:bg-blue-50/40 p-4 rounded-2xl border border-slate-200 hover:border-blue-400 shadow-sm cursor-pointer transition-all space-y-2.5"
            >
              {/* Order ID & Steadfast Parcel ID */}
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {order.orderId}
                </span>
                <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-mono font-bold">
                  <span className="text-[10px] text-blue-500 uppercase">Parcel:</span>
                  <span>{order.steadfastParcelId || 'Pending'}</span>
                </div>
              </div>

              {/* Customer Name & Phone */}
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-base text-slate-900 truncate mr-2">
                  {order.customerName}
                </span>
                <span className="text-slate-600 font-mono text-xs flex items-center shrink-0">
                  <Phone className="w-3 h-3 text-slate-400 mr-1" />
                  {order.phone}
                </span>
              </div>

              {/* Address */}
              <div className="text-xs text-slate-600 flex items-start space-x-1.5 bg-slate-50 p-2 rounded-lg">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="truncate">{order.address || 'No address specified'}</span>
              </div>

              {/* Product, Quantity, Price */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <div className="text-slate-600 truncate mr-2 flex items-center space-x-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-800">{order.product}</span>
                  <span className="text-slate-300">|</span>
                  <span>{order.quantity} pcs</span>
                </div>
                <div className="font-extrabold text-sm text-emerald-700 shrink-0">
                  ৳{order.price}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Order Full Details Modal */}
      {selectedOrder && (
        <SteadfastParcelDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSimulateWebhookPickup={(id) => handleSimulatePickup(id)}
        />
      )}
    </div>
  );
};
