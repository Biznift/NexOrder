import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { createDb } from './db';
import { processCustomerOrderText } from './ai';
import {
  sendOrderToSteadfast,
  testSteadfastCredentials,
  getSteadfastBaseUrl,
  checkSteadfastCustomerHistory,
  fetchSteadfastStatus,
} from './steadfast';
import {
  testPathaoCredentials,
  testRedxCredentials,
  testCarrybeeCredentials,
  fetchCourierCustomerRatings,
} from './couriers';
import type { OrderItem, CustomerSortKey } from './types';
import {
  buildCustomersFromOrders,
  filterAndSortCustomers,
  customersToCsv,
  customersToExcelXml,
  normalizePhoneKey,
} from './customers';
import {
  requireAuth,
  getAuthSecret,
  signToken,
  verifyPassword,
  validatePasswordStrength,
  sanitizeLogoUrl,
  verifyWebhookSecret,
  rowToAuthUser,
  isPlatformAdmin,
  type AppVariables,
} from './auth';
import { createSaasDb, publicUser } from './saas';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function shopDb(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
  return createDb(c.env, { tenantId: c.get('tenantId') });
}

function parseCorsOrigins(env: Env): string[] {
  const raw = env.CORS_ORIGIN?.trim();
  if (raw) {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  if (env.ENVIRONMENT === 'production') return [];
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

app.use('*', async (c, next) => {
  const origins = parseCorsOrigins(c.env);
  return cors({
    origin: origins,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Secret'],
  })(c, next);
});

app.use('*', async (c, next) => {
  const saas = createSaasDb(c.env);
  await saas.ensureSeeded();
  await createDb(c.env, { bypassTenant: true }).adoptLegacyRows('user_pro');
  return next();
});

app.use('*', requireAuth);

app.get('/api/health', (c) => c.json({ ok: true, service: 'nexorder-api' }));

app.post('/api/auth/login', async (c) => {
  try {
    const saas = createSaasDb(c.env);
    await saas.ensureSeeded();
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }
    const row = await saas.getUserByEmail(email);
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }
    if (row.status !== 'active') {
      return c.json({ error: 'Account inactive' }, 401);
    }
    await saas.touchLogin(row.id);
    const user = rowToAuthUser(row);
    const token = await signToken(user, getAuthSecret(c.env));
    return c.json({ token, user: publicUser(row) });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post('/api/auth/signup', async (c) => {
  try {
    const saas = createSaasDb(c.env);
    await saas.ensureSeeded();
    const body = await c.req.json().catch(() => ({}));
    const email = String(body.email || '').trim();
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    if (!email || !name || !password) {
      return c.json({ error: 'Name, email, and password are required' }, 400);
    }
    const strengthError = validatePasswordStrength(password);
    if (strengthError) return c.json({ error: strengthError }, 400);

    const defaultPlan = await saas.getDefaultPlan();
    if (!defaultPlan) {
      return c.json({ error: 'No default plan configured' }, 500);
    }

    const row = await saas.createUser({
      email,
      name,
      password,
      role: 'free',
      planId: defaultPlan.id,
      company: body.company ? String(body.company).trim() : undefined,
      phone: body.phone ? String(body.phone).trim() : undefined,
    });
    const user = rowToAuthUser(row);
    const token = await signToken(user, getAuthSecret(c.env));
    return c.json({ token, user: publicUser(row) }, 201);
  } catch (err) {
    const message = String(err);
    if (message.includes('already exists')) {
      return c.json({ error: message }, 409);
    }
    return c.json({ error: message }, 500);
  }
});

app.get('/api/auth/me', async (c) => {
  const user = c.get('user');
  const tenantId = c.get('tenantId');
  const saas = createSaasDb(c.env);
  const row = await saas.getUserById(user.id);
  if (!row) return c.json({ error: 'User not found' }, 404);
  return c.json({ user: publicUser(row), tenantId });
});

app.patch('/api/auth/me', async (c) => {
  const user = c.get('user');
  const saas = createSaasDb(c.env);
  const body = await c.req.json().catch(() => ({}));
  if (body.password) {
    const pwErr = validatePasswordStrength(String(body.password));
    if (pwErr) return c.json({ error: pwErr }, 400);
  }
  const row = await saas.updateUser(user.id, {
    name: body.name !== undefined ? String(body.name) : undefined,
    company: body.company !== undefined ? (body.company ? String(body.company) : null) : undefined,
    phone: body.phone !== undefined ? (body.phone ? String(body.phone) : null) : undefined,
    password: body.password ? String(body.password) : undefined,
  });
  if (!row) return c.json({ error: 'User not found' }, 404);
  return c.json({ user: publicUser(row) });
});

app.get('/api/counts', async (c) => {
  const db = shopDb(c);
  return c.json(await db.getCounts());
});

app.get('/api/orders', async (c) => {
  const db = shopDb(c);
  const status = c.req.query('status');
  if (status) {
    return c.json(await db.getOrdersByStatus(status as any));
  }
  return c.json(await db.getAllOrders());
});

app.get('/api/orders/search', async (c) => {
  const db = shopDb(c);
  const q = c.req.query('q') || '';
  return c.json(await db.searchOrders(q));
});

app.get('/api/orders/check-phone', async (c) => {
  const db = shopDb(c);
  const phone = c.req.query('phone') || '';
  const exclude = c.req.query('exclude');
  const matches = await db.getOrdersByPhone(phone, exclude || undefined);
  return c.json({
    hasPreviousOrders: matches.length > 0,
    count: matches.length,
    orders: matches.slice(0, 10),
  });
});

app.get('/api/customers', async (c) => {
  const db = shopDb(c);
  const [orders, categories] = await Promise.all([db.getAllOrders(), db.getCustomerCategories()]);
  const customers = buildCustomersFromOrders(orders, categories);
  const filtered = filterAndSortCustomers(customers, {
    q: c.req.query('q') || undefined,
    name: c.req.query('name') || undefined,
    email: c.req.query('email') || undefined,
    phone: c.req.query('phone') || undefined,
    orderId: c.req.query('orderId') || undefined,
    categoryId: c.req.query('categoryId') || undefined,
    sortBy: (c.req.query('sortBy') as CustomerSortKey) || undefined,
    sortDir: (c.req.query('sortDir') as 'asc' | 'desc') || undefined,
  });
  return c.json({ customers: filtered, total: filtered.length, categories });
});

app.get('/api/customers/export', async (c) => {
  const db = shopDb(c);
  const format = (c.req.query('format') || 'csv').toLowerCase();
  const [orders, categories] = await Promise.all([db.getAllOrders(), db.getCustomerCategories()]);
  const customers = filterAndSortCustomers(buildCustomersFromOrders(orders, categories), {
    q: c.req.query('q') || undefined,
    name: c.req.query('name') || undefined,
    email: c.req.query('email') || undefined,
    phone: c.req.query('phone') || undefined,
    orderId: c.req.query('orderId') || undefined,
    categoryId: c.req.query('categoryId') || undefined,
    sortBy: (c.req.query('sortBy') as CustomerSortKey) || undefined,
    sortDir: (c.req.query('sortDir') as 'asc' | 'desc') || undefined,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'xlsx' || format === 'xls' || format === 'excel') {
    const xml = customersToExcelXml(customers);
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="customers-${stamp}.xls"`,
      },
    });
  }

  const csv = '\uFEFF' + customersToCsv(customers);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customers-${stamp}.csv"`,
    },
  });
});

app.get('/api/customers/categories', async (c) => {
  const db = shopDb(c);
  return c.json({ categories: await db.getCustomerCategories() });
});

app.post('/api/customers/categories', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json().catch(() => ({}));
  const categories = await db.saveCustomerCategories(body.categories || body || []);
  return c.json({ categories });
});

app.get('/api/customers/:phoneKey', async (c) => {
  const db = shopDb(c);
  const phoneKey = normalizePhoneKey(c.req.param('phoneKey'));
  if (!phoneKey) return c.json({ error: 'Invalid phone' }, 400);
  const [orders, categories] = await Promise.all([db.getAllOrders(), db.getCustomerCategories()]);
  const customers = buildCustomersFromOrders(orders, categories);
  const customer = customers.find((cu) => cu.phoneKey === phoneKey);
  if (!customer) return c.json({ error: 'Customer not found' }, 404);
  const customerOrders = orders.filter((o) => normalizePhoneKey(o.phone) === phoneKey);
  return c.json({ customer, orders: customerOrders });
});

app.get('/api/orders/:id', async (c) => {
  const db = shopDb(c);
  const order = await db.getOrderById(c.req.param('id'));
  if (!order) return c.json({ error: 'Order not found' }, 404);
  return c.json(order);
});

app.post('/api/orders', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json();
  const {
    orderId,
    customerName,
    phone,
    email,
    address,
    products,
    product,
    quantity,
    color,
    price,
    note,
    confirmDate,
    confirmTime,
  } = body;

  const finalOrderId = orderId || `ORD-${Date.now().toString(36).toUpperCase()}`;
  const productList: OrderItem[] =
    Array.isArray(products) && products.length > 0
      ? products.map((p: any) => ({
          productName: String(p.productName || p.product || '').trim(),
          quantity: Math.max(1, Number(p.quantity) || 1),
          color: String(p.color || '').trim(),
          price: Math.max(0, Number(p.price) || 0),
        }))
      : [
          {
            productName: product || 'Product',
            quantity: Math.max(1, Number(quantity) || 1),
            color: color || '',
            price: Math.max(0, Number(price) || 0),
          },
        ];

  const order = await db.createOrder({
    orderId: finalOrderId,
    customerName: customerName || '',
    phone: phone || '',
    email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
    address: address || '',
    products: productList,
    product:
      product || productList.map((p) => `${p.productName} (${p.quantity} pcs)`).join(', '),
    quantity:
      quantity !== undefined ? quantity : productList.reduce((sum, p) => sum + p.quantity, 0),
    color: color || productList.map((p) => p.color).filter(Boolean).join(', '),
    price: price !== undefined ? price : productList.reduce((sum, p) => sum + p.price, 0),
    note: note || '',
    confirmDate,
    confirmTime,
    status: 'ON HOLD',
    steadfastParcelId: null,
    steadfastResponse: null,
    steadfastSubmissionDateTime: null,
    shippingStatus: null,
  });

  return c.json({ order }, 201);
});

app.delete('/api/orders/:id', async (c) => {
  const db = shopDb(c);
  const ok = await db.deleteOrder(c.req.param('id'));
  if (!ok) return c.json({ error: 'Order not found' }, 404);
  return c.json({ success: true, message: 'Order deleted' });
});

app.post('/api/ai/process-order', async (c) => {
  const db = shopDb(c);
  const { text } = await c.req.json();
  if (!text || typeof text !== 'string') {
    return c.json({ error: 'text is required' }, 400);
  }
  const extracted = await processCustomerOrderText(text, db, c.env);
  return c.json(extracted);
});

app.post('/api/steadfast/send', async (c) => {
  const db = shopDb(c);
  const { orderId } = await c.req.json();
  const order = await db.getOrderById(orderId);
  if (!order) return c.json({ error: 'Order not found' }, 404);
  if (order.status !== 'ON HOLD') {
    return c.json(
      {
        error: `Only orders in ON HOLD status can be sent to Steadfast. Current status: ${order.status}`,
      },
      400
    );
  }

  const result = await sendOrderToSteadfast(order, db, c.env);
  if (!result.success) {
    return c.json({ success: false, error: result.error, responseRaw: result.responseRaw }, 400);
  }

  const updatedOrder = await db.updateOrder(order.id, {
    status: 'COURIER ASSIGN',
    steadfastParcelId: result.parcelId || null,
    steadfastResponse: result.responseRaw || null,
    steadfastSubmissionDateTime: new Date().toISOString(),
  });

  return c.json({ success: true, parcelId: result.parcelId, order: updatedOrder });
});

function isPickupStatus(status: string): boolean {
  return ['picked_up', 'picked-up', 'collected', 'picked', 'in_transit', 'in-transit', 'transit'].some(
    (k) => status.includes(k)
  );
}

function isTerminalDeliveryStatus(status: string): boolean {
  return [
    'delivered',
    'partial_delivered',
    'partial-delivered',
    'completed',
    'returned',
    'cancelled',
    'canceled',
    'unknown',
  ].some((k) => status.includes(k));
}

function extractDeliveryStatusFromSteadfastPayload(data: any): string {
  if (!data) return '';
  const candidates = [
    data?.delivery_status,
    data?.status,
    data?.consignment?.delivery_status,
    data?.consignment?.status,
    data?.data?.delivery_status,
    data?.data?.status,
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) return val.toLowerCase();
  }
  return '';
}

app.post('/api/steadfast/webhook', async (c) => {
  if (!(await verifyWebhookSecret(c))) {
    return c.json({ error: 'Unauthorized webhook' }, 401);
  }
  const db = createDb(c.env, { bypassTenant: true });
  const body = await c.req.json().catch(() => ({}));
  const consignmentId =
    body.consignment_id ||
    body.consignmentId ||
    body.tracking_code ||
    body.parcel_id ||
    body?.data?.consignment_id ||
    body?.consignment?.consignment_id;
  const invoice = body.invoice || body.order_id || body?.data?.invoice;
  const rawStatus = (
    body.status ||
    body.delivery_status ||
    body?.data?.status ||
    body?.data?.delivery_status ||
    body.notification_type ||
    ''
  ).toLowerCase();

  let order = consignmentId ? await db.getOrderByParcelId(String(consignmentId)) : undefined;
  if (!order && invoice) order = await db.getOrderById(String(invoice));
  if (!order) return c.json({ received: true, matched: false });

  const updates: any = { shippingStatus: rawStatus || order.shippingStatus || 'updated' };
  if (isTerminalDeliveryStatus(rawStatus)) updates.status = 'DELIVERED';
  else if (isPickupStatus(rawStatus) && order.status !== 'DELIVERED') updates.status = 'SHIPPING';

  const updatedOrder = await db.updateOrder(order.id, updates);
  return c.json({
    received: true,
    matched: true,
    orderId: updatedOrder?.orderId,
    newStatus: updatedOrder?.status,
  });
});

app.post('/api/steadfast/simulate-webhook', async (c) => {
  const allowed =
    c.env.ALLOW_SIMULATE_WEBHOOK === 'true' || c.env.ENVIRONMENT !== 'production';
  if (!allowed) {
    return c.json({ error: 'Simulate webhook is disabled' }, 403);
  }
  const db = shopDb(c);
  const { parcelId, status } = await c.req.json();
  if (!parcelId) return c.json({ error: 'Parcel ID is required' }, 400);
  const order =
    (await db.getOrderByParcelId(String(parcelId))) || (await db.getOrderById(String(parcelId)));
  if (!order) return c.json({ error: 'Order not found with that Parcel ID or Order ID' }, 404);

  const normalizedStatus = (status || 'picked_up').toLowerCase();
  const updates: any = { shippingStatus: normalizedStatus };
  if (isTerminalDeliveryStatus(normalizedStatus)) updates.status = 'DELIVERED';
  else if (isPickupStatus(normalizedStatus) && order.status !== 'DELIVERED') updates.status = 'SHIPPING';

  const updated = await db.updateOrder(order.id, updates);
  return c.json({ success: true, order: updated });
});

app.get('/api/steadfast/status/:parcelId', async (c) => {
  const db = shopDb(c);
  const result = await fetchSteadfastStatus(c.req.param('parcelId'), db, c.env);
  if (!result.success) return c.json(result, 502);
  const deliveryStatus = extractDeliveryStatusFromSteadfastPayload(result.data);
  return c.json({
    success: true,
    parcelId: c.req.param('parcelId'),
    deliveryStatus: deliveryStatus || null,
    data: result.data,
  });
});

app.post('/api/steadfast/sync-status/:orderId', async (c) => {
  const db = shopDb(c);
  const order =
    (await db.getOrderById(c.req.param('orderId'))) ||
    (await db.getOrderByParcelId(c.req.param('orderId')));
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);
  const parcelRef = order.steadfastParcelId || order.orderId;
  const result = await fetchSteadfastStatus(String(parcelRef), db, c.env);
  if (!result.success) {
    return c.json({ success: false, error: result.error || 'Failed to fetch status' }, 502);
  }
  const deliveryStatus = extractDeliveryStatusFromSteadfastPayload(result.data);
  if (!deliveryStatus) {
    return c.json({
      success: true,
      updated: false,
      order,
      message: 'Steadfast returned no delivery status field',
      data: result.data,
    });
  }
  const updates: any = { shippingStatus: deliveryStatus };
  if (isTerminalDeliveryStatus(deliveryStatus)) updates.status = 'DELIVERED';
  else if (isPickupStatus(deliveryStatus) && order.status !== 'DELIVERED') updates.status = 'SHIPPING';
  const updated = await db.updateOrder(order.id, updates);
  return c.json({ success: true, updated: true, deliveryStatus, order: updated, data: result.data });
});

app.get('/api/config/steadfast', async (c) => {
  const db = shopDb(c);
  const { apiKey, secretKey, baseUrl } = await db.getSteadfastConfig();
  return c.json({
    isConfigured: Boolean(apiKey && secretKey),
    apiKeyMasked: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
    baseUrl: baseUrl || (await getSteadfastBaseUrl(db, c.env)),
  });
});

app.post('/api/config/steadfast', async (c) => {
  const db = shopDb(c);
  const { apiKey, secretKey, baseUrl } = await c.req.json();
  if (!apiKey || !secretKey) {
    return c.json({ error: 'Both Steadfast API Key and Secret Key are required' }, 400);
  }
  await db.saveSteadfastConfig(apiKey.trim(), secretKey.trim(), baseUrl?.trim());
  return c.json({
    success: true,
    isConfigured: true,
    apiKeyMasked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
    baseUrl: baseUrl?.trim() || (await getSteadfastBaseUrl(db, c.env)),
  });
});

app.post('/api/config/steadfast/test', async (c) => {
  const db = shopDb(c);
  let { apiKey, secretKey, baseUrl } = await c.req.json();
  if (!apiKey || !secretKey) {
    const config = await db.getSteadfastConfig();
    apiKey = apiKey || config.apiKey;
    secretKey = secretKey || config.secretKey;
    baseUrl = baseUrl || config.baseUrl;
  }
  if (!apiKey || !secretKey) {
    return c.json({
      success: false,
      message: 'Steadfast API Key and Secret Key are required to test connection.',
    });
  }
  const result = await testSteadfastCredentials(apiKey.trim(), secretKey.trim(), baseUrl?.trim(), db, c.env);
  return c.json(result);
});

app.get('/api/couriers/status', async (c) => {
  const db = shopDb(c);
  return c.json(await db.getAllCouriersStatus());
});

app.post('/api/couriers/pathao', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json();
  await db.savePathaoConfig({
    baseUrl: body.baseUrl?.trim(),
    clientId: body.clientId?.trim(),
    clientSecret: body.clientSecret?.trim(),
    username: body.username?.trim(),
    password: body.password?.trim(),
  });
  return c.json({ success: true, message: 'Pathao settings saved successfully' });
});

app.post('/api/couriers/pathao/test', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json();
  const result = await testPathaoCredentials(
    db,
    body.clientId,
    body.clientSecret,
    body.username,
    body.password,
    body.baseUrl
  );
  return c.json(result);
});

app.post('/api/couriers/redx', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json();
  await db.saveRedxConfig({ baseUrl: body.baseUrl?.trim(), apiToken: body.apiToken?.trim() });
  return c.json({ success: true, message: 'RedX settings saved successfully' });
});

app.post('/api/couriers/redx/test', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json();
  return c.json(await testRedxCredentials(db, body.apiToken, body.baseUrl));
});

app.post('/api/couriers/carrybee', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json();
  await db.saveCarrybeeConfig({
    baseUrl: body.baseUrl?.trim(),
    apiKey: body.apiKey?.trim(),
    secretKey: body.secretKey?.trim(),
  });
  return c.json({ success: true, message: 'CarryBee settings saved successfully' });
});

app.post('/api/couriers/carrybee/test', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json();
  return c.json(await testCarrybeeCredentials(db, body.apiKey, body.secretKey, body.baseUrl));
});

app.get('/api/steadfast/customer-rating', async (c) => {
  const db = shopDb(c);
  const phone = c.req.query('phone') || '';
  return c.json(await checkSteadfastCustomerHistory(phone, db, c.env));
});

app.get('/api/couriers/customer-rating', async (c) => {
  const db = shopDb(c);
  const phone = c.req.query('phone') || '';
  return c.json(await fetchCourierCustomerRatings(db, c.env, phone));
});

app.get('/api/config/branding', async (c) => {
  let user: AppVariables['user'] | undefined;
  try {
    user = c.get('user');
  } catch {
    user = undefined;
  }
  const db = user
    ? shopDb(c)
    : createDb(c.env, { tenantId: null, bypassTenant: true });
  return c.json(await db.getAppSettings());
});

app.post('/api/config/branding', async (c) => {
  const db = shopDb(c);
  const { pageName, pageLogo } = await c.req.json();
  await db.saveAppSettings(pageName || 'Rifa Baby Shop', sanitizeLogoUrl(pageLogo || ''));
  return c.json(await db.getAppSettings());
});

app.get('/api/inventory', async (c) => {
  const db = shopDb(c);
  return c.json(await db.getAllInventory());
});

app.post('/api/inventory', async (c) => {
  const db = shopDb(c);
  const { name, stock, defaultPrice } = await c.req.json();
  if (!name || typeof name !== 'string' || !name.trim()) {
    return c.json({ error: 'Product name is required' }, 400);
  }
  const product = await db.createInventoryProduct({
    name: name.trim(),
    stock: stock !== undefined ? Math.max(0, Number(stock) || 0) : 0,
    defaultPrice: defaultPrice !== undefined && defaultPrice !== '' ? Number(defaultPrice) : undefined,
  });
  return c.json(product, 201);
});

app.put('/api/inventory/:id', async (c) => {
  const db = shopDb(c);
  const { name, stock, defaultPrice } = await c.req.json();
  const updated = await db.updateInventoryProduct(c.req.param('id'), {
    name: typeof name === 'string' ? name : undefined,
    stock: stock !== undefined ? Number(stock) : undefined,
    defaultPrice: defaultPrice !== undefined ? Number(defaultPrice) : undefined,
  });
  if (!updated) return c.json({ error: 'Inventory product not found' }, 404);
  return c.json(updated);
});

app.patch('/api/inventory/:id/stock', async (c) => {
  const db = shopDb(c);
  const { stock, delta } = await c.req.json();
  const current = await db.getInventoryById(c.req.param('id'));
  if (!current) return c.json({ error: 'Inventory product not found' }, 404);
  let newStock = current.stock || 0;
  if (stock !== undefined) newStock = Math.max(0, Number(stock) || 0);
  else if (delta !== undefined) newStock = Math.max(0, (current.stock || 0) + Number(delta));
  const updated = await db.updateInventoryProduct(c.req.param('id'), { stock: newStock });
  return c.json(updated);
});

app.delete('/api/inventory/:id', async (c) => {
  const db = shopDb(c);
  const ok = await db.deleteInventoryProduct(c.req.param('id'));
  if (!ok) return c.json({ error: 'Product not found' }, 404);
  return c.json({ success: true, message: 'Product deleted from inventory' });
});

app.get('/api/config/openrouter', async (c) => {
  const db = shopDb(c);
  const config = await db.getOpenRouterConfig();
  return c.json({
    isConfigured: Boolean(config.apiKey),
    model: config.model || 'openai/gpt-4o-mini',
    apiKeyMasked: config.apiKey
      ? `${config.apiKey.slice(0, 6)}...${config.apiKey.slice(-4)}`
      : null,
  });
});

app.post('/api/config/openrouter', async (c) => {
  const db = shopDb(c);
  const { apiKey, model } = await c.req.json();
  const existing = await db.getOpenRouterConfig();
  const nextKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : existing.apiKey;
  if (!nextKey) return c.json({ error: 'OpenRouter API Key is required' }, 400);
  const nextModel =
    (typeof model === 'string' && model.trim()) || existing.model || 'openai/gpt-4o-mini';
  await db.saveOpenRouterConfig(nextKey, nextModel);
  return c.json({
    success: true,
    isConfigured: true,
    model: nextModel,
    apiKeyMasked: `${nextKey.slice(0, 6)}...${nextKey.slice(-4)}`,
  });
});

app.post('/api/config/openrouter/test', async (c) => {
  const db = shopDb(c);
  let { apiKey, model } = await c.req.json();
  if (!apiKey) {
    const conf = await db.getOpenRouterConfig();
    apiKey = conf.apiKey;
    model = model || conf.model;
  }
  if (!apiKey) {
    return c.json({ success: false, message: 'OpenRouter API Key is required to test' }, 400);
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const testRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aistudio.google.com',
        'X-Title': 'NexOrder',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with standard test OK.' }],
        max_tokens: 10,
      }),
    });
    clearTimeout(timeout);
    if (testRes.ok) {
      return c.json({
        success: true,
        message: `OpenRouter model "${model || 'openai/gpt-4o-mini'}" connected successfully!`,
      });
    }
    const errText = await testRes.text();
    return c.json({
      success: false,
      message: `OpenRouter returned HTTP ${testRes.status}: ${errText.slice(0, 200)}`,
    });
  } catch (err: any) {
    return c.json({
      success: false,
      message: `Network error connecting to OpenRouter: ${err.message}`,
    });
  }
});

// ---- Full database backup / restore ----
app.get('/api/backup', async (c) => {
  const db = shopDb(c);
  const user = c.get('user');
  const includeSecrets = c.req.query('secrets') === '1' && isPlatformAdmin(user);
  const backup = await db.exportFullBackup({ includeSecrets });
  return c.json(backup);
});

app.post('/api/backup/restore', async (c) => {
  const db = shopDb(c);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid backup file' }, 400);
  }

  // Accept both new format and legacy-ish { orders, inventory, config }
  const orders = body.orders;
  const inventory = body.inventory;
  const config = body.config;

  if (!Array.isArray(orders) && !Array.isArray(inventory) && !config) {
    return c.json(
      {
        error:
          'Backup must include at least one of: orders[], inventory[], or config{}',
      },
      400
    );
  }

  const result = await db.restoreFullBackup({
    orders: Array.isArray(orders) ? orders : [],
    inventory: Array.isArray(inventory) ? inventory : [],
    config: config && typeof config === 'object' ? config : {},
  });

  return c.json({
    ...result,
    message: 'Full database restored successfully',
  });
});

// --- SaaS control plane ---
app.get('/api/saas/status', async (c) => {
  try {
    const saas = createSaasDb(c.env);
    const [users, plans] = await Promise.all([saas.countUsers(), saas.countPlans()]);
    return c.json({
      ok: true,
      authMode: 'jwt',
      message: 'SaaS tables are ready. Authentication uses JWT.',
      users,
      plans,
    });
  } catch (err) {
    return c.json({
      ok: false,
      authMode: 'jwt',
      message: 'Run D1 migrations (0002_saas) to enable SaaS tables.',
      error: String(err),
    });
  }
});

app.get('/api/saas/plans', async (c) => {
  try {
    const saas = createSaasDb(c.env);
    const rows = await saas.listPlans();
    return c.json({
      source: 'd1',
      plans: rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        priceMonthly: p.price_monthly,
        priceYearly: p.price_yearly,
        currency: p.currency,
        features: JSON.parse(p.features),
        isActive: !!p.is_active,
        isDefault: !!p.is_default,
        sortOrder: p.sort_order,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch {
    return c.json({ source: 'unavailable', plans: [], message: 'Apply migration 0002_saas' });
  }
});

app.get('/api/saas/users', async (c) => {
  try {
    const saas = createSaasDb(c.env);
    const user = c.get('user');
    const tenantId = c.get('tenantId');
    const rows = isPlatformAdmin(user)
      ? await saas.listUsers()
      : await saas.listUsersForTenant(tenantId);
    return c.json({
      source: 'd1',
      users: rows.map((u) => publicUser(u)),
    });
  } catch {
    return c.json({ source: 'unavailable', users: [], message: 'Apply migration 0002_saas' });
  }
});

app.post('/api/saas/users', async (c) => {
  const actor = c.get('user');
  if (!isPlatformAdmin(actor)) return c.json({ error: 'Insufficient permissions' }, 403);
  const saas = createSaasDb(c.env);
  const body = await c.req.json().catch(() => ({}));
  const password = String(body.password || '');
  const strengthError = validatePasswordStrength(password);
  if (strengthError) return c.json({ error: strengthError }, 400);
  try {
    const row = await saas.createUser({
      email: String(body.email || ''),
      name: String(body.name || ''),
      password,
      role: body.role || 'free',
      planId: String(body.planId || ''),
      company: body.company,
      phone: body.phone,
      notes: body.notes,
      status: body.status || 'active',
    });
    await saas.writeAudit(actor.id, actor.name, `Created user (${row.role})`, row.email);
    return c.json({ user: publicUser(row) }, 201);
  } catch (err) {
    return c.json({ error: String(err) }, 400);
  }
});

app.patch('/api/saas/users/:id', async (c) => {
  const actor = c.get('user');
  if (!isPlatformAdmin(actor)) return c.json({ error: 'Insufficient permissions' }, 403);
  const saas = createSaasDb(c.env);
  const body = await c.req.json().catch(() => ({}));
  if (body.password) {
    const strengthError = validatePasswordStrength(String(body.password));
    if (strengthError) return c.json({ error: strengthError }, 400);
  }
  const row = await saas.updateUser(c.req.param('id'), {
    name: body.name,
    role: body.role,
    planId: body.planId,
    status: body.status,
    company: body.company,
    phone: body.phone,
    notes: body.notes,
    password: body.password,
  });
  if (!row) return c.json({ error: 'User not found' }, 404);
  return c.json({ user: publicUser(row) });
});

app.delete('/api/saas/users/:id', async (c) => {
  const actor = c.get('user');
  if (!isPlatformAdmin(actor)) return c.json({ error: 'Insufficient permissions' }, 403);
  if (actor.id === c.req.param('id')) {
    return c.json({ error: 'Cannot delete your own account while signed in' }, 400);
  }
  const saas = createSaasDb(c.env);
  const ok = await saas.deleteUser(c.req.param('id'));
  if (!ok) return c.json({ error: 'User not found' }, 404);
  return c.json({ success: true });
});

app.post('/api/saas/team-members', async (c) => {
  const actor = c.get('user');
  const tenantId = c.get('tenantId');
  const canManage =
    isPlatformAdmin(actor) ||
    actor.role !== 'team_member' ||
    !!actor.permissions?.manageTeam;
  if (!canManage) return c.json({ error: 'Insufficient permissions' }, 403);

  const saas = createSaasDb(c.env);
  const body = await c.req.json().catch(() => ({}));
  const password = String(body.password || '');
  const pwErr = validatePasswordStrength(password);
  if (pwErr) return c.json({ error: pwErr }, 400);

  const ownerId = isPlatformAdmin(actor) && body.ownerId ? String(body.ownerId) : tenantId;
  try {
    const row = await saas.createUser({
      email: String(body.email || ''),
      name: String(body.name || ''),
      password,
      role: 'team_member',
      planId: String(body.planId || actor.planId),
      company: body.company || actor.company || undefined,
      ownerId,
      permissions: body.permissions || null,
      status: body.status || 'active',
    });
    await saas.writeAudit(actor.id, actor.name, 'Added team member', row.email);
    return c.json({ user: publicUser(row), temporaryPassword: password }, 201);
  } catch (err) {
    return c.json({ error: String(err) }, 400);
  }
});

app.patch('/api/saas/team-members/:id', async (c) => {
  const actor = c.get('user');
  const tenantId = c.get('tenantId');
  const canManage =
    isPlatformAdmin(actor) ||
    actor.role !== 'team_member' ||
    !!actor.permissions?.manageTeam;
  if (!canManage) return c.json({ error: 'Insufficient permissions' }, 403);

  const saas = createSaasDb(c.env);
  const existing = await saas.getUserById(c.req.param('id'));
  if (!existing || existing.role !== 'team_member') {
    return c.json({ error: 'Team member not found' }, 404);
  }
  if (!isPlatformAdmin(actor) && existing.owner_id !== tenantId) {
    return c.json({ error: 'You can only edit members on your own team' }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  if (body.password) {
    const pwErr = validatePasswordStrength(String(body.password));
    if (pwErr) return c.json({ error: pwErr }, 400);
  }
  const row = await saas.updateUser(existing.id, {
    name: body.name,
    status: body.status,
    phone: body.phone,
    notes: body.notes,
    permissions: body.permissions,
    password: body.password,
  });
  return c.json({
    user: publicUser(row!),
    temporaryPassword: body.password || undefined,
  });
});

app.delete('/api/saas/team-members/:id', async (c) => {
  const actor = c.get('user');
  const tenantId = c.get('tenantId');
  const canManage =
    isPlatformAdmin(actor) ||
    actor.role !== 'team_member' ||
    !!actor.permissions?.manageTeam;
  if (!canManage) return c.json({ error: 'Insufficient permissions' }, 403);
  if (actor.id === c.req.param('id')) {
    return c.json({ error: 'Cannot delete your own login while signed in' }, 400);
  }
  const saas = createSaasDb(c.env);
  const existing = await saas.getUserById(c.req.param('id'));
  if (!existing || existing.role !== 'team_member') {
    return c.json({ error: 'Team member not found' }, 404);
  }
  if (!isPlatformAdmin(actor) && existing.owner_id !== tenantId) {
    return c.json({ error: 'You can only remove members from your own team' }, 403);
  }
  await saas.deleteUser(existing.id);
  await saas.writeAudit(actor.id, actor.name, 'Removed team member', existing.email);
  return c.json({ success: true });
});

export default app;
