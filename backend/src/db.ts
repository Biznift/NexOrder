import type { Env } from './env';
import { redactConfigSecrets } from './auth';
import type {
  Order,
  OrderItem,
  OrderStatus,
  InventoryProduct,
  SteadfastConfig,
  OpenRouterConfig,
  PathaoConfig,
  RedxConfig,
  CarrybeeConfig,
  BrandingConfig,
  AllCouriersStatus,
  CustomerCategory,
} from './types';
import { DEFAULT_CUSTOMER_CATEGORIES } from './types';
import { normalizeCategories, phonesMatch } from './customers';

export type AppConfig = Partial<SteadfastConfig> & {
  pageName?: string;
  pageLogo?: string;
  openRouterApiKey?: string;
  openRouterModel?: string;
  pathao?: PathaoConfig;
  redx?: RedxConfig;
  carrybee?: CarrybeeConfig;
  customerCategories?: CustomerCategory[];
};

export type DbOptions = {
  /** Shop owner id — all reads/writes scoped to this tenant */
  tenantId?: string | null;
  /** Cross-tenant lookups (webhooks) */
  bypassTenant?: boolean;
};

function parseOrder(row: { data: string }): Order {
  return JSON.parse(row.data) as Order;
}

function parseInventory(row: { data: string }): InventoryProduct {
  return JSON.parse(row.data) as InventoryProduct;
}

export function createDb(env: Env, options: DbOptions = {}) {
  const d1 = env.DB;
  const tenantId = options.tenantId || null;
  const bypass = !!options.bypassTenant;

  function configKey(): string {
    if (tenantId) return `tenant:${tenantId}`;
    return 'main';
  }

  async function getConfig(): Promise<AppConfig> {
    const key = configKey();
    let row = await d1.prepare('SELECT value FROM app_config WHERE key = ?').bind(key).first<{ value: string }>();
    // Fallback: legacy global config → copy into tenant bucket on first read
    if (!row?.value && tenantId) {
      const legacy = await d1
        .prepare('SELECT value FROM app_config WHERE key = ?')
        .bind('main')
        .first<{ value: string }>();
      if (legacy?.value) {
        await d1
          .prepare(
            `INSERT INTO app_config (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`
          )
          .bind(key, legacy.value)
          .run();
        row = legacy;
      }
    }
    if (!row?.value) return {};
    try {
      return JSON.parse(row.value) as AppConfig;
    } catch {
      return {};
    }
  }

  async function saveConfig(config: AppConfig) {
    await d1
      .prepare(
        `INSERT INTO app_config (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .bind(configKey(), JSON.stringify(config))
      .run();
  }

  function assertTenant() {
    if (!bypass && !tenantId) {
      throw new Error('tenantId is required for database operations');
    }
  }

  return {
    async adoptLegacyRows(defaultTenantId: string) {
      await d1
        .prepare("UPDATE orders SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''")
        .bind(defaultTenantId)
        .run();
      await d1
        .prepare("UPDATE inventory SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''")
        .bind(defaultTenantId)
        .run();
    },

    async getAllOrders(): Promise<Order[]> {
      assertTenant();
      if (bypass) {
        const { results } = await d1
          .prepare('SELECT data FROM orders ORDER BY created_at DESC')
          .all<{ data: string }>();
        return (results || []).map(parseOrder);
      }
      const { results } = await d1
        .prepare('SELECT data FROM orders WHERE tenant_id = ? ORDER BY created_at DESC')
        .bind(tenantId)
        .all<{ data: string }>();
      return (results || []).map(parseOrder);
    },

    async getOrderById(id: string): Promise<Order | undefined> {
      assertTenant();
      if (bypass) {
        const row = await d1
          .prepare('SELECT data FROM orders WHERE id = ? OR order_id = ? LIMIT 1')
          .bind(id, id)
          .first<{ data: string }>();
        return row ? parseOrder(row) : undefined;
      }
      const row = await d1
        .prepare('SELECT data FROM orders WHERE (id = ? OR order_id = ?) AND tenant_id = ? LIMIT 1')
        .bind(id, id, tenantId)
        .first<{ data: string }>();
      return row ? parseOrder(row) : undefined;
    },

    async getOrderByParcelId(parcelId: string): Promise<Order | undefined> {
      const cleanId = String(parcelId).trim();
      const orders = bypass
        ? (
            await d1.prepare('SELECT data FROM orders').all<{ data: string }>()
          ).results?.map(parseOrder) || []
        : await this.getAllOrders();
      return orders.find(
        (o) =>
          o.steadfastParcelId === cleanId ||
          o.orderId === cleanId ||
          (o.steadfastParcelId && String(o.steadfastParcelId).toLowerCase() === cleanId.toLowerCase())
      );
    },

    async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
      assertTenant();
      if (bypass) {
        const { results } = await d1
          .prepare('SELECT data FROM orders WHERE status = ? ORDER BY created_at DESC')
          .bind(status)
          .all<{ data: string }>();
        return (results || []).map(parseOrder);
      }
      const { results } = await d1
        .prepare('SELECT data FROM orders WHERE status = ? AND tenant_id = ? ORDER BY created_at DESC')
        .bind(status, tenantId)
        .all<{ data: string }>();
      return (results || []).map(parseOrder);
    },

    async getOrdersByPhone(phone: string, excludeOrderId?: string): Promise<Order[]> {
      if (!phone) return [];
      const orders = await this.getAllOrders();
      return orders.filter((o) => {
        if (excludeOrderId && (o.id === excludeOrderId || o.orderId === excludeOrderId)) return false;
        return phonesMatch(phone, o.phone || '');
      });
    },

    async createOrder(data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
      assertTenant();
      if (!tenantId) throw new Error('tenantId required to create orders');
      const now = new Date().toISOString();
      const generatedId = data.orderId || `ORD-${Date.now().toString(36).toUpperCase()}`;
      const products: OrderItem[] =
        Array.isArray(data.products) && data.products.length > 0
          ? data.products
          : [
              {
                productName: data.product || 'Product',
                quantity: Number(data.quantity) || 1,
                color: data.color || '',
                price: Number(data.price) || 0,
              },
            ];

      const summaryProduct =
        data.product ||
        products.map((p) => `${p.productName}${p.quantity > 1 ? ` (${p.quantity} pcs)` : ''}`).join(', ');
      const summaryQty =
        data.quantity !== undefined ? data.quantity : products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
      const summaryPrice =
        data.price !== undefined ? data.price : products.reduce((acc, p) => acc + (Number(p.price) || 0), 0);
      const summaryColor = data.color || products.map((p) => p.color).filter(Boolean).join(', ');

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

      await d1
        .prepare(
          `INSERT INTO orders (id, order_id, status, phone, data, created_at, updated_at, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          newOrder.id,
          newOrder.orderId,
          newOrder.status,
          newOrder.phone || '',
          JSON.stringify(newOrder),
          now,
          now,
          tenantId
        )
        .run();

      return newOrder;
    },

    async updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
      const current = await this.getOrderById(id);
      if (!current) return null;

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

      const updated: Order = {
        ...current,
        ...updates,
        products,
        product: summaryProduct,
        quantity: summaryQty,
        price: summaryPrice,
        color: summaryColor,
        updatedAt: new Date().toISOString(),
      };

      if (bypass) {
        await d1
          .prepare(
            `UPDATE orders SET order_id = ?, status = ?, phone = ?, data = ?, updated_at = ?
             WHERE id = ? OR order_id = ?`
          )
          .bind(
            updated.orderId,
            updated.status,
            updated.phone || '',
            JSON.stringify(updated),
            updated.updatedAt,
            id,
            id
          )
          .run();
      } else {
        await d1
          .prepare(
            `UPDATE orders SET order_id = ?, status = ?, phone = ?, data = ?, updated_at = ?
             WHERE (id = ? OR order_id = ?) AND tenant_id = ?`
          )
          .bind(
            updated.orderId,
            updated.status,
            updated.phone || '',
            JSON.stringify(updated),
            updated.updatedAt,
            id,
            id,
            tenantId
          )
          .run();
      }

      return updated;
    },

    async deleteOrder(id: string): Promise<boolean> {
      assertTenant();
      const result = bypass
        ? await d1.prepare('DELETE FROM orders WHERE id = ? OR order_id = ?').bind(id, id).run()
        : await d1
            .prepare('DELETE FROM orders WHERE (id = ? OR order_id = ?) AND tenant_id = ?')
            .bind(id, id, tenantId)
            .run();
      return (result.meta?.changes || 0) > 0;
    },

    async searchOrders(query: string): Promise<Order[]> {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const cleanQ = q.replace(/[^0-9]/g, '');
      const orders = await this.getAllOrders();
      return orders.filter((o) => {
        const matchOrderId = o.orderId.toLowerCase().includes(q);
        const matchName = o.customerName.toLowerCase().includes(q);
        const matchParcel = o.steadfastParcelId ? o.steadfastParcelId.toLowerCase().includes(q) : false;
        const cleanPhone = (o.phone || '').replace(/[^0-9]/g, '');
        const matchPhone = Boolean(cleanQ && cleanPhone.includes(cleanQ));
        const matchProduct = (o.product || '').toLowerCase().includes(q);
        return matchOrderId || matchName || matchParcel || matchPhone || matchProduct;
      });
    },

    async getAllInventory(): Promise<InventoryProduct[]> {
      assertTenant();
      if (bypass) {
        const { results } = await d1.prepare('SELECT data FROM inventory ORDER BY name ASC').all<{ data: string }>();
        return (results || []).map(parseInventory);
      }
      const { results } = await d1
        .prepare('SELECT data FROM inventory WHERE tenant_id = ? ORDER BY name ASC')
        .bind(tenantId)
        .all<{ data: string }>();
      return (results || []).map(parseInventory);
    },

    async getInventoryById(id: string): Promise<InventoryProduct | undefined> {
      assertTenant();
      if (bypass) {
        const row = await d1.prepare('SELECT data FROM inventory WHERE id = ?').bind(id).first<{ data: string }>();
        return row ? parseInventory(row) : undefined;
      }
      const row = await d1
        .prepare('SELECT data FROM inventory WHERE id = ? AND tenant_id = ?')
        .bind(id, tenantId)
        .first<{ data: string }>();
      return row ? parseInventory(row) : undefined;
    },

    async createInventoryProduct(data: {
      name: string;
      stock?: number;
      defaultPrice?: number;
    }): Promise<InventoryProduct> {
      assertTenant();
      if (!tenantId) throw new Error('tenantId required');
      const now = new Date().toISOString();
      const newProd: InventoryProduct = {
        id: `prod-${Date.now().toString(36)}-${Math.floor(10 + Math.random() * 90)}`,
        name: data.name.trim(),
        stock: Math.max(0, Math.floor(Number(data.stock) || 0)),
        defaultPrice: data.defaultPrice !== undefined ? Number(data.defaultPrice) || 0 : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await d1
        .prepare('INSERT INTO inventory (id, name, data, updated_at, tenant_id) VALUES (?, ?, ?, ?, ?)')
        .bind(newProd.id, newProd.name, JSON.stringify(newProd), now, tenantId)
        .run();
      return newProd;
    },

    async updateInventoryProduct(
      id: string,
      updates: Partial<{ name: string; stock: number; defaultPrice: number }>
    ): Promise<InventoryProduct | null> {
      const current = await this.getInventoryById(id);
      if (!current) return null;
      const updated: InventoryProduct = {
        ...current,
        name: updates.name !== undefined ? updates.name.trim() : current.name,
        stock:
          updates.stock !== undefined ? Math.max(0, Math.floor(Number(updates.stock) || 0)) : current.stock,
        defaultPrice:
          updates.defaultPrice !== undefined ? Number(updates.defaultPrice) || 0 : current.defaultPrice,
        updatedAt: new Date().toISOString(),
      };
      if (bypass) {
        await d1
          .prepare('UPDATE inventory SET name = ?, data = ?, updated_at = ? WHERE id = ?')
          .bind(updated.name, JSON.stringify(updated), updated.updatedAt, id)
          .run();
      } else {
        await d1
          .prepare('UPDATE inventory SET name = ?, data = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
          .bind(updated.name, JSON.stringify(updated), updated.updatedAt, id, tenantId)
          .run();
      }
      return updated;
    },

    async deleteInventoryProduct(id: string): Promise<boolean> {
      assertTenant();
      const result = bypass
        ? await d1.prepare('DELETE FROM inventory WHERE id = ?').bind(id).run()
        : await d1.prepare('DELETE FROM inventory WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
      return (result.meta?.changes || 0) > 0;
    },

    async getSteadfastConfig(): Promise<SteadfastConfig> {
      const config = await getConfig();
      return {
        apiKey: env.STEADFAST_API_KEY || config.apiKey || '',
        secretKey: env.STEADFAST_SECRET_KEY || config.secretKey || '',
        baseUrl:
          env.STEADFAST_BASE_URL?.trim() ||
          config.baseUrl?.trim() ||
          'https://portal.packzy.com/api/v1',
      };
    },

    async saveSteadfastConfig(apiKey: string, secretKey: string, baseUrl?: string) {
      const config = await getConfig();
      await saveConfig({
        ...config,
        apiKey,
        secretKey,
        ...(baseUrl ? { baseUrl: baseUrl.trim() } : {}),
      });
    },

    async getOpenRouterConfig(): Promise<OpenRouterConfig> {
      const config = await getConfig();
      return {
        apiKey: env.OPENROUTER_API_KEY || config.openRouterApiKey || '',
        model: env.OPENROUTER_MODEL || config.openRouterModel || 'openai/gpt-4o-mini',
      };
    },

    async saveOpenRouterConfig(apiKey: string, model: string) {
      const config = await getConfig();
      await saveConfig({
        ...config,
        openRouterApiKey: apiKey.trim(),
        openRouterModel: model.trim() || 'openai/gpt-4o-mini',
      });
    },

    async getPathaoConfig(): Promise<PathaoConfig> {
      const config = await getConfig();
      const stored = config.pathao || {};
      return {
        baseUrl: env.PATHAO_BASE_URL?.trim() || stored.baseUrl?.trim() || 'https://api-hermes.pathao.com',
        clientId: env.PATHAO_CLIENT_ID?.trim() || stored.clientId?.trim() || '',
        clientSecret: env.PATHAO_CLIENT_SECRET?.trim() || stored.clientSecret?.trim() || '',
        username: env.PATHAO_USERNAME?.trim() || stored.username?.trim() || '',
        password: env.PATHAO_PASSWORD?.trim() || stored.password?.trim() || '',
      };
    },

    async savePathaoConfig(pathao: PathaoConfig) {
      const config = await getConfig();
      await saveConfig({
        ...config,
        pathao: {
          baseUrl: pathao.baseUrl?.trim() || 'https://api-hermes.pathao.com',
          clientId: pathao.clientId?.trim() || '',
          clientSecret: pathao.clientSecret?.trim() || '',
          username: pathao.username?.trim() || '',
          password: pathao.password?.trim() || '',
        },
      });
    },

    async getRedxConfig(): Promise<RedxConfig> {
      const config = await getConfig();
      const stored = config.redx || {};
      return {
        baseUrl: env.REDX_BASE_URL?.trim() || stored.baseUrl?.trim() || 'https://openapi.redx.com.bd/v1.0.0-beta',
        apiToken: env.REDX_API_TOKEN?.trim() || stored.apiToken?.trim() || '',
      };
    },

    async saveRedxConfig(redx: RedxConfig) {
      const config = await getConfig();
      await saveConfig({
        ...config,
        redx: {
          baseUrl: redx.baseUrl?.trim() || 'https://openapi.redx.com.bd/v1.0.0-beta',
          apiToken: redx.apiToken?.trim() || '',
        },
      });
    },

    async getCarrybeeConfig(): Promise<CarrybeeConfig> {
      const config = await getConfig();
      const stored = config.carrybee || {};
      return {
        baseUrl: env.CARRYBEE_BASE_URL?.trim() || stored.baseUrl?.trim() || 'https://api.carrybee.com',
        apiKey: env.CARRYBEE_API_KEY?.trim() || stored.apiKey?.trim() || '',
        secretKey: env.CARRYBEE_SECRET_KEY?.trim() || stored.secretKey?.trim() || '',
      };
    },

    async saveCarrybeeConfig(carrybee: CarrybeeConfig) {
      const config = await getConfig();
      await saveConfig({
        ...config,
        carrybee: {
          baseUrl: carrybee.baseUrl?.trim() || 'https://api.carrybee.com',
          apiKey: carrybee.apiKey?.trim() || '',
          secretKey: carrybee.secretKey?.trim() || '',
        },
      });
    },

    async getAppSettings(): Promise<BrandingConfig> {
      const config = await getConfig();
      return {
        pageName: config.pageName || 'Rifa Baby Shop',
        pageLogo: config.pageLogo || '',
      };
    },

    async saveAppSettings(pageName: string, pageLogo: string) {
      const config = await getConfig();
      await saveConfig({
        ...config,
        pageName: pageName.trim() || 'Rifa Baby Shop',
        pageLogo: pageLogo ?? config.pageLogo ?? '',
      });
    },

    async getCustomerCategories(): Promise<CustomerCategory[]> {
      const config = await getConfig();
      if (config.customerCategories?.length) {
        return normalizeCategories(config.customerCategories);
      }
      return DEFAULT_CUSTOMER_CATEGORIES.map((c) => ({ ...c }));
    },

    async saveCustomerCategories(categories: CustomerCategory[]): Promise<CustomerCategory[]> {
      const normalized = normalizeCategories(categories);
      const config = await getConfig();
      await saveConfig({
        ...config,
        customerCategories: normalized,
      });
      return normalized;
    },

    async getCounts() {
      const orders = await this.getAllOrders();
      return {
        onHold: orders.filter((o) => o.status === 'ON HOLD').length,
        courierAssign: orders.filter((o) => o.status === 'COURIER ASSIGN').length,
        shipping: orders.filter((o) => o.status === 'SHIPPING').length,
        delivered: orders.filter((o) => o.status === 'DELIVERED').length,
      };
    },

    async getAllCouriersStatus(): Promise<AllCouriersStatus> {
      const steadfast = await this.getSteadfastConfig();
      const pathao = await this.getPathaoConfig();
      const redx = await this.getRedxConfig();
      const carrybee = await this.getCarrybeeConfig();
      return {
        steadfast: {
          isConfigured: Boolean(steadfast.apiKey && steadfast.secretKey),
          apiKeyMasked: steadfast.apiKey
            ? `${steadfast.apiKey.slice(0, 4)}...${steadfast.apiKey.slice(-4)}`
            : null,
          baseUrl: steadfast.baseUrl,
        },
        pathao: {
          isConfigured: Boolean(pathao.clientId && pathao.clientSecret && pathao.username && pathao.password),
          baseUrl: pathao.baseUrl,
          clientIdMasked: pathao.clientId ? `${pathao.clientId.slice(0, 4)}...` : null,
          usernameMasked: pathao.username || null,
        },
        redx: {
          isConfigured: Boolean(redx.apiToken),
          baseUrl: redx.baseUrl,
          tokenMasked: redx.apiToken ? `${redx.apiToken.slice(0, 4)}...${redx.apiToken.slice(-4)}` : null,
        },
        carrybee: {
          isConfigured: Boolean(carrybee.apiKey && carrybee.secretKey),
          baseUrl: carrybee.baseUrl,
          apiKeyMasked: carrybee.apiKey
            ? `${carrybee.apiKey.slice(0, 4)}...${carrybee.apiKey.slice(-4)}`
            : null,
        },
      };
    },

    async exportFullBackup(opts?: { includeSecrets?: boolean }) {
      const orders = await this.getAllOrders();
      const inventory = await this.getAllInventory();
      const config = await getConfig();
      const safeConfig = opts?.includeSecrets
        ? config
        : (redactConfigSecrets(config as Record<string, unknown>) as AppConfig);
      return {
        version: 2,
        app: 'nexorder',
        tenantId: tenantId || null,
        exportedAt: new Date().toISOString(),
        secretsIncluded: !!opts?.includeSecrets,
        counts: {
          orders: orders.length,
          inventory: inventory.length,
        },
        orders,
        inventory,
        config: safeConfig,
      };
    },

    async restoreFullBackup(payload: {
      orders?: any[];
      inventory?: any[];
      config?: AppConfig;
    }) {
      assertTenant();
      if (!tenantId) throw new Error('tenantId required for restore');
      const orders = Array.isArray(payload.orders) ? payload.orders : [];
      const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];
      const config = payload.config && typeof payload.config === 'object' ? payload.config : {};

      // Wipe only this tenant's data — never the whole database
      await d1.prepare('DELETE FROM orders WHERE tenant_id = ?').bind(tenantId).run();
      await d1.prepare('DELETE FROM inventory WHERE tenant_id = ?').bind(tenantId).run();

      // Don't overwrite secrets with redacted placeholders
      const existing = await getConfig();
      const merged = mergeConfigPreservingSecrets(existing, config as AppConfig);
      await saveConfig(merged);

      for (const order of orders) {
        if (!order || !order.id) continue;
        const now = order.updatedAt || order.createdAt || new Date().toISOString();
        await d1
          .prepare(
            `INSERT INTO orders (id, order_id, status, phone, data, created_at, updated_at, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            String(order.id),
            String(order.orderId || order.id),
            String(order.status || 'ON HOLD'),
            String(order.phone || ''),
            JSON.stringify(order),
            String(order.createdAt || now),
            String(now),
            tenantId
          )
          .run();
      }

      for (const item of inventory) {
        if (!item || !item.id) continue;
        const now = item.updatedAt || item.createdAt || new Date().toISOString();
        await d1
          .prepare('INSERT INTO inventory (id, name, data, updated_at, tenant_id) VALUES (?, ?, ?, ?, ?)')
          .bind(String(item.id), String(item.name || 'Product'), JSON.stringify(item), String(now), tenantId)
          .run();
      }

      return {
        success: true,
        restored: {
          orders: orders.length,
          inventory: inventory.length,
          configKeys: Object.keys(merged).length,
        },
      };
    },
  };
}

function looksRedacted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.includes('…') || value.includes('...') || value === '********';
}

function mergeConfigPreservingSecrets(existing: AppConfig, incoming: AppConfig): AppConfig {
  const out: AppConfig = { ...existing, ...incoming };
  const secretKeys = ['apiKey', 'secretKey', 'openRouterApiKey', 'baseUrl'] as const;
  for (const k of secretKeys) {
    if (looksRedacted((incoming as any)[k])) (out as any)[k] = (existing as any)[k];
  }
  if (incoming.pathao) {
    out.pathao = { ...(existing.pathao || {}), ...incoming.pathao };
    if (looksRedacted(incoming.pathao.clientSecret)) out.pathao.clientSecret = existing.pathao?.clientSecret;
    if (looksRedacted(incoming.pathao.password)) out.pathao.password = existing.pathao?.password;
  }
  if (incoming.redx) {
    out.redx = { ...(existing.redx || {}), ...incoming.redx };
    if (looksRedacted(incoming.redx.apiToken)) out.redx.apiToken = existing.redx?.apiToken;
  }
  if (incoming.carrybee) {
    out.carrybee = { ...(existing.carrybee || {}), ...incoming.carrybee };
    if (looksRedacted(incoming.carrybee.apiKey)) out.carrybee.apiKey = existing.carrybee?.apiKey;
    if (looksRedacted(incoming.carrybee.secretKey)) out.carrybee.secretKey = existing.carrybee?.secretKey;
  }
  return out;
}

export type Db = ReturnType<typeof createDb>;
