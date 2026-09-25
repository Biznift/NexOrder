import React from 'react';
import { PlusCircle, Clock, Truck, Send, PackageCheck, Users } from 'lucide-react';
import { OrderDateFilter } from '../types/order';

interface DashboardProps {
  counts: {
    onHold: number;
    courierAssign: number;
    shipping: number;
    delivered: number;
  };
  customerCount?: number;
  currentFilter?: OrderDateFilter;
  onNavigate: (
    section: 'new' | 'on_hold' | 'courier_assign' | 'shipping' | 'delivered' | 'customers'
  ) => void;
  onOpenInventory?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  counts,
  customerCount,
  currentFilter,
  onNavigate,
  onOpenInventory,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-4 sm:p-5 text-white shadow-md flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">Order Dashboard</h2>
          <p className="text-emerald-100 text-xs sm:text-sm mt-0.5">
            Select a section to manage customer orders
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {onOpenInventory && (
            <button
              onClick={onOpenInventory}
              type="button"
              className="bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-semibold px-2.5 py-1 rounded-xl transition-colors cursor-pointer border border-white/20"
            >
              Inventory
            </button>
          )}
          {currentFilter && (
            <div className="flex items-center space-x-1.5 bg-white/15 backdrop-blur-xs px-2.5 py-1 rounded-full text-xs font-semibold text-white border border-white/20 shrink-0">
              <span className="hidden sm:inline">Filter:</span>
              <span className="bg-white text-emerald-900 px-2 py-0.5 rounded-md font-bold text-[11px]">
                {currentFilter}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          onClick={() => onNavigate('new')}
          className="flex items-center justify-between p-5 bg-white hover:bg-emerald-50/50 active:bg-emerald-100/60 border-2 border-emerald-500 rounded-2xl shadow-sm transition-all text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl group-hover:scale-105 transition-transform">
              <PlusCircle className="w-7 h-7" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-800">NEW ORDER CREATE</div>
              <div className="text-xs text-slate-500">Paste customer message & AI extract</div>
            </div>
          </div>
          <div className="text-emerald-600 font-semibold text-sm bg-emerald-50 px-3 py-1 rounded-full">
            + Create
          </div>
        </button>

        <button
          onClick={() => onNavigate('customers')}
          className="flex items-center justify-between p-5 bg-white hover:bg-sky-50/50 active:bg-sky-100/60 border border-slate-200 hover:border-sky-400 rounded-2xl shadow-sm transition-all text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-sky-100 text-sky-700 rounded-xl group-hover:scale-105 transition-transform">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-800">CUSTOMERS</div>
              <div className="text-xs text-slate-500">Profiles, categories & CSV/Excel export</div>
            </div>
          </div>
          <div className="flex items-center justify-center min-w-[2.5rem] h-10 px-3 bg-sky-600 text-white font-bold text-lg rounded-xl shadow-xs">
            {customerCount ?? '—'}
          </div>
        </button>

        <button
          onClick={() => onNavigate('on_hold')}
          className="flex items-center justify-between p-5 bg-white hover:bg-amber-50/50 active:bg-amber-100/60 border border-slate-200 hover:border-amber-400 rounded-2xl shadow-sm transition-all text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-xl group-hover:scale-105 transition-transform">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-800">ON HOLD</div>
              <div className="text-xs text-slate-500">Confirmed orders waiting for Steadfast</div>
            </div>
          </div>
          <div className="flex items-center justify-center min-w-[2.5rem] h-10 px-3 bg-amber-500 text-white font-bold text-lg rounded-xl shadow-xs">
            {counts.onHold}
          </div>
        </button>

        <button
          onClick={() => onNavigate('courier_assign')}
          className="flex items-center justify-between p-5 bg-white hover:bg-blue-50/50 active:bg-blue-100/60 border border-slate-200 hover:border-blue-400 rounded-2xl shadow-sm transition-all text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl group-hover:scale-105 transition-transform">
              <Send className="w-7 h-7" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-800">COURIER ASSIGN</div>
              <div className="text-xs text-slate-500">Sent to Steadfast, awaiting pickup</div>
            </div>
          </div>
          <div className="flex items-center justify-center min-w-[2.5rem] h-10 px-3 bg-blue-600 text-white font-bold text-lg rounded-xl shadow-xs">
            {counts.courierAssign}
          </div>
        </button>

        <button
          onClick={() => onNavigate('shipping')}
          className="flex items-center justify-between p-5 bg-white hover:bg-purple-50/50 active:bg-purple-100/60 border border-slate-200 hover:border-purple-400 rounded-2xl shadow-sm transition-all text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl group-hover:scale-105 transition-transform">
              <Truck className="w-7 h-7" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-800">SHIPPING</div>
              <div className="text-xs text-slate-500">Picked up / collected by Steadfast</div>
            </div>
          </div>
          <div className="flex items-center justify-center min-w-[2.5rem] h-10 px-3 bg-purple-600 text-white font-bold text-lg rounded-xl shadow-xs">
            {counts.shipping}
          </div>
        </button>

        <button
          onClick={() => onNavigate('delivered')}
          className="flex items-center justify-between p-5 bg-white hover:bg-teal-50/50 active:bg-teal-100/60 border border-slate-200 hover:border-teal-400 rounded-2xl shadow-sm transition-all text-left group"
        >
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-teal-100 text-teal-700 rounded-xl group-hover:scale-105 transition-transform">
              <PackageCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="font-bold text-lg text-slate-800">DELIVERED</div>
              <div className="text-xs text-slate-500">
                After shipping — delivered, returned, or cancelled by courier
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center min-w-[2.5rem] h-10 px-3 bg-teal-600 text-white font-bold text-lg rounded-xl shadow-xs">
            {counts.delivered}
          </div>
        </button>
      </div>
    </div>
  );
};
