import React from 'react';
import { Package, Search, Settings, Home, Store, Lock, Users } from 'lucide-react';
import { SteadfastStatusInfo, BrandingConfig } from '../types/order';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenConfig: () => void;
  onOpenBranding?: () => void;
  onOpenInventory?: () => void;
  onOpenCustomers?: () => void;
  onToggleSearch: () => void;
  steadfastStatus: SteadfastStatusInfo | null;
  branding: BrandingConfig;
  trailing?: React.ReactNode;
  inventoryLocked?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenConfig,
  onOpenInventory,
  onOpenCustomers,
  onToggleSearch,
  steadfastStatus,
  branding,
  trailing,
  inventoryLocked = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          <button
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center space-x-2.5 text-left focus:outline-none min-w-0 group cursor-pointer"
          >
            <div className="shrink-0 relative">
              {branding.pageLogo ? (
                <img
                  src={branding.pageLogo}
                  alt={branding.pageName || 'Logo'}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-contain bg-white/10 p-0.5 border border-white/20 shadow-xs group-hover:border-emerald-400 transition-colors"
                />
              ) : (
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs border border-white/10 group-hover:border-emerald-400 transition-colors">
                  <Store className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight truncate text-white group-hover:text-emerald-300 transition-colors">
                {branding.pageName || 'Rifa Baby Shop'}
              </h1>
              <span className="text-[11px] sm:text-xs text-slate-400 block truncate">
                NexOrder
              </span>
            </div>
          </button>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {currentTab !== 'dashboard' && (
            <button
              onClick={() => onSelectTab('dashboard')}
              title="Home Dashboard"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {onOpenCustomers && (
            <button
              onClick={onOpenCustomers}
              title="Customers"
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                currentTab === 'customers'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}

          {onOpenInventory && (
            <button
              onClick={onOpenInventory}
              title={inventoryLocked ? 'Inventory (Pro)' : 'Product Inventory'}
              className={`p-2 rounded-xl transition-colors cursor-pointer relative ${
                currentTab === 'inventory'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200'
              }`}
            >
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              {inventoryLocked ? (
                <Lock className="absolute -top-0.5 -right-0.5 w-3 h-3 text-amber-300" />
              ) : null}
            </button>
          )}

          <button
            onClick={onToggleSearch}
            title="Search Orders"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            onClick={onOpenConfig}
            title="Settings (Logo, Name, Steadfast API, OpenRouter AI)"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 relative transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            <span
              className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                steadfastStatus?.isConfigured ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </button>

          {trailing}
        </div>
      </div>
    </header>
  );
};
