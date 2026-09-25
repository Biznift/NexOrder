import type { Order, SteadfastCustomerFraudCheckResult } from './types';
import type { Db } from './db';
import type { Env } from './env';

export const OFFICIAL_STEADFAST_BASE_URL = 'https://portal.steadfast.com.bd/api/v1';

export async function getSteadfastBaseUrl(db: Db, env: Env): Promise<string> {
  const envUrl = env.STEADFAST_BASE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const config = await db.getSteadfastConfig();
  if (config.baseUrl?.trim()) return config.baseUrl.trim().replace(/\/+$/, '');
  return OFFICIAL_STEADFAST_BASE_URL;
}

export interface SendSteadfastResult {
  success: boolean;
  parcelId?: string;
  responseRaw?: string;
  error?: string;
}

export interface SteadfastConnectionTestResult {
  success: boolean;
  message: string;
  balance?: number;
  testedUrl?: string;
}

function extractErrorMessage(data: any, defaultMsg: string): string {
  if (!data) return defaultMsg;
  if (typeof data === 'string') return data;
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.errors && typeof data.errors === 'object') {
    const errorList: string[] = [];
    for (const [field, val] of Object.entries(data.errors)) {
      if (Array.isArray(val)) errorList.push(`${field}: ${val.join(', ')}`);
      else if (typeof val === 'string') errorList.push(`${field}: ${val}`);
    }
    if (errorList.length > 0) return errorList.join(' | ');
  }
  return defaultMsg;
}

function formatNetworkError(err: any, baseUrl: string): string {
  if (err.name === 'AbortError') {
    return `Steadfast API request timed out connecting to ${baseUrl}. Please check network connection.`;
  }
  return `Network error connecting to Steadfast API (${baseUrl}): ${err.message || 'Unknown network error'}`;
}

export async function testSteadfastCredentials(
  apiKey: string,
  secretKey: string,
  customBaseUrl?: string,
  db?: Db,
  env?: Env
): Promise<SteadfastConnectionTestResult> {
  const baseUrl = (
    customBaseUrl?.trim() ||
    (db && env ? await getSteadfastBaseUrl(db, env) : OFFICIAL_STEADFAST_BASE_URL)
  ).replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${baseUrl}/get_balance`, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data: any = await res.json().catch(() => null);

    if (res.status === 200 && data && (data.status === 200 || data.current_balance !== undefined)) {
      return {
        success: true,
        message: `Steadfast API connected successfully via ${baseUrl}!`,
        balance: data.current_balance,
        testedUrl: baseUrl,
      };
    }

    return {
      success: false,
      message: extractErrorMessage(data, `Steadfast auth failed (HTTP ${res.status})`),
      testedUrl: baseUrl,
    };
  } catch (err: any) {
    return { success: false, message: formatNetworkError(err, baseUrl), testedUrl: baseUrl };
  }
}

export async function sendOrderToSteadfast(
  order: Order,
  db: Db,
  env: Env
): Promise<SendSteadfastResult> {
  const { apiKey, secretKey } = await db.getSteadfastConfig();
  if (!apiKey || !secretKey) {
    return {
      success: false,
      error: 'Steadfast API Key and Secret Key are not configured. Please add them in Settings.',
    };
  }

  if (order.steadfastParcelId && order.steadfastParcelId.trim() !== '') {
    return {
      success: false,
      error: `Order ${order.orderId} was already submitted to Steadfast with Parcel ID: ${order.steadfastParcelId}. Cannot submit again.`,
      parcelId: order.steadfastParcelId,
    };
  }

  const codAmount = Number(String(order.price).replace(/[^0-9.]/g, '')) || 0;
  let phone = (order.phone || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('8801')) phone = phone.slice(2);
  if (phone.length > 11 && phone.startsWith('88')) phone = phone.replace(/^88/, '');

  if (phone.length !== 11 || !phone.startsWith('01')) {
    return {
      success: false,
      error: `Recipient phone number "${order.phone}" must be an 11-digit Bangladeshi mobile number (e.g. 017XXXXXXXX).`,
    };
  }

  const prodSummary =
    Array.isArray(order.products) && order.products.length > 0
      ? order.products
          .map((p) => `${p.productName} [${p.quantity} pcs${p.color ? `, ${p.color}` : ''}]`)
          .join(', ')
      : `${order.product || 'Items'} (Qty: ${order.quantity || 1}${order.color ? `, ${order.color}` : ''})`;

  const payload = {
    invoice: order.orderId,
    recipient_name: (order.customerName || 'Customer').trim().slice(0, 100),
    recipient_phone: phone,
    recipient_address: (order.address || 'Address pending').trim().slice(0, 250),
    cod_amount: codAmount,
    note: order.note ? `${prodSummary} - ${order.note}`.slice(0, 500) : prodSummary.slice(0, 500),
  };

  const baseUrl = await getSteadfastBaseUrl(db, env);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${baseUrl}/create_order`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data: any = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return {
        success: false,
        error: extractErrorMessage(data, `Steadfast API request failed (HTTP ${res.status})`),
        responseRaw: JSON.stringify(data),
      };
    }

    if (data.status === 200 && data.consignment) {
      const parcelId = String(
        data.consignment.consignment_id || data.consignment.tracking_code || data.consignment.id
      );
      return { success: true, parcelId, responseRaw: JSON.stringify(data) };
    }

    return {
      success: false,
      error: extractErrorMessage(data, 'Steadfast was unable to create the consignment.'),
      responseRaw: JSON.stringify(data),
    };
  } catch (err: any) {
    return { success: false, error: formatNetworkError(err, baseUrl) };
  }
}

export async function fetchSteadfastStatus(
  parcelIdOrTrackingCode: string,
  db: Db,
  env: Env
): Promise<any> {
  const { apiKey, secretKey } = await db.getSteadfastConfig();
  if (!apiKey || !secretKey) {
    return { success: false, error: 'Steadfast credentials not configured' };
  }
  const baseUrl = await getSteadfastBaseUrl(db, env);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${baseUrl}/status_by_cid/${parcelIdOrTrackingCode}`, {
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    return { success: res.ok, data };
  } catch (err: any) {
    return { success: false, error: formatNetworkError(err, baseUrl) };
  }
}

export async function checkSteadfastCustomerHistory(
  rawPhone: string,
  db: Db,
  env: Env
): Promise<SteadfastCustomerFraudCheckResult> {
  let phone = (rawPhone || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('8801')) phone = phone.slice(2);
  if (phone.length > 11 && phone.startsWith('88')) phone = phone.replace(/^88/, '');

  if (phone.length !== 11 || !phone.startsWith('01')) {
    return {
      isAvailable: false,
      isRealData: false,
      phone: rawPhone,
      statusMessage: 'Invalid phone number format',
      source: 'none',
    };
  }

  const { apiKey, secretKey } = await db.getSteadfastConfig();
  const baseUrl = await getSteadfastBaseUrl(db, env);

  if (apiKey && secretKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${baseUrl}/fraud_check/${phone}`, {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data: any = await res.json().catch(() => null);

      if (res.ok && data) {
        const total = Number(data.total_parcels ?? data.total_orders ?? data.parcels ?? data.total);
        const delivered = Number(data.total_delivered ?? data.delivered_parcels ?? data.delivered);
        const cancelled = Number(
          data.total_cancelled ?? data.total_canceled ?? data.cancelled_parcels ?? data.cancelled
        );
        const fraudReports = Number(data.total_fraud_reports ?? data.fraud_reports ?? data.reports ?? 0);

        if (!isNaN(total)) {
          const successRate = total > 0 ? `${Math.round((delivered / total) * 100)}%` : 'N/A';
          let ratingText =
            total === 0
              ? 'New Buyer on Steadfast (0 prior deliveries)'
              : `${successRate} Delivery Success (${delivered}/${total} Delivered)`;
          let warningRemark: string | null = null;
          if (fraudReports > 0) {
            warningRemark = `Caution: ${fraudReports} fraud report(s) found on courier records`;
          } else if (total > 0 && cancelled / total > 0.4) {
            warningRemark = `Notice: Return rate is ${Math.round((cancelled / total) * 100)}% (${cancelled} cancelled)`;
          }

          return {
            isAvailable: true,
            isRealData: true,
            phone,
            rating: ratingText,
            totalParcels: total,
            deliveredParcels: isNaN(delivered) ? null : delivered,
            cancelledParcels: isNaN(cancelled) ? null : cancelled,
            fraudReports: isNaN(fraudReports) ? null : fraudReports,
            successRate,
            warningRemark,
            statusMessage: ratingText,
            source: 'official_api',
          };
        }
      }
    } catch {
      // fall through to merchant DB
    }
  }

  const prior = await db.getOrdersByPhone(phone);
  if (prior.length > 0) {
    const delivered = prior.filter((o) => o.status === 'DELIVERED' || o.status === 'SHIPPING').length;
    return {
      isAvailable: true,
      isRealData: true,
      phone,
      rating: `${prior.length} prior order(s) in shop database`,
      totalParcels: prior.length,
      deliveredParcels: delivered,
      cancelledParcels: null,
      fraudReports: null,
      successRate: null,
      warningRemark: null,
      statusMessage: `${prior.length} prior order(s) found in merchant database`,
      source: 'merchant_database',
    };
  }

  return {
    isAvailable: false,
    isRealData: false,
    phone,
    statusMessage: 'No Steadfast history available',
    source: 'none',
  };
}
