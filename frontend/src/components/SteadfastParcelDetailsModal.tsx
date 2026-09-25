import React from 'react';
import { X, CheckCircle, PackageCheck, Copy, Phone } from 'lucide-react';
import { Order } from '../types/order';

interface SteadfastParcelDetailsModalProps {
  order: Order | null;
  onClose: () => void;
  onSimulateWebhookPickup?: (parcelId: string) => void;
}

export const SteadfastParcelDetailsModal: React.FC<SteadfastParcelDetailsModalProps> = ({
  order,
  onClose,
  onSimulateWebhookPickup,
}) => {
  if (!order) return null;

  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (order.steadfastParcelId) {
      navigator.clipboard.writeText(order.steadfastParcelId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Top Prominent Steadfast Parcel ID Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center justify-center p-2 bg-white/20 rounded-full mb-2">
            <PackageCheck className="w-6 h-6" />
          </div>

          <div className="text-xs uppercase tracking-widest text-emerald-100 font-bold mb-1">
            STEADFAST PARCEL ID
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold tracking-wide font-mono flex items-center justify-center space-x-2">
            <span>{order.steadfastParcelId || 'N/A'}</span>
            {order.steadfastParcelId && (
              <button
                onClick={handleCopy}
                title="Copy Parcel ID"
                className="p-1 rounded bg-white/20 hover:bg-white/30 text-white text-xs"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          {copied && <span className="text-xs text-emerald-200 mt-1 block">Copied to clipboard!</span>}
        </div>

        {/* Order Details List */}
        <div className="p-4 sm:p-6 space-y-3.5 max-h-[65vh] overflow-y-auto text-sm">
          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 uppercase">Current Status</span>
            <span
              className={`font-bold px-3 py-1 rounded-full text-xs uppercase ${
                order.status === 'SHIPPING'
                  ? 'bg-purple-100 text-purple-800'
                  : order.status === 'COURIER ASSIGN'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {order.status}
              {order.shippingStatus ? ` (${order.shippingStatus})` : ''}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-semibold block uppercase">Order ID</span>
              <span className="font-bold text-slate-800 font-mono text-sm mt-0.5 block">{order.orderId}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-500 font-semibold block uppercase">Confirm Date</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {order.confirmDate} {order.confirmTime}
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-500 font-semibold block uppercase">Customer Details</span>
            <div className="font-bold text-slate-900 text-base mt-1">{order.customerName || 'N/A'}</div>
            <div className="text-slate-600 flex items-center space-x-1.5 mt-1 font-mono text-sm">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{order.phone || 'N/A'}</span>
            </div>
            <div className="text-slate-600 mt-1.5 text-xs leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
              {order.address || 'No address specified'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-2">
            <span className="text-xs text-slate-500 font-semibold block uppercase">Product Information</span>
            {Array.isArray(order.products) && order.products.length > 0 ? (
              <div className="space-y-1.5">
                {order.products.map((p, pIdx) => (
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
                  <span>Total COD ({order.quantity} pcs):</span>
                  <span className="text-emerald-700 text-base">৳{order.price}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <span className="font-bold text-slate-800 text-sm">{order.product || 'N/A'}</span>
                  <span className="font-extrabold text-emerald-700 text-base">৳{order.price}</span>
                </div>
                <div className="flex space-x-4 text-xs text-slate-600">
                  <span>
                    Quantity: <strong className="text-slate-800">{order.quantity} pcs</strong>
                  </span>
                  <span>
                    Color: <strong className="text-slate-800">{order.color || 'N/A'}</strong>
                  </span>
                </div>
              </>
            )}
            {order.note && (
              <div className="text-xs text-slate-500 pt-1 border-t border-slate-200">
                Note: <span className="italic">{order.note}</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold uppercase">Steadfast Submission Date</span>
              <span className="font-medium text-slate-700">
                {order.steadfastSubmissionDateTime
                  ? new Date(order.steadfastSubmissionDateTime).toLocaleString()
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Webhook transition simulator (Optional testing helper) */}
          {order.status === 'COURIER ASSIGN' && onSimulateWebhookPickup && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-2">
              <div className="font-bold text-blue-900 flex items-center space-x-1.5">
                <CheckCircle className="w-4 h-4 text-blue-700" />
                <span>Steadfast Webhook Pickup Trigger</span>
              </div>
              <p className="text-blue-700">
                In production, Steadfast calls the webhook when parcel is collected. You can test this webhook transition to SHIPPING right now:
              </p>
              <button
                onClick={() => onSimulateWebhookPickup(order.steadfastParcelId || order.orderId)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg text-xs"
              >
                Simulate Steadfast Pickup Webhook
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
