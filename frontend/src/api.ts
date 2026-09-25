import {
  ExtractedOrderData,
  Order,
  OrderStatus,
  SteadfastStatusInfo,
  BrandingConfig,
  InventoryProduct,
  OpenRouterStatusInfo,
  AllCouriersStatus,
  CourierRatingResult,
  SteadfastCustomerFraudCheckResult,
  PathaoConfig,
  RedxConfig,
  CarrybeeConfig,
  Customer,
  CustomerCategory,
  CustomerSortKey,
} from './types/order';

import { apiFetch } from './apiClient';
export { apiUrl } from './apiClient';


export async function fetchBranding(): Promise<BrandingConfig> {
  const res = await apiFetch('/api/config/branding');
  if (!res.ok) throw new Error('Failed to fetch branding');
  return res.json();
}

export async function saveBranding(pageName: string, pageLogo: string): Promise<BrandingConfig> {
  const res = await apiFetch('/api/config/branding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageName, pageLogo }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save branding');
  }
  return res.json();
}

export async function fetchCounts(): Promise<{
  onHold: number;
  courierAssign: number;
  shipping: number;
  delivered: number;
}> {
  const res = await apiFetch('/api/counts');
  if (!res.ok) throw new Error('Failed to fetch counts');
  return res.json();
}

export async function fetchOrders(status?: OrderStatus): Promise<Order[]> {
  const url = status ? `/api/orders?status=${encodeURIComponent(status)}` : '/api/orders';
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

export async function fetchOrder(id: string): Promise<Order> {
  const res = await apiFetch(`/api/orders/${id}`);
  if (!res.ok) throw new Error('Failed to fetch order');
  return res.json();
}

export async function searchOrders(query: string): Promise<Order[]> {
  const res = await apiFetch(`/api/orders/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search orders');
  return res.json();
}

export async function checkPhonePreviousOrders(
  phone: string,
  excludeOrderId?: string
): Promise<{ count: number; orders: Partial<Order>[] }> {
  if (!phone || phone.trim().length < 5) {
    return { count: 0, orders: [] };
  }
  const url = `/api/orders/check-phone?phone=${encodeURIComponent(phone)}${
    excludeOrderId ? `&exclude=${encodeURIComponent(excludeOrderId)}` : ''
  }`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Failed to check phone');
  return res.json();
}

export async function processOrderAI(text: string): Promise<ExtractedOrderData> {
  const res = await apiFetch('/api/ai/process-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to process order with AI');
  }
  return res.json();
}

export async function createOrder(orderData: Partial<Order>): Promise<{
  order: Order;
  stockWarnings?: string[];
  inventoryReduced?: { name: string; reduced: number; remaining: number }[];
}> {
  const res = await apiFetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save order');
  }
  const data = await res.json();
  if (data.order) {
    return data;
  }
  return { order: data };
}

export async function deleteOrder(id: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch(`/api/orders/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete order');
  }
  return res.json();
}

export async function sendToSteadfast(orderId: string): Promise<{
  success: boolean;
  parcelId?: string;
  order?: Order;
  error?: string;
}> {
  const res = await apiFetch('/api/steadfast/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      error: data.error || 'Failed to send to Steadfast',
      order: data.order,
    };
  }
  return data;
}

export async function getSteadfastConfig(): Promise<SteadfastStatusInfo> {
  const res = await apiFetch('/api/config/steadfast');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function saveSteadfastConfig(
  apiKey: string,
  secretKey: string,
  baseUrl?: string
): Promise<SteadfastStatusInfo> {
  const res = await apiFetch('/api/config/steadfast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, secretKey, baseUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save Steadfast credentials');
  }
  return res.json();
}

export async function testSteadfastConnection(
  apiKey?: string,
  secretKey?: string,
  baseUrl?: string
): Promise<{ success: boolean; message: string; balance?: number; testedUrl?: string }> {
  const res = await apiFetch('/api/config/steadfast/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, secretKey, baseUrl }),
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Failed to test connection' }));
  return data;
}

export async function simulateWebhook(
  parcelId: string,
  status: string = 'picked_up'
): Promise<{ success: boolean; order: Order }> {
  const res = await apiFetch('/api/steadfast/simulate-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parcelId, status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to trigger webhook');
  }
  return res.json();
}

export async function fetchSteadfastParcelStatus(parcelId: string): Promise<{
  success: boolean;
  parcelId: string;
  deliveryStatus: string | null;
  data?: any;
  error?: string;
}> {
  const res = await apiFetch(`/api/steadfast/status/${encodeURIComponent(parcelId)}`);
  const data = await res.json().catch(() => ({ success: false, error: 'Failed to fetch status' }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch Steadfast parcel status');
  }
  return data;
}

export async function syncSteadfastParcelStatus(orderId: string): Promise<{
  success: boolean;
  updated: boolean;
  deliveryStatus?: string;
  order: Order;
  message?: string;
}> {
  const res = await apiFetch(`/api/steadfast/sync-status/${encodeURIComponent(orderId)}`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({ success: false, error: 'Failed to sync status' }));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to sync Steadfast parcel status');
  }
  return data;
}

// Couriers API (Steadfast, Pathao, RedX, CarryBee)
export async function fetchCouriersStatus(): Promise<AllCouriersStatus> {
  const res = await apiFetch('/api/couriers/status');
  if (!res.ok) throw new Error('Failed to fetch courier status');
  return res.json();
}

export async function savePathaoConfig(config: PathaoConfig): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/couriers/pathao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save Pathao configuration');
  }
  return res.json();
}

export async function testPathaoConnection(
  config: PathaoConfig
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/couriers/pathao/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json().catch(() => ({ success: false, message: 'Failed to test Pathao connection' }));
}

export async function saveRedxConfig(config: RedxConfig): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/couriers/redx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save RedX configuration');
  }
  return res.json();
}

export async function testRedxConnection(
  config: RedxConfig
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/couriers/redx/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json().catch(() => ({ success: false, message: 'Failed to test RedX connection' }));
}

export async function saveCarrybeeConfig(
  config: CarrybeeConfig
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/couriers/carrybee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save CarryBee configuration');
  }
  return res.json();
}

export async function testCarrybeeConnection(
  config: CarrybeeConfig
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/couriers/carrybee/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json().catch(() => ({ success: false, message: 'Failed to test CarryBee connection' }));
}

export async function fetchCourierCustomerRating(phone: string): Promise<CourierRatingResult[]> {
  const res = await apiFetch(`/api/couriers/customer-rating?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

export async function fetchSteadfastCustomerRating(
  phone: string
): Promise<SteadfastCustomerFraudCheckResult> {
  const res = await apiFetch(`/api/steadfast/customer-rating?phone=${encodeURIComponent(phone)}`);
  if (!res.ok) {
    return {
      isAvailable: false,
      isRealData: false,
      phone,
      statusMessage: 'Rating unavailable',
      source: 'none',
    };
  }
  return res.json().catch(() => ({
    isAvailable: false,
    isRealData: false,
    phone,
    statusMessage: 'Rating unavailable',
    source: 'none',
  }));
}


// Inventory API
export async function fetchInventory(): Promise<InventoryProduct[]> {
  const res = await apiFetch('/api/inventory');
  if (!res.ok) throw new Error('Failed to fetch inventory');
  return res.json();
}

export async function createInventoryProduct(data: {
  name: string;
  defaultPrice?: number;
}): Promise<InventoryProduct> {
  const res = await apiFetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create inventory product');
  }
  return res.json();
}

export async function updateInventoryProduct(
  id: string,
  data: Partial<{ name: string; defaultPrice: number }>
): Promise<InventoryProduct> {
  const res = await apiFetch(`/api/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update inventory product');
  }
  return res.json();
}

export async function updateInventoryStock(
  id: string,
  deltaOrStock: { stock?: number; delta?: number }
): Promise<InventoryProduct> {
  const res = await apiFetch(`/api/inventory/${id}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deltaOrStock),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update stock');
  }
  return res.json();
}

export async function deleteInventoryProduct(id: string): Promise<{ success: boolean }> {
  const res = await apiFetch(`/api/inventory/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete product');
  }
  return res.json();
}

// OpenRouter API
export async function getOpenRouterConfig(): Promise<OpenRouterStatusInfo> {
  const res = await apiFetch('/api/config/openrouter');
  if (!res.ok) throw new Error('Failed to fetch OpenRouter configuration');
  return res.json();
}

export async function saveOpenRouterConfig(
  apiKey: string,
  model: string
): Promise<OpenRouterStatusInfo> {
  const res = await apiFetch('/api/config/openrouter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save OpenRouter settings');
  }
  return res.json();
}

export async function testOpenRouterConnection(
  apiKey?: string,
  model?: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/config/openrouter/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, model }),
  });
  const data = await res.json().catch(() => ({
    success: false,
    message: 'Failed to test OpenRouter connection',
  }));
  return data;
}

/** Download full DB backup (orders + inventory + config/API keys/branding) */
export async function downloadFullBackup(): Promise<any> {
  const res = await apiFetch('/api/backup');
  if (!res.ok) throw new Error('Failed to create database backup');
  return res.json();
}

/** Restore full DB from backup JSON (replaces all current data) */
export async function restoreFullBackup(backup: any): Promise<{
  success: boolean;
  message?: string;
  restored?: { orders: number; inventory: number; configKeys: number };
}> {
  const res = await apiFetch('/api/backup/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backup),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to restore database backup');
  }
  return data;
}

export type CustomersQuery = {
  q?: string;
  name?: string;
  email?: string;
  phone?: string;
  orderId?: string;
  categoryId?: string;
  sortBy?: CustomerSortKey;
  sortDir?: 'asc' | 'desc';
};

function customersQueryString(params: CustomersQuery = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchCustomers(params: CustomersQuery = {}): Promise<{
  customers: Customer[];
  total: number;
  categories: CustomerCategory[];
}> {
  const res = await apiFetch(`/api/customers${customersQueryString(params)}`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  return res.json();
}

export async function fetchCustomerDetail(phoneKey: string): Promise<{
  customer: Customer;
  orders: Order[];
}> {
  const res = await apiFetch(`/api/customers/${encodeURIComponent(phoneKey)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch customer');
  }
  return res.json();
}

export async function fetchCustomerCategories(): Promise<CustomerCategory[]> {
  const res = await apiFetch('/api/customers/categories');
  if (!res.ok) throw new Error('Failed to fetch customer categories');
  const data = await res.json();
  return data.categories || [];
}

export async function saveCustomerCategories(
  categories: CustomerCategory[]
): Promise<CustomerCategory[]> {
  const res = await apiFetch('/api/customers/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save categories');
  }
  const data = await res.json();
  return data.categories || [];
}

export async function exportCustomersFile(
  format: 'csv' | 'xlsx',
  params: CustomersQuery = {}
): Promise<void> {
  const qs = customersQueryString({ ...params });
  const sep = qs ? '&' : '?';
  const res = await apiFetch(`/api/customers/export${qs}${sep}format=${format}`);
  if (!res.ok) throw new Error('Failed to export customers');
  const blob = await res.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  const ext = format === 'csv' ? 'csv' : 'xls';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `customers-${stamp}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
