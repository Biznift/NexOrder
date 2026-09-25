import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import { OrderDateFilter } from '../types/order';
import { DATE_FILTER_OPTIONS } from '../utils/dateFilter';

interface DateFilterBarProps {
  currentFilter: OrderDateFilter;
  onSelectFilter: (filter: OrderDateFilter) => void;
  totalFilteredCount?: number;
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  currentFilter,
  onSelectFilter,
  totalFilteredCount,
}) => {
  return (
    <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between mb-2 px-1 text-xs">
        <div className="flex items-center space-x-1.5 font-semibold text-slate-700">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>DATE FILTER</span>
        </div>
        {typeof totalFilteredCount === 'number' && (
          <span className="text-[11px] text-slate-500 font-medium">
            Active: <strong className="text-slate-800">{currentFilter}</strong> ({totalFilteredCount} {totalFilteredCount === 1 ? 'order' : 'orders'})
          </span>
        )}
      </div>

      {/* 6 Exact Filter Tabs */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {DATE_FILTER_OPTIONS.map((filter) => {
          const isActive = currentFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onSelectFilter(filter)}
              className={`py-2 px-2 text-xs font-bold rounded-xl transition-all text-center tracking-tight flex items-center justify-center select-none ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs scale-[1.02]'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 active:bg-slate-200 border border-slate-200/80'
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>
    </div>
  );
};
