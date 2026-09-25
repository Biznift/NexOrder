export type OrderStatus = 'ON HOLD' | 'COURIER ASSIGN' | 'SHIPPING' | 'DELIVERED';

export interface OrderItem {
  productName: string;
  quantity: number;
  color: string;
  price: number;
}

export interface Order {
  id: string;
  orderId: string;
  customerName: string;
  phone: string;
  /** Optional — stored when provided; used in customer CRM */
  email?: string;
  address: string;
  products: OrderItem[];
  // Flattened/summary helpers for legacy cards and fast display
  product?: string;
  quantity?: number | string;
  color?: string;
  price?: number | string;
  note: string;
  confirmDate: string; // e.g. "2026-09-23"
  confirmTime: string; // e.g. "13:35"
  status: OrderStatus;
  steadfastParcelId: string | null;
  steadfastResponse: string | null;
  steadfastSubmissionDateTime: string | null;
  shippingStatus?: string | null; // e.g. "picked_up", "collected", "in_transit"
  createdAt: string;
  updatedAt: string;
}

/** Shop-configurable customer tier (matched by order count and/or paid amount) */
export interface CustomerCategory {
  id: string;
  name: string;
  /** Minimum number of orders to qualify */
  minOrders: number;
  /** Minimum total paid amount to qualify */
  minPaidAmount: number;
  color: string;
  /** Higher wins when multiple categories match */
  priority: number;
  enabled?: boolean;
}

export type CustomerSortKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'orderCount'
  | 'totalPaid'
  | 'firstOrderAt'
  | 'lastOrderAt'
  | 'category';

/** Aggregated customer profile — one per normalized phone key within a shop */
export interface Customer {
  id: string;
  phoneKey: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  orderCount: number;
  totalPaid: number;
  productNames: string[];
  orderIds: string[];
  firstOrderAt: string;
  lastOrderAt: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
}

export const DEFAULT_CUSTOMER_CATEGORIES: CustomerCategory[] = [
  {
    id: 'new',
    name: 'New',
    minOrders: 1,
    minPaidAmount: 0,
    color: '#64748b',
    priority: 10,
    enabled: true,
  },
  {
    id: 'regular',
    name: 'Regular',
    minOrders: 2,
    minPaidAmount: 0,
    color: '#2563eb',
    priority: 20,
    enabled: true,
  },
  {
    id: 'loyal',
    name: 'Loyal',
    minOrders: 5,
    minPaidAmount: 0,
    color: '#7c3aed',
    priority: 30,
    enabled: true,
  },
  {
    id: 'vip',
    name: 'VIP',
    minOrders: 10,
    minPaidAmount: 0,
    color: '#d97706',
    priority: 40,
    enabled: true,
  },
  {
    id: 'whale',
    name: 'High Spender',
    minOrders: 0,
    minPaidAmount: 50000,
    color: '#059669',
    priority: 50,
    enabled: true,
  },
];

export interface InventoryProduct {
  id: string;
  name: string;
  stock?: number;
  defaultPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedProductItem {
  productName: string;
  quantity: number;
  color: string;
  price: number;
}

export interface ExtractedOrderData {
  customerName: string;
  phone: string;
  address: string;
  products: ExtractedProductItem[];
  note: string;
  // Flattened legacy helpers
  product?: string;
  quantity?: string;
  color?: string;
  price?: string;
}

export interface SteadfastConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
}

export interface SteadfastStatusInfo {
  isConfigured: boolean;
  apiKeyMasked: string | null;
  baseUrl?: string;
}

export type CourierName = 'STEADFAST' | 'PATHAO' | 'REDX' | 'CARRYBEE';

export interface CourierRatingResult {
  courier: CourierName;
  isAvailable: boolean;
  rating?: number | string | null;
  deliveredCount?: number | null;
  returnCount?: number | null;
  totalOrders?: number | null;
  successRate?: string | null;
  warningRemark?: string | null;
  statusMessage: string;
  isRealData: boolean;
}

export interface SteadfastCustomerFraudCheckResult {
  isAvailable: boolean;
  isRealData: boolean;
  phone: string;
  rating?: string | null;
  totalParcels?: number | null;
  deliveredParcels?: number | null;
  cancelledParcels?: number | null;
  fraudReports?: number | null;
  successRate?: string | null;
  warningRemark?: string | null;
  statusMessage: string;
  source: 'official_api' | 'merchant_database' | 'none';
}

export interface PathaoConfig {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}

export interface RedxConfig {
  baseUrl?: string;
  apiToken?: string;
}

export interface CarrybeeConfig {
  baseUrl?: string;
  apiKey?: string;
  secretKey?: string;
}

export interface AllCouriersStatus {
  steadfast: SteadfastStatusInfo;
  pathao: {
    isConfigured: boolean;
    baseUrl?: string;
    clientIdMasked?: string | null;
    usernameMasked?: string | null;
  };
  redx: {
    isConfigured: boolean;
    baseUrl?: string;
    tokenMasked?: string | null;
  };
  carrybee: {
    isConfigured: boolean;
    baseUrl?: string;
    apiKeyMasked?: string | null;
  };
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

export interface OpenRouterStatusInfo {
  isConfigured: boolean;
  model: string;
  apiKeyMasked: string | null;
}

export type OrderDateFilter =
  | 'TODAY'
  | 'YESTERDAY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY'
  | 'LIFETIME';

export interface BrandingConfig {
  pageName: string;
  pageLogo: string;
}
