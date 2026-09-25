import fs from 'fs';
import path from 'path';
import {
  Order,
  OrderItem,
  OrderStatus,
  SteadfastConfig,
  InventoryProduct,
  OpenRouterConfig,
  PathaoConfig,
  RedxConfig,
  CarrybeeConfig,
} from '../src/types/order.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export type AppConfig = Partial<SteadfastConfig> & {
  pageName?: string;
  pageLogo?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
  pathao?: PathaoConfig;
  redx?: RedxConfig;
  carrybee?: CarrybeeConfig;
};

let cachedOrders: Order[] = [];
let cachedConfig: AppConfig = {};
let cachedInventory: InventoryProduct[] = [];

function loadOrdersFromDisk(): Order[] {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
      cachedOrders = JSON.parse(data);
    } else {
      cachedOrders = [];
      saveOrdersToDisk();
    }
  } catch (err) {
    console.error('Error reading orders file:', err);
    cachedOrders = [];
  }
  return cachedOrders;
}

function loadConfigFromDisk(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      cachedConfig = JSON.parse(data);
    } else {
      cachedConfig = {};
    }
  } catch (err) {
    console.error('Error reading config file:', err);
    cachedConfig = {};
  }
  return cachedConfig;
}

function loadInventoryFromDisk(): InventoryProduct[] {
  try {
    if (fs.existsSync(INVENTORY_FILE)) {
      const data = fs.readFileSync(INVENTORY_FILE, 'utf-8');
      cachedInventory = JSON.parse(data);
    } else {
      // Seed default sample inventory for Rifa Baby Shop
      cachedInventory = [
        {
          id: 'prod-1',
          name: 'বেবি নকশি কাঁথা (Baby Nakshi Katha)',
          stock: 45,
          defaultPrice: 650,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'prod-2',
          name: 'বেবি কটন ড্রেস সেট (Baby Cotton Dress)',
          stock: 30,
          defaultPrice: 850,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'prod-3',
          name: 'বেবি জুতো (Soft Baby Shoes)',
          stock: 25,
          defaultPrice: 350,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'prod-4',
          name: 'বেবি ফিডার ও এক্সেসরিজ সেট',
          stock: 20,
          defaultPrice: 500,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      saveInventoryToDisk();
    }
  } catch (err) {
    console.error('Error reading inventory file:', err);
    cachedInventory = [];
  }
  return cachedInventory;
}

function saveOrdersToDisk() {
  try {
    const tempFile = `${ORDERS_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(cachedOrders, null, 2), 'utf-8');
    fs.renameSync(tempFile, ORDERS_FILE);
  } catch (err) {
    console.error('Error saving orders to disk:', err);
  }
}

function saveConfigToDisk() {
  try {
    const tempFile = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(cachedConfig, null, 2), 'utf-8');
    fs.renameSync(tempFile, CONFIG_FILE);
  } catch (err) {
    console.error('Error saving config to disk:', err);
  }
}

function saveInventoryToDisk() {
  try {
    const tempFile = `${INVENTORY_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(cachedInventory, null, 2), 'utf-8');
    fs.renameSync(tempFile, INVENTORY_FILE);
  } catch (err) {
    console.error('Error saving inventory to disk:', err);
  }
}

// Initial load
loadOrdersFromDisk();
loadConfigFromDisk();
loadInventoryFromDisk();

export const db = {
  // Orders
  getAllOrders(): Order[] {
    const orders = loadOrdersFromDisk();
    return [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getOrderById(id: string): Order | undefined {
    const orders = loadOrdersFromDisk();
    return orders.find((o) => o.id === id || o.orderId === id);
  },

  getOrderByParcelId(parcelId: string): Order | undefined {
    const orders = loadOrdersFromDisk();
    const cleanId = String(parcelId).trim();
    return orders.find(
      (o) =>
        o.steadfastParcelId === cleanId ||
        o.orderId === cleanId ||
        (o.steadfastParcelId && String(o.steadfastParcelId).toLowerCase() === cleanId.toLowerCase())
    );
  },

  getOrdersByStatus(status: OrderStatus): Order[] {
    const orders = loadOrdersFromDisk();
    return orders
      .filter((o) => o.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getOrdersByPhone(phone: string, excludeOrderId?: string): Order[] {
    if (!phone) return [];
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 5) return [];

    const orders = loadOrdersFromDisk();
    return orders.filter((o) => {
      if (excludeOrderId && (o.id === excludeOrderId || o.orderId === excludeOrderId)) {
        return false;
      }
      const existingClean = (o.phone || '').replace(/[^0-9]/g, '');
      if (existingClean === cleanPhone) return true;
      if (cleanPhone.length >= 10 && existingClean.length >= 10) {
        return cleanPhone.slice(-10) === existingClean.slice(-10);
      }
      return false;
    });
  },

  createOrder(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Order {
    loadOrdersFromDisk();
    const now = new Date().toISOString();
    const generatedId = data.orderId || `ORD-${Date.now().toString(36).toUpperCase()}`;

    // Normalize products
    const products: OrderItem[] = Array.isArray(data.products) && data.products.length > 0
      ? data.products
      : [
          {
            productName: data.product || 'Product',
            quantity: Number(data.quantity) || 1,
            color: data.color || '',
            price: Number(data.price) || 0,
          },
        ];

    // Compute summary fields if not provided
    const summaryProduct =
      data.product ||
      products
        .map((p) => `${p.productName}${p.quantity > 1 ? ` (${p.quantity} pcs)` : ''}`)
        .join(', ');
    const summaryQty =
      data.quantity !== undefined
        ? data.quantity
        : products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
    const summaryPrice =
      data.price !== undefined
        ? data.price
        : products.reduce((acc, p) => acc + (Number(p.price) || 0), 0);
    const summaryColor =
      data.color ||
      products
        .map((p) => p.color)
        .filter(Boolean)
        .join(', ');

    const newOrder: Order = {
      ...data,
      id: generatedId,
      orderId: generatedId,
      products,
      product: summaryProduct,
      quantity: summaryQty,
      price: summaryPrice,
      color: summaryColor,
      createdAt: now,
      updatedAt: now,
    };

    cachedOrders.unshift(newOrder);
    saveOrdersToDisk();
    return newOrder;
  },

  updateOrder(id: string, updates: Partial<Order>): Order | null {
    loadOrdersFromDisk();
    const index = cachedOrders.findIndex((o) => o.id === id || o.orderId === id);
    if (index === -1) return null;

    const current = cachedOrders[index];
    const products = updates.products || current.products;

    let summaryProduct = updates.product !== undefined ? updates.product : current.product;
    let summaryQty = updates.quantity !== undefined ? updates.quantity : current.quantity;
    let summaryPrice = updates.price !== undefined ? updates.price : current.price;
    let summaryColor = updates.color !== undefined ? updates.color : current.color;

    if (updates.products && !updates.product) {
      summaryProduct = products
        .map((p) => `${p.productName}${p.quantity > 1 ? ` (${p.quantity} pcs)` : ''}`)
        .join(', ');
      summaryQty = products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
      summaryPrice = products.reduce((acc, p) => acc + (Number(p.price) || 0), 0);
      summaryColor = products.map((p) => p.color).filter(Boolean).join(', ');
    }

    cachedOrders[index] = {
      ...current,
      ...updates,
      products,
      product: summaryProduct,
      quantity: summaryQty,
      price: summaryPrice,
      color: summaryColor,
      updatedAt: new Date().toISOString(),
    };

    saveOrdersToDisk();
    return cachedOrders[index];
  },

  deleteOrder(id: string): boolean {
    loadOrdersFromDisk();
    const initialLength = cachedOrders.length;
    cachedOrders = cachedOrders.filter((o) => o.id !== id && o.orderId !== id);
    if (cachedOrders.length !== initialLength) {
      saveOrdersToDisk();
      return true;
    }
    return false;
  },

  searchOrders(query: string): Order[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const cleanQ = q.replace(/[^0-9]/g, '');
    const orders = loadOrdersFromDisk();

    return orders.filter((o) => {
      const matchOrderId = o.orderId.toLowerCase().includes(q);
      const matchName = o.customerName.toLowerCase().includes(q);
      const matchParcel = o.steadfastParcelId ? o.steadfastParcelId.toLowerCase().includes(q) : false;
      const cleanPhone = (o.phone || '').replace(/[^0-9]/g, '');
      const matchPhone = cleanQ && cleanPhone.includes(cleanQ);
      const matchProduct = (o.product || '').toLowerCase().includes(q);
      return matchOrderId || matchName || matchParcel || matchPhone || matchProduct;
    });
  },

  // Inventory Management
  getAllInventory(): InventoryProduct[] {
    const items = loadInventoryFromDisk();
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  },

  getInventoryById(id: string): InventoryProduct | undefined {
    const items = loadInventoryFromDisk();
    return items.find((p) => p.id === id);
  },

  createInventoryProduct(data: { name: string; stock: number; defaultPrice?: number }): InventoryProduct {
    loadInventoryFromDisk();
    const now = new Date().toISOString();
    const newProd: InventoryProduct = {
      id: `prod-${Date.now().toString(36)}-${Math.floor(10 + Math.random() * 90)}`,
      name: data.name.trim(),
      stock: Math.max(0, Math.floor(Number(data.stock) || 0)),
      defaultPrice: data.defaultPrice !== undefined ? Number(data.defaultPrice) || 0 : undefined,
      createdAt: now,
      updatedAt: now,
    };
    cachedInventory.push(newProd);
    saveInventoryToDisk();
    return newProd;
  },

  updateInventoryProduct(
    id: string,
    updates: Partial<{ name: string; stock: number; defaultPrice: number }>
  ): InventoryProduct | null {
    loadInventoryFromDisk();
    const index = cachedInventory.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const current = cachedInventory[index];
    cachedInventory[index] = {
      ...current,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      stock: updates.stock !== undefined ? Math.max(0, Math.floor(Number(updates.stock) || 0)) : current.stock,
      defaultPrice:
        updates.defaultPrice !== undefined ? Number(updates.defaultPrice) || 0 : current.defaultPrice,
      updatedAt: new Date().toISOString(),
    };
    saveInventoryToDisk();
    return cachedInventory[index];
  },

  deleteInventoryProduct(id: string): boolean {
    loadInventoryFromDisk();
    const len = cachedInventory.length;
    cachedInventory = cachedInventory.filter((p) => p.id !== id);
    if (cachedInventory.length !== len) {
      saveInventoryToDisk();
      return true;
    }
    return false;
  },

  // Stock check and reduction on CONFIRM ORDER
  reduceInventoryStock(items: { productName: string; quantity: number }[]): {
    success: boolean;
    reducedItems: { name: string; reduced: number; remaining: number }[];
    warnings: string[];
  } {
    loadInventoryFromDisk();
    const reducedItems: { name: string; reduced: number; remaining: number }[] = [];
    const warnings: string[] = [];

    for (const item of items) {
      const q = Math.max(0, Math.floor(Number(item.quantity) || 0));
      if (q <= 0) continue;

      const trimmedName = item.productName.trim().toLowerCase();
      // Match by exact name or partial substring
      const matched = cachedInventory.find(
        (p) =>
          p.name.trim().toLowerCase() === trimmedName ||
          trimmedName.includes(p.name.trim().toLowerCase()) ||
          p.name.trim().toLowerCase().includes(trimmedName)
      );

      if (matched) {
        if (matched.stock < q) {
          warnings.push(
            `Stock for "${matched.name}" is only ${matched.stock} pcs, but order requested ${q} pcs.`
          );
        }
        matched.stock = Math.max(0, matched.stock - q);
        matched.updatedAt = new Date().toISOString();
        reducedItems.push({
          name: matched.name,
          reduced: q,
          remaining: matched.stock,
        });
      }
    }

    if (reducedItems.length > 0) {
      saveInventoryToDisk();
    }

    return {
      success: true,
      reducedItems,
      warnings,
    };
  },

  // Configurations
  getSteadfastConfig(): SteadfastConfig {
    const config = loadConfigFromDisk();
    const apiKey = process.env.STEADFAST_API_KEY || config.apiKey || '';
    const secretKey = process.env.STEADFAST_SECRET_KEY || config.secretKey || '';
    const baseUrl =
      process.env.STEADFAST_BASE_URL?.trim() ||
      config.baseUrl?.trim() ||
      'https://portal.steadfast.com.bd/api/v1';
    return { apiKey, secretKey, baseUrl };
  },

  saveSteadfastConfig(apiKey: string, secretKey: string, baseUrl?: string) {
    loadConfigFromDisk();
    cachedConfig = {
      ...cachedConfig,
      apiKey,
      secretKey,
      ...(baseUrl ? { baseUrl: baseUrl.trim() } : {}),
    };
    saveConfigToDisk();
  },

  getOpenRouterConfig(): OpenRouterConfig {
    const config = loadConfigFromDisk();
    const apiKey = process.env.OPENROUTER_API_KEY || config.openRouterApiKey || '';
    const model = process.env.OPENROUTER_MODEL || config.openRouterModel || 'openai/gpt-4o-mini';
    return { apiKey, model };
  },

  saveOpenRouterConfig(apiKey: string, model: string) {
    loadConfigFromDisk();
    cachedConfig = {
      ...cachedConfig,
      openRouterApiKey: apiKey.trim(),
      openRouterModel: model.trim() || 'openai/gpt-4o-mini',
    };
    saveConfigToDisk();
  },

  getPathaoConfig(): PathaoConfig {
    const config = loadConfigFromDisk();
    const stored = config.pathao || {};
    return {
      baseUrl: process.env.PATHAO_BASE_URL?.trim() || stored.baseUrl?.trim() || 'https://api-hermes.pathao.com',
      clientId: process.env.PATHAO_CLIENT_ID?.trim() || stored.clientId?.trim() || '',
      clientSecret: process.env.PATHAO_CLIENT_SECRET?.trim() || stored.clientSecret?.trim() || '',
      username: process.env.PATHAO_USERNAME?.trim() || stored.username?.trim() || '',
      password: process.env.PATHAO_PASSWORD?.trim() || stored.password?.trim() || '',
    };
  },

  savePathaoConfig(pathao: PathaoConfig) {
    loadConfigFromDisk();
    cachedConfig = {
      ...cachedConfig,
      pathao: {
        baseUrl: pathao.baseUrl?.trim() || 'https://api-hermes.pathao.com',
        clientId: pathao.clientId?.trim() || '',
        clientSecret: pathao.clientSecret?.trim() || '',
        username: pathao.username?.trim() || '',
        password: pathao.password?.trim() || '',
      },
    };
    saveConfigToDisk();
  },

  getRedxConfig(): RedxConfig {
    const config = loadConfigFromDisk();
    const stored = config.redx || {};
    return {
      baseUrl: process.env.REDX_BASE_URL?.trim() || stored.baseUrl?.trim() || 'https://openapi.redx.com.bd/v1.0.0-beta',
      apiToken: process.env.REDX_API_TOKEN?.trim() || stored.apiToken?.trim() || '',
    };
  },

  saveRedxConfig(redx: RedxConfig) {
    loadConfigFromDisk();
    cachedConfig = {
      ...cachedConfig,
      redx: {
        baseUrl: redx.baseUrl?.trim() || 'https://openapi.redx.com.bd/v1.0.0-beta',
        apiToken: redx.apiToken?.trim() || '',
      },
    };
    saveConfigToDisk();
  },

  getCarrybeeConfig(): CarrybeeConfig {
    const config = loadConfigFromDisk();
    const stored = config.carrybee || {};
    return {
      baseUrl: process.env.CARRYBEE_BASE_URL?.trim() || stored.baseUrl?.trim() || 'https://api.carrybee.com',
      apiKey: process.env.CARRYBEE_API_KEY?.trim() || stored.apiKey?.trim() || '',
      secretKey: process.env.CARRYBEE_SECRET_KEY?.trim() || stored.secretKey?.trim() || '',
    };
  },

  saveCarrybeeConfig(carrybee: CarrybeeConfig) {
    loadConfigFromDisk();
    cachedConfig = {
      ...cachedConfig,
      carrybee: {
        baseUrl: carrybee.baseUrl?.trim() || 'https://api.carrybee.com',
        apiKey: carrybee.apiKey?.trim() || '',
        secretKey: carrybee.secretKey?.trim() || '',
      },
    };
    saveConfigToDisk();
  },

  getAppSettings(): { pageName: string; pageLogo: string } {
    const config = loadConfigFromDisk();
    return {
      pageName: config.pageName || 'Rifa Baby Shop',
      pageLogo: config.pageLogo || '',
    };
  },

  saveAppSettings(pageName: string, pageLogo: string) {
    loadConfigFromDisk();
    cachedConfig = {
      ...cachedConfig,
      pageName: pageName.trim() || 'Rifa Baby Shop',
      pageLogo: pageLogo ?? cachedConfig.pageLogo ?? '',
    };
    saveConfigToDisk();
  },

  getCounts(): { onHold: number; courierAssign: number; shipping: number; delivered: number } {
    const orders = loadOrdersFromDisk();
    return {
      onHold: orders.filter((o) => o.status === 'ON HOLD').length,
      courierAssign: orders.filter((o) => o.status === 'COURIER ASSIGN').length,
      shipping: orders.filter((o) => o.status === 'SHIPPING').length,
      delivered: orders.filter((o) => o.status === 'DELIVERED').length,
    };
  },
};
