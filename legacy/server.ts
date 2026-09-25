import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './server/db.js';
import { extractOrderFromText } from './server/gemini.js';
import {
  sendOrderToSteadfast,
  testSteadfastCredentials,
  getSteadfastBaseUrl,
  checkSteadfastCustomerHistory,
  fetchSteadfastStatus,
} from './server/steadfast.js';
import {
  getAllCouriersStatus,
  testPathaoCredentials,
  testRedxCredentials,
  testCarrybeeCredentials,
  fetchCourierCustomerRatings,
} from './server/couriers.js';
import { OrderStatus, OrderItem } from './src/types/order.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes

// 1. Dashboard counts
app.get('/api/counts', (_req: Request, res: Response) => {
  res.json(db.getCounts());
});

// 2. Orders list
app.get('/api/orders', (req: Request, res: Response) => {
  const status = req.query.status as OrderStatus | undefined;
  if (status) {
    return res.json(db.getOrdersByStatus(status));
  }
  return res.json(db.getAllOrders());
});

// 3. Search orders
app.get('/api/orders/search', (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  res.json(db.searchOrders(q));
});

// 4. Check previous orders by phone
app.get('/api/orders/check-phone', (req: Request, res: Response) => {
  const phone = (req.query.phone as string) || '';
  const exclude = (req.query.exclude as string) || '';
  const orders = db.getOrdersByPhone(phone, exclude);
  res.json({
    count: orders.length,
    orders: orders.map((o) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      phone: o.phone,
      product: o.product,
      price: o.price,
      confirmDate: o.confirmDate,
      status: o.status,
    })),
  });
});

// 5. Get single order
app.get('/api/orders/:id', (req: Request, res: Response) => {
  const order = db.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// 6. Create / Confirm Order
app.post('/api/orders', (req: Request, res: Response) => {
  const {
    orderId,
    customerName,
    phone,
    address,
    products,
    product,
    quantity,
    color,
    price,
    note,
  } = req.body;

  const now = new Date();
  const confirmDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const confirmTime = now.toLocaleTimeString('en-US', { hour12: true });

  const finalOrderId =
    orderId && orderId.trim()
      ? orderId.trim()
      : `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  // Normalize products
  const productList: OrderItem[] = Array.isArray(products) && products.length > 0
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

  // Save order permanently, set status to ON HOLD
  const order = db.createOrder({
    orderId: finalOrderId,
    customerName: customerName || '',
    phone: phone || '',
    address: address || '',
    products: productList,
    product: product || productList.map(p => `${p.productName} (${p.quantity} pcs)`).join(', '),
    quantity: quantity !== undefined ? quantity : productList.reduce((sum, p) => sum + p.quantity, 0),
    color: color || productList.map(p => p.color).filter(Boolean).join(', '),
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

  res.status(201).json({ order });
});

// 7. Delete Order
app.delete('/api/orders/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const deleted = db.deleteOrder(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Order not found or could not be deleted' });
  }
  res.json({ success: true, message: 'Order permanently deleted' });
});

// 8. AI Process Order Text
app.post('/api/ai/process-order', async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Please provide customer order text' });
  }

  try {
    const extracted = await extractOrderFromText(text);
    res.json(extracted);
  } catch (err: any) {
    console.error('AI process error:', err);
    res.status(500).json({ error: 'Failed to process order with AI' });
  }
});

// 9. Send to Steadfast API
app.post('/api/steadfast/send', async (req: Request, res: Response) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'Order ID is required' });
  }

  const order = db.getOrderById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Prevent duplicate submission
  if (order.steadfastParcelId) {
    return res.status(400).json({
      success: false,
      error: `Order already sent to Steadfast. Parcel ID: ${order.steadfastParcelId}`,
      order,
    });
  }

  // Must be ON HOLD
  if (order.status !== 'ON HOLD') {
    return res.status(400).json({
      success: false,
      error: `Only orders in ON HOLD status can be sent to Steadfast. Current status: ${order.status}`,
    });
  }

  // Call real Steadfast API
  const result = await sendOrderToSteadfast(order);

  if (!result.success || !result.parcelId) {
    // Keep order ON HOLD, show real error
    return res.status(400).json({
      success: false,
      error: result.error || 'Failed to submit to Steadfast API',
      order,
    });
  }

  // Real Steadfast API succeeded
  const updatedOrder = db.updateOrder(order.id, {
    steadfastParcelId: result.parcelId,
    steadfastResponse: result.responseRaw || null,
    steadfastSubmissionDateTime: new Date().toISOString(),
    status: 'COURIER ASSIGN',
  });

  return res.json({
    success: true,
    parcelId: result.parcelId,
    order: updatedOrder,
  });
});

// Helpers: classify Steadfast parcel delivery lifecycle
function isPickupStatus(status: string): boolean {
  const pickupKeywords = [
    'picked_up',
    'picked-up',
    'collected',
    'picked',
    'in_transit',
    'in-transit',
    'transit',
  ];
  return pickupKeywords.some((keyword) => status.includes(keyword));
}

function isTerminalDeliveryStatus(status: string): boolean {
  const terminalKeywords = [
    'delivered',
    'partial_delivered',
    'partial-delivered',
    'completed',
    'returned',
    'cancelled',
    'canceled',
    'unknown',
  ];
  return terminalKeywords.some((keyword) => status.includes(keyword));
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
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.toLowerCase();
  }
  return '';
}

// 10. Steadfast Webhook
app.post('/api/steadfast/webhook', (req: Request, res: Response) => {
  const body = req.body || {};
  console.log('Steadfast webhook received:', JSON.stringify(body));

  // Extract consignment / tracking / invoice identifiers
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

  let order = null;
  if (consignmentId) {
    order = db.getOrderByParcelId(String(consignmentId));
  }
  if (!order && invoice) {
    order = db.getOrderById(String(invoice));
  }

  if (!order) {
    console.warn('Webhook: Order not found for identifier:', { consignmentId, invoice });
    return res.status(200).json({ received: true, matched: false });
  }

  // Steadfast status values: picked_up, collected, in_transit, delivered, returned, cancelled, etc.
  const updates: any = {
    shippingStatus: rawStatus || order.shippingStatus || 'updated',
  };

  if (isTerminalDeliveryStatus(rawStatus)) {
    updates.status = 'DELIVERED';
    console.log(`Order ${order.orderId} moved to DELIVERED via webhook (${rawStatus})`);
  } else if (isPickupStatus(rawStatus) && order.status !== 'DELIVERED') {
    updates.status = 'SHIPPING';
    console.log(`Order ${order.orderId} moved to SHIPPING via webhook!`);
  }

  const updatedOrder = db.updateOrder(order.id, updates);

  res.json({
    received: true,
    matched: true,
    orderId: updatedOrder?.orderId,
    newStatus: updatedOrder?.status,
  });
});

// 11. Simulate/Trigger Webhook for testing
app.post('/api/steadfast/simulate-webhook', (req: Request, res: Response) => {
  const { parcelId, status } = req.body;
  if (!parcelId) {
    return res.status(400).json({ error: 'Parcel ID is required' });
  }

  const order = db.getOrderByParcelId(String(parcelId)) || db.getOrderById(String(parcelId));
  if (!order) {
    return res.status(404).json({ error: 'Order not found with that Parcel ID or Order ID' });
  }

  const normalizedStatus = (status || 'picked_up').toLowerCase();
  const updates: any = {
    shippingStatus: normalizedStatus,
  };

  if (isTerminalDeliveryStatus(normalizedStatus)) {
    updates.status = 'DELIVERED';
  } else if (isPickupStatus(normalizedStatus) && order.status !== 'DELIVERED') {
    updates.status = 'SHIPPING';
  }

  const updated = db.updateOrder(order.id, updates);
  res.json({ success: true, order: updated });
});

// 11b. Get live parcel status from Steadfast (GET /status_by_cid/{id})
app.get('/api/steadfast/status/:parcelId', async (req: Request, res: Response) => {
  const parcelId = req.params.parcelId;
  if (!parcelId) {
    return res.status(400).json({ success: false, error: 'Parcel ID is required' });
  }

  const result = await fetchSteadfastStatus(parcelId);
  if (!result.success) {
    return res.status(result.error ? 502 : 400).json(result);
  }

  const deliveryStatus = extractDeliveryStatusFromSteadfastPayload(result.data);
  res.json({
    success: true,
    parcelId,
    deliveryStatus: deliveryStatus || null,
    data: result.data,
  });
});

// 11c. Sync local order status from Steadfast live API
app.post('/api/steadfast/sync-status/:orderId', async (req: Request, res: Response) => {
  const order =
    db.getOrderById(req.params.orderId) || db.getOrderByParcelId(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const parcelRef = order.steadfastParcelId || order.orderId;
  if (!parcelRef) {
    return res.status(400).json({ success: false, error: 'Order has no Steadfast parcel ID' });
  }

  const result = await fetchSteadfastStatus(String(parcelRef));
  if (!result.success) {
    return res.status(502).json({
      success: false,
      error: result.error || 'Failed to fetch status from Steadfast',
    });
  }

  const deliveryStatus = extractDeliveryStatusFromSteadfastPayload(result.data);
  if (!deliveryStatus) {
    return res.json({
      success: true,
      updated: false,
      order,
      message: 'Steadfast returned no delivery status field',
      data: result.data,
    });
  }

  const updates: any = { shippingStatus: deliveryStatus };
  if (isTerminalDeliveryStatus(deliveryStatus)) {
    updates.status = 'DELIVERED';
  } else if (isPickupStatus(deliveryStatus) && order.status !== 'DELIVERED') {
    updates.status = 'SHIPPING';
  }

  const updated = db.updateOrder(order.id, updates);
  res.json({
    success: true,
    updated: true,
    deliveryStatus,
    order: updated,
    data: result.data,
  });
});

// 12. Steadfast Config Status & Update
app.get('/api/config/steadfast', (_req: Request, res: Response) => {
  const { apiKey, secretKey, baseUrl } = db.getSteadfastConfig();
  const isConfigured = Boolean(apiKey && secretKey);
  const apiKeyMasked = apiKey
    ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
    : null;

  res.json({
    isConfigured,
    apiKeyMasked,
    baseUrl: baseUrl || getSteadfastBaseUrl(),
  });
});

app.post('/api/config/steadfast', (req: Request, res: Response) => {
  const { apiKey, secretKey, baseUrl } = req.body;
  if (!apiKey || !secretKey) {
    return res.status(400).json({ error: 'Both Steadfast API Key and Secret Key are required' });
  }

  db.saveSteadfastConfig(apiKey.trim(), secretKey.trim(), baseUrl?.trim());
  res.json({
    success: true,
    isConfigured: true,
    apiKeyMasked: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
    baseUrl: baseUrl?.trim() || getSteadfastBaseUrl(),
  });
});

// 13. Test Steadfast connection
app.post('/api/config/steadfast/test', async (req: Request, res: Response) => {
  let { apiKey, secretKey, baseUrl } = req.body;
  if (!apiKey || !secretKey) {
    const config = db.getSteadfastConfig();
    apiKey = apiKey || config.apiKey;
    secretKey = secretKey || config.secretKey;
    baseUrl = baseUrl || config.baseUrl;
  }

  if (!apiKey || !secretKey) {
    return res.status(400).json({
      success: false,
      message: 'Steadfast API Key and Secret Key are required to test connection.',
    });
  }

  const result = await testSteadfastCredentials(
    apiKey.trim(),
    secretKey.trim(),
    baseUrl?.trim()
  );
  res.json(result);
});

// 13b. All Couriers Status & Configuration
app.get('/api/couriers/status', (_req: Request, res: Response) => {
  res.json(getAllCouriersStatus());
});

// Pathao config & test
app.post('/api/couriers/pathao', (req: Request, res: Response) => {
  const { baseUrl, clientId, clientSecret, username, password } = req.body;
  db.savePathaoConfig({
    baseUrl: baseUrl?.trim(),
    clientId: clientId?.trim(),
    clientSecret: clientSecret?.trim(),
    username: username?.trim(),
    password: password?.trim(),
  });
  res.json({ success: true, message: 'Pathao settings saved successfully' });
});

app.post('/api/couriers/pathao/test', async (req: Request, res: Response) => {
  const { baseUrl, clientId, clientSecret, username, password } = req.body;
  const result = await testPathaoCredentials(clientId, clientSecret, username, password, baseUrl);
  res.json(result);
});

// RedX config & test
app.post('/api/couriers/redx', (req: Request, res: Response) => {
  const { baseUrl, apiToken } = req.body;
  db.saveRedxConfig({
    baseUrl: baseUrl?.trim(),
    apiToken: apiToken?.trim(),
  });
  res.json({ success: true, message: 'RedX settings saved successfully' });
});

app.post('/api/couriers/redx/test', async (req: Request, res: Response) => {
  const { baseUrl, apiToken } = req.body;
  const result = await testRedxCredentials(apiToken, baseUrl);
  res.json(result);
});

// CarryBee config & test
app.post('/api/couriers/carrybee', (req: Request, res: Response) => {
  const { baseUrl, apiKey, secretKey } = req.body;
  db.saveCarrybeeConfig({
    baseUrl: baseUrl?.trim(),
    apiKey: apiKey?.trim(),
    secretKey: secretKey?.trim(),
  });
  res.json({ success: true, message: 'CarryBee settings saved successfully' });
});

app.post('/api/couriers/carrybee/test', async (req: Request, res: Response) => {
  const { baseUrl, apiKey, secretKey } = req.body;
  const result = await testCarrybeeCredentials(apiKey, secretKey, baseUrl);
  res.json(result);
});

// Steadfast-Only Customer Rating / Fraud Check Lookup
app.get('/api/steadfast/customer-rating', async (req: Request, res: Response) => {
  const phone = (req.query.phone as string) || '';
  const result = await checkSteadfastCustomerHistory(phone);
  res.json(result);
});

// Real Courier Customer Rating / History Lookup
app.get('/api/couriers/customer-rating', async (req: Request, res: Response) => {
  const phone = (req.query.phone as string) || '';
  if (!phone) {
    return res.json([
      { courier: 'STEADFAST', isAvailable: false, statusMessage: 'Rating unavailable (No phone)', isRealData: false },
      { courier: 'PATHAO', isAvailable: false, statusMessage: 'Rating unavailable (No phone)', isRealData: false },
      { courier: 'REDX', isAvailable: false, statusMessage: 'Rating unavailable (No phone)', isRealData: false },
      { courier: 'CARRYBEE', isAvailable: false, statusMessage: 'Rating unavailable (No phone)', isRealData: false },
    ]);
  }
  const ratings = await fetchCourierCustomerRatings(phone);
  res.json(ratings);
});


// 14. Branding settings (Page Logo and Page Name)
app.get('/api/config/branding', (_req: Request, res: Response) => {
  res.json(db.getAppSettings());
});

app.post('/api/config/branding', (req: Request, res: Response) => {
  const { pageName, pageLogo } = req.body;
  const name = typeof pageName === 'string' ? pageName : 'Rifa Baby Shop';
  const logo = typeof pageLogo === 'string' ? pageLogo : '';
  db.saveAppSettings(name, logo);
  res.json({
    success: true,
    pageName: name.trim() || 'Rifa Baby Shop',
    pageLogo: logo,
  });
});

// 15. Inventory Management API
app.get('/api/inventory', (_req: Request, res: Response) => {
  res.json(db.getAllInventory());
});

app.post('/api/inventory', (req: Request, res: Response) => {
  const { name, stock, defaultPrice } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  const newProduct = db.createInventoryProduct({
    name: name.trim(),
    stock: stock !== undefined ? Math.max(0, Number(stock) || 0) : 0,
    defaultPrice: defaultPrice !== undefined && defaultPrice !== '' ? Number(defaultPrice) : undefined,
  });

  res.status(201).json(newProduct);
});

app.put('/api/inventory/:id', (req: Request, res: Response) => {
  const { name, stock, defaultPrice } = req.body;
  const updated = db.updateInventoryProduct(req.params.id, {
    name: typeof name === 'string' ? name : undefined,
    stock: stock !== undefined ? Number(stock) : undefined,
    defaultPrice: defaultPrice !== undefined ? Number(defaultPrice) : undefined,
  });

  if (!updated) {
    return res.status(404).json({ error: 'Inventory product not found' });
  }
  res.json(updated);
});

app.patch('/api/inventory/:id/stock', (req: Request, res: Response) => {
  const { stock, delta } = req.body;
  const current = db.getInventoryById(req.params.id);
  if (!current) {
    return res.status(404).json({ error: 'Inventory product not found' });
  }

  let newStock = current.stock;
  if (stock !== undefined) {
    newStock = Math.max(0, Number(stock) || 0);
  } else if (delta !== undefined) {
    newStock = Math.max(0, current.stock + Number(delta));
  }

  const updated = db.updateInventoryProduct(req.params.id, { stock: newStock });
  res.json(updated);
});

app.delete('/api/inventory/:id', (req: Request, res: Response) => {
  const success = db.deleteInventoryProduct(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Inventory product not found' });
  }
  res.json({ success: true, message: 'Product deleted from inventory' });
});

// 16. OpenRouter Config API
app.get('/api/config/openrouter', (_req: Request, res: Response) => {
  const config = db.getOpenRouterConfig();
  const isConfigured = Boolean(config.apiKey);
  const apiKeyMasked = config.apiKey
    ? `${config.apiKey.slice(0, 6)}...${config.apiKey.slice(-4)}`
    : null;

  res.json({
    isConfigured,
    model: config.model || 'openai/gpt-4o-mini',
    apiKeyMasked,
  });
});

app.post('/api/config/openrouter', (req: Request, res: Response) => {
  const { apiKey, model } = req.body;
  const existing = db.getOpenRouterConfig();
  const nextKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : existing.apiKey;

  if (!nextKey) {
    return res.status(400).json({ error: 'OpenRouter API Key is required' });
  }

  const nextModel = (typeof model === 'string' && model.trim()) || existing.model || 'openai/gpt-4o-mini';
  db.saveOpenRouterConfig(nextKey, nextModel);
  const masked = `${nextKey.slice(0, 6)}...${nextKey.slice(-4)}`;
  res.json({
    success: true,
    isConfigured: true,
    model: nextModel,
    apiKeyMasked: masked,
  });
});

app.post('/api/config/openrouter/test', async (req: Request, res: Response) => {
  let { apiKey, model } = req.body;
  if (!apiKey) {
    const conf = db.getOpenRouterConfig();
    apiKey = conf.apiKey;
    model = model || conf.model;
  }

  if (!apiKey) {
    return res.status(400).json({ success: false, message: 'OpenRouter API Key is required to test' });
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
        'X-Title': 'Order Management App',
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
      return res.json({
        success: true,
        message: `OpenRouter model "${model || 'openai/gpt-4o-mini'}" connected successfully!`,
      });
    }

    const errText = await testRes.text();
    return res.json({
      success: false,
      message: `OpenRouter returned HTTP ${testRes.status}: ${errText.slice(0, 200)}`,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      message: `Network error connecting to OpenRouter: ${err.message}`,
    });
  }
});

// Start server with Vite or static build
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
