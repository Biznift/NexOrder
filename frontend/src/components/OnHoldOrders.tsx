import React, { useState } from 'react';
import { Clock, Send, Trash2, X, AlertTriangle, ArrowLeft, Loader2, Phone, Tag, Calendar } from 'lucide-react';
import { Order, OrderDateFilter } from '../types/order';
import { deleteOrder, sendToSteadfast } from '../api';

interface OnHoldOrdersProps {
  orders: Order[];
  onRefresh: () => void;
  onOrderSentToSteadfast: (order: Order) => void;
  onBack: () => void;
  onOpenSteadfastConfig: () => void;
  currentFilter?: OrderDateFilter;
}

export const OnHoldOrders: React.FC<OnHoldOrdersProps> = ({
  orders,
  onRefresh,
  onOrderSentToSteadfast,
  onBack,
  onOpenSteadfastConfig,
  currentFilter,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSendingSteadfast, setIsSendingSteadfast] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!selectedOrder) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteOrder(selectedOrder.id);
      setShowDeleteConfirm(false);
      setSelectedOrder(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete order.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendSteadfast = async () => {
    if (!selectedOrder) return;
    setIsSendingSteadfast(true);
    setActionError(null);

    try {
      const res = await sendToSteadfast(selectedOrder.orderId);
      if (!res.success || !res.order) {
        // Keeps order on hold, shows real error
        setActionError(res.error || 'Failed to send to Steadfast');
        return;
      }

      // Succeeded: parcel details opened via callback
      setSelectedOrder(null);
      onOrderSentToSteadfast(res.order);
    } catch (err: any) {
      setActionError(err.message || 'Failed to communicate with Steadfast API');
    } finally {
      setIsSendingSteadfast(false);
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
          <Clock className="w-5 h-5 text-amber-600" />
          <h2 className="text-xl font-bold text-slate-800">ON HOLD</h2>
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
        <div className="w-16" />
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-sm space-y-2">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-lg">No orders in ON HOLD</h3>
          <p className="text-sm text-slate-500">
            {currentFilter && currentFilter !== 'LIFETIME'
              ? `No ON HOLD orders found for ${currentFilter}. Try selecting another date filter option above.`
              : 'Create and confirm a new order to see it here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => {
                setSelectedOrder(order);
                setActionError(null);
                setShowDeleteConfirm(false);
              }}
              className="bg-white hover:bg-slate-50 active:bg-amber-50/40 p-4 rounded-2xl border border-slate-200 hover:border-amber-400 shadow-sm cursor-pointer transition-all space-y-2.5"
            >
              {/* Top row: Order ID & Confirm Date */}
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                  {order.orderId}
                </span>
                <span className="text-slate-500 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{order.confirmDate}</span>
                </span>
              </div>

              {/* Middle row: Customer Name & Phone */}
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-base text-slate-800 truncate mr-2">
                  {order.customerName || 'Customer'}
                </span>
                <span className="text-slate-600 font-mono text-xs flex items-center shrink-0">
                  <Phone className="w-3 h-3 text-slate-400 mr-1" />
                  {order.phone || 'No phone'}
                </span>
              </div>

              {/* Bottom row: Product, Quantity, Price */}
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <div className="text-slate-600 truncate mr-2">
                  <span className="font-medium text-slate-800">{order.product || 'Item'}</span>
                  <span className="text-slate-400 mx-1.5">•</span>
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

      {/* Selected Order Full Details Modal (with ONLY 2 MAIN BUTTONS: SEND STEADFAST, DELETE ORDER) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <div className="text-xs text-amber-400 uppercase font-bold tracking-wider">
                  ON HOLD Order Details
                </div>
                <h3 className="font-mono font-bold text-lg">{selectedOrder.orderId}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {actionError && (
              <div className="m-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-2">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="font-semibold">{actionError}</div>
                </div>
                {actionError.toLowerCase().includes('credential') && (
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      onOpenSteadfastConfig();
                    }}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs"
                  >
                    Configure Steadfast API Credentials
                  </button>
                )}
              </div>
            )}

            {/* Full Order Information */}
            <div className="p-4 sm:p-5 space-y-3 max-h-[60vh] overflow-y-auto text-sm">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase">Customer Information</div>
                <div className="font-bold text-base text-slate-900">{selectedOrder.customerName}</div>
                <div className="text-slate-600 font-mono text-sm">{selectedOrder.phone}</div>
                <div className="text-slate-700 text-xs mt-1 bg-white p-2.5 rounded-lg border border-slate-200">
                  {selectedOrder.address || 'No address provided'}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-slate-500 uppercase">Product & Pricing</div>
                {Array.isArray(selectedOrder.products) && selectedOrder.products.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedOrder.products.map((p, pIdx) => (
                      <div key={pIdx} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900">{p.productName}</div>
                          <div className="text-slate-500 text-[11px]">
                            Qty: <strong className="text-slate-700">{p.quantity} pcs</strong>
                            {p.color ? ` • Color: ${p.color}` : ''}
                          </div>
                        </div>
                        <div className="font-bold text-emerald-700">
                          ৳{p.price}
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-1 font-bold text-slate-900 text-sm">
                      <span>Total Amount ({selectedOrder.quantity} pcs):</span>
                      <span className="text-emerald-700 text-base">৳{selectedOrder.price}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{selectedOrder.product}</span>
                      <span className="text-emerald-700 text-base">৳{selectedOrder.price}</span>
                    </div>
                    <div className="flex space-x-4 text-xs text-slate-600">
                      <span>Quantity: {selectedOrder.quantity} pcs</span>
                      <span>Color: {selectedOrder.color || 'N/A'}</span>
                    </div>
                  </>
                )}
                {selectedOrder.note && (
                  <div className="text-xs text-slate-500 pt-1 border-t border-slate-200">
                    Note: <span className="italic">{selectedOrder.note}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="block text-slate-400">Confirm Date:</span>
                  <span className="font-semibold text-slate-800">{selectedOrder.confirmDate}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="block text-slate-400">Confirm Time:</span>
                  <span className="font-semibold text-slate-800">{selectedOrder.confirmTime}</span>
                </div>
              </div>

              {/* Delete confirmation dialog inside modal */}
              {showDeleteConfirm && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs space-y-3">
                  <div className="font-bold text-rose-900 text-sm flex items-center space-x-1.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>Confirm Permanent Deletion?</span>
                  </div>
                  <p className="text-rose-700">
                    This will permanently delete order <strong>{selectedOrder.orderId}</strong>. This action cannot be undone.
                  </p>
                  <div className="flex space-x-2 pt-1">
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-lg transition-all"
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ONLY TWO MAIN BUTTONS: SEND STEADFAST & DELETE ORDER */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2.5">
              <button
                type="button"
                onClick={handleSendSteadfast}
                disabled={isSendingSteadfast || showDeleteConfirm}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 text-white font-extrabold text-base rounded-xl shadow-md transition-all flex items-center justify-center space-x-2"
              >
                {isSendingSteadfast ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>SENDING TO STEADFAST API...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>SEND STEADFAST</span>
                  </>
                )}
              </button>

              {!showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSendingSteadfast}
                  className="w-full py-2.5 px-4 bg-white hover:bg-rose-50 active:bg-rose-100 border border-rose-300 text-rose-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>DELETE ORDER</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
