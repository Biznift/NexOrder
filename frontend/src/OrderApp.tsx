import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { NewOrderCreate } from './components/NewOrderCreate';
import { OnHoldOrders } from './components/OnHoldOrders';
import { CourierAssignOrders } from './components/CourierAssignOrders';
import { ShippingOrders } from './components/ShippingOrders';
import { DeliveredOrders } from './components/DeliveredOrders';
import { SearchOrders } from './components/SearchOrders';
import { SettingsModal } from './components/SettingsModal';
import { SteadfastParcelDetailsModal } from './components/SteadfastParcelDetailsModal';
import { InventoryManagement } from './components/InventoryManagement';
import { CustomersPage } from './components/CustomersPage';
import { DateFilterBar } from './components/DateFilterBar';
import { fetchOrders, getSteadfastConfig, simulateWebhook, fetchBranding, fetchCustomers } from './api';
import { Order, SteadfastStatusInfo, OrderDateFilter, BrandingConfig } from './types/order';
import { filterOrdersByDate } from './utils/dateFilter';
import { PlusCircle, Clock, Send, Truck, LayoutGrid, PackageCheck } from 'lucide-react';
import { useAuth } from '@/saas/AuthContext';
import { AppUserMenu, FeatureLocked, PlanBanner } from '@/saas/components/AppChrome';

export default function OrderApp() {
  const { can, orderLimitReached, hasPermission, user, isTeamMember } = useAuth();
  const canInventory = can('inventory') && hasPermission('inventory');
  const canCustomers = hasPermission('customers');
  const canCouriers = can('courierIntegrations') && hasPermission('settings');
  const canSearch = hasPermission('search');
  const canSettings = hasPermission('settings');
  // Backup tab: account owners only (not Super Admin, not team members)
  const canUseUserBackup =
    !!user &&
    !isTeamMember &&
    user.role !== 'super_admin' &&
    (user.role === 'free' || user.role === 'pro' || user.role === 'admin');
  const [currentSection, setCurrentSection] = useState<
    | 'dashboard'
    | 'new'
    | 'on_hold'
    | 'courier_assign'
    | 'shipping'
    | 'delivered'
    | 'inventory'
    | 'customers'
  >('dashboard');

  const goSection = (sec: typeof currentSection) => {
    const map: Record<typeof currentSection, Parameters<typeof hasPermission>[0]> = {
      dashboard: 'dashboard',
      new: 'createOrders',
      on_hold: 'onHold',
      courier_assign: 'courierAssign',
      shipping: 'shipping',
      delivered: 'delivered',
      inventory: 'inventory',
      customers: 'customers',
    };
    if (!hasPermission(map[sec])) return;
    setCurrentSection(sec);
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configInitialTab, setConfigInitialTab] = useState<'branding' | 'steadfast' | 'openrouter'>('branding');
  const [steadfastStatus, setSteadfastStatus] = useState<SteadfastStatusInfo | null>(null);

  const [branding, setBranding] = useState<BrandingConfig>({
    pageName: 'Rifa Baby Shop',
    pageLogo: '',
  });

  const [dateFilter, setDateFilter] = useState<OrderDateFilter>('LIFETIME');
  const [submittedParcelOrder, setSubmittedParcelOrder] = useState<Order | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersData, configData, brandingData, customersData] = await Promise.all([
        fetchOrders(),
        getSteadfastConfig().catch(() => ({ isConfigured: false, apiKeyMasked: null })),
        fetchBranding().catch(() => ({ pageName: 'Rifa Baby Shop', pageLogo: '' })),
        fetchCustomers().catch(() => ({ customers: [], total: 0, categories: [] })),
      ]);
      setOrders(ordersData);
      setCustomerCount(customersData.total ?? customersData.customers?.length ?? 0);
      setSteadfastStatus(configData);
      if (brandingData) {
        setBranding((prev) =>
          prev.pageName === brandingData.pageName && prev.pageLogo === brandingData.pageLogo
            ? prev
            : brandingData
        );
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (branding.pageName) {
      document.title = `${branding.pageName} - NexOrder`;
    }
  }, [branding.pageName]);

  const filteredOrders = useMemo(() => {
    return filterOrdersByDate(orders, dateFilter);
  }, [orders, dateFilter]);

  const onHoldOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'ON HOLD');
  }, [filteredOrders]);

  const courierAssignOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'COURIER ASSIGN');
  }, [filteredOrders]);

  const shippingOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'SHIPPING');
  }, [filteredOrders]);

  const deliveredOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'DELIVERED');
  }, [filteredOrders]);

  const activeCounts = useMemo(() => {
    return {
      onHold: onHoldOrders.length,
      courierAssign: courierAssignOrders.length,
      shipping: shippingOrders.length,
      delivered: deliveredOrders.length,
    };
  }, [
    onHoldOrders.length,
    courierAssignOrders.length,
    shippingOrders.length,
    deliveredOrders.length,
  ]);

  const handleOrderConfirmed = () => {
    loadData();
    goSection('on_hold');
  };

  const handleOrderSentToSteadfast = (order: Order) => {
    loadData();
    setSubmittedParcelOrder(order);
  };

  const handleOpenSettings = (tab: 'branding' | 'steadfast' | 'openrouter' = 'branding') => {
    setConfigInitialTab(tab);
    setIsConfigOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans pb-20 sm:pb-8">
      <PlanBanner />
      <Header
        currentTab={currentSection}
        onSelectTab={(tab) => goSection(tab as typeof currentSection)}
        onOpenConfig={() => {
          if (!canSettings) return;
          handleOpenSettings('branding');
        }}
        onOpenBranding={() => {
          if (!canSettings) return;
          handleOpenSettings('branding');
        }}
        onOpenInventory={() => goSection('inventory')}
        onOpenCustomers={canCustomers ? () => goSection('customers') : undefined}
        onToggleSearch={() => {
          if (!canSearch) return;
          setIsSearchOpen(true);
        }}
        steadfastStatus={steadfastStatus}
        branding={branding}
        trailing={<AppUserMenu />}
        inventoryLocked={!canInventory}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-3.5 sm:px-4 py-4 sm:py-6 space-y-4">
        {currentSection !== 'new' &&
          currentSection !== 'inventory' &&
          currentSection !== 'customers' &&
          hasPermission('dashboard') && (
          <DateFilterBar
            currentFilter={dateFilter}
            onSelectFilter={(f) => setDateFilter(f)}
            totalFilteredCount={filteredOrders.length}
          />
        )}

        {currentSection === 'dashboard' &&
          (hasPermission('dashboard') ? (
            <Dashboard
              counts={activeCounts}
              customerCount={customerCount}
              currentFilter={dateFilter}
              onNavigate={(sec) => goSection(sec as typeof currentSection)}
              onOpenInventory={() => goSection('inventory')}
            />
          ) : (
            <FeatureLocked
              tone="permission"
              title="Dashboard locked"
              description="Your team role does not include dashboard access. Ask the account owner to update your permissions."
            />
          ))}

        {currentSection === 'new' &&
          (!hasPermission('createOrders') ? (
            <FeatureLocked
              tone="permission"
              title="Create orders locked"
              description="You do not have permission to create orders."
            />
          ) : orderLimitReached ? (
            <FeatureLocked
              title="Monthly order limit reached"
              description="Your Free plan cap is used up for this month. Upgrade to Pro for unlimited orders."
            />
          ) : (
            <NewOrderCreate
              onOrderConfirmed={handleOrderConfirmed}
              onBack={() => goSection('dashboard')}
            />
          ))}

        {currentSection === 'on_hold' &&
          (hasPermission('onHold') ? (
            <OnHoldOrders
              orders={onHoldOrders}
              currentFilter={dateFilter}
              onRefresh={loadData}
              onOrderSentToSteadfast={handleOrderSentToSteadfast}
              onBack={() => goSection('dashboard')}
              onOpenSteadfastConfig={() =>
                canCouriers ? handleOpenSettings('steadfast') : goSection('dashboard')
              }
            />
          ) : (
            <FeatureLocked
              tone="permission"
              title="On Hold locked"
              description="You do not have permission to manage on-hold orders."
            />
          ))}

        {currentSection === 'courier_assign' &&
          (hasPermission('courierAssign') ? (
            <CourierAssignOrders
              orders={courierAssignOrders}
              currentFilter={dateFilter}
              onRefresh={loadData}
              onBack={() => goSection('dashboard')}
            />
          ) : (
            <FeatureLocked
              tone="permission"
              title="Courier assign locked"
              description="You do not have permission to manage courier assignment."
            />
          ))}

        {currentSection === 'shipping' &&
          (hasPermission('shipping') ? (
            <ShippingOrders
              orders={shippingOrders}
              currentFilter={dateFilter}
              onRefresh={loadData}
              onBack={() => goSection('dashboard')}
            />
          ) : (
            <FeatureLocked
              tone="permission"
              title="Shipping locked"
              description="You do not have permission to view shipping orders."
            />
          ))}

        {currentSection === 'delivered' &&
          (hasPermission('delivered') ? (
            <DeliveredOrders
              orders={deliveredOrders}
              currentFilter={dateFilter}
              onRefresh={loadData}
              onBack={() => goSection('dashboard')}
            />
          ) : (
            <FeatureLocked
              tone="permission"
              title="Delivered locked"
              description="You do not have permission to view delivered orders."
            />
          ))}

        {currentSection === 'inventory' &&
          (!hasPermission('inventory') ? (
            <FeatureLocked
              tone="permission"
              title="Inventory locked"
              description="Your team role does not include inventory access."
            />
          ) : canInventory ? (
            <InventoryManagement onBack={() => goSection('dashboard')} />
          ) : (
            <FeatureLocked
              title="Inventory is a Pro feature"
              description="Upgrade to Pro to manage products, stock levels, and catalog search across orders."
            />
          ))}

        {currentSection === 'customers' &&
          (canCustomers ? (
            <CustomersPage
              onBack={() => goSection('dashboard')}
              canEditCategories={canSettings || !isTeamMember}
            />
          ) : (
            <FeatureLocked
              tone="permission"
              title="Customers locked"
              description="Your team role does not include customer access."
            />
          ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg sm:hidden">
        <div className="grid grid-cols-6 h-16">
          <button
            onClick={() => goSection('dashboard')}
            className={`flex flex-col items-center justify-center text-[9px] font-semibold transition-colors ${
              currentSection === 'dashboard'
                ? 'text-emerald-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => goSection('new')}
            className={`flex flex-col items-center justify-center text-[9px] font-semibold transition-colors ${
              currentSection === 'new'
                ? 'text-emerald-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PlusCircle className="w-5 h-5 mb-0.5" />
            <span>New</span>
          </button>

          <button
            onClick={() => goSection('on_hold')}
            className={`flex flex-col items-center justify-center text-[9px] font-semibold relative transition-colors ${
              currentSection === 'on_hold'
                ? 'text-amber-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span>Hold</span>
            {activeCounts.onHold > 0 && (
              <span className="absolute top-1.5 right-1 min-w-[1.1rem] h-4 px-1 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeCounts.onHold}
              </span>
            )}
          </button>

          <button
            onClick={() => goSection('courier_assign')}
            className={`flex flex-col items-center justify-center text-[9px] font-semibold relative transition-colors ${
              currentSection === 'courier_assign'
                ? 'text-blue-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-5 h-5 mb-0.5" />
            <span>Courier</span>
            {activeCounts.courierAssign > 0 && (
              <span className="absolute top-1.5 right-1 min-w-[1.1rem] h-4 px-1 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeCounts.courierAssign}
              </span>
            )}
          </button>

          <button
            onClick={() => goSection('shipping')}
            className={`flex flex-col items-center justify-center text-[9px] font-semibold relative transition-colors ${
              currentSection === 'shipping'
                ? 'text-purple-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-5 h-5 mb-0.5" />
            <span>Ship</span>
            {activeCounts.shipping > 0 && (
              <span className="absolute top-1.5 right-1 min-w-[1.1rem] h-4 px-1 bg-purple-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeCounts.shipping}
              </span>
            )}
          </button>

          <button
            onClick={() => goSection('delivered')}
            className={`flex flex-col items-center justify-center text-[9px] font-semibold relative transition-colors ${
              currentSection === 'delivered'
                ? 'text-teal-600 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackageCheck className="w-5 h-5 mb-0.5" />
            <span>Done</span>
            {activeCounts.delivered > 0 && (
              <span className="absolute top-1.5 right-1 min-w-[1.1rem] h-4 px-1 bg-teal-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeCounts.delivered}
              </span>
            )}
          </button>
        </div>
      </nav>

      {canSearch ? <SearchOrders isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} /> : null}

      {canSettings ? (
        <SettingsModal
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          initialTab={configInitialTab}
          statusInfo={steadfastStatus}
          onSteadfastUpdated={(info) => setSteadfastStatus(info)}
          branding={branding}
          onBrandingUpdated={(br) => setBranding(br)}
          onDataRestored={loadData}
          canUseUserBackup={canUseUserBackup}
        />
      ) : null}

      {submittedParcelOrder && (
        <SteadfastParcelDetailsModal
          order={submittedParcelOrder}
          onClose={() => {
            setSubmittedParcelOrder(null);
            goSection('courier_assign');
          }}
          onSimulateWebhookPickup={async (parcelId) => {
            await simulateWebhook(parcelId, 'picked_up');
            loadData();
            setSubmittedParcelOrder(null);
            goSection('shipping');
          }}
        />
      )}
    </div>
  );
}
