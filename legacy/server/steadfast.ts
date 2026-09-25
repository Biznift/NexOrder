import { Order, SteadfastCustomerFraudCheckResult } from '../src/types/order.js';
import { db } from './db.js';

/**
 * Official current Steadfast Courier API base URL according to official API documentation:
 * https://portal.steadfast.com.bd/api/v1
 *
 * If this base URL cannot be resolved in your network environment or your Steadfast merchant
 * account was provisioned on an alternate portal domain (such as https://portal.packzy.com/api/v1),
 * configure the environment variable:
 *   STEADFAST_BASE_URL
 * or change it directly in the App Settings under the Steadfast API tab.
 */
export const OFFICIAL_STEADFAST_BASE_URL = 'https://portal.steadfast.com.bd/api/v1';

export function getSteadfastBaseUrl(): string {
  // 1. Environment variable STEADFAST_BASE_URL has highest precedence
  const envUrl = process.env.STEADFAST_BASE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Saved configuration in database / app settings
  const config = db.getSteadfastConfig();
  if (config.baseUrl?.trim()) {
    return config.baseUrl.trim().replace(/\/+$/, '');
  }

  // 3. Official documentation base URL
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

/**
 * Format error response from Steadfast API into a human-readable message
 */
function extractErrorMessage(data: any, defaultMsg: string): string {
  if (!data) return defaultMsg;
  if (typeof data === 'string') return data;
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.errors && typeof data.errors === 'object') {
    const errorList: string[] = [];
    for (const [field, val] of Object.entries(data.errors)) {
      if (Array.isArray(val)) {
        errorList.push(`${field}: ${val.join(', ')}`);
      } else if (typeof val === 'string') {
        errorList.push(`${field}: ${val}`);
      }
    }
    if (errorList.length > 0) return errorList.join(' | ');
  }
  return defaultMsg;
}

function formatNetworkError(err: any, baseUrl: string): string {
  const isTimeout = err.name === 'AbortError';
  if (isTimeout) {
    return `Steadfast API request timed out connecting to ${baseUrl}. Please check network connection.`;
  }
  const isDnsError =
    err.message?.includes('ENOTFOUND') ||
    (err.cause as any)?.code === 'ENOTFOUND' ||
    err.message?.includes('getaddrinfo');

  if (isDnsError) {
    return `Steadfast API network error: Could not resolve hostname for "${baseUrl}". Please set your account's official Steadfast API URL in the STEADFAST_BASE_URL environment variable or in App Settings (e.g. https://portal.packzy.com/api/v1 if portal.steadfast.com.bd DNS is not reachable).`;
  }
  return `Network error connecting to Steadfast API (${baseUrl}): ${err.message || 'Unknown network error'}`;
}

/**
 * Test credentials against Steadfast API
 */
export async function testSteadfastCredentials(
  apiKey: string,
  secretKey: string,
  customBaseUrl?: string
): Promise<SteadfastConnectionTestResult> {
  const baseUrl = (customBaseUrl?.trim() || getSteadfastBaseUrl()).replace(/\/+$/, '');

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

    const errMsg = extractErrorMessage(
      data,
      res.status === 401
        ? 'Invalid Steadfast API Key or Secret Key.'
        : `Connection test returned HTTP ${res.status}`
    );

    return {
      success: false,
      message: errMsg,
      testedUrl: baseUrl,
    };
  } catch (err: any) {
    console.error('Steadfast test connection error:', err);
    return {
      success: false,
      message: formatNetworkError(err, baseUrl),
      testedUrl: baseUrl,
    };
  }
}

/**
 * Send an order to Steadfast Courier
 */
export async function sendOrderToSteadfast(order: Order): Promise<SendSteadfastResult> {
  const { apiKey, secretKey } = db.getSteadfastConfig();
  if (!apiKey || !secretKey) {
    return {
      success: false,
      error: 'Steadfast API Key and Secret Key are not configured. Please add them in Settings.',
    };
  }

  // Duplicate Submission Protection: check if parcelId already exists
  if (order.steadfastParcelId && order.steadfastParcelId.trim() !== '') {
    return {
      success: false,
      error: `Order ${order.orderId} was already submitted to Steadfast with Parcel ID: ${order.steadfastParcelId}. Cannot submit again.`,
      parcelId: order.steadfastParcelId,
    };
  }

  // Clean numeric cod_amount
  const codAmount = Number(String(order.price).replace(/[^0-9.]/g, '')) || 0;

  // Clean recipient phone - Steadfast requires exactly 11 digits starting with 01
  let phone = (order.phone || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('8801')) {
    phone = phone.slice(2);
  }
  if (phone.length > 11 && phone.startsWith('88')) {
    phone = phone.replace(/^88/, '');
  }

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
    note: order.note
      ? `${prodSummary} - ${order.note}`.slice(0, 500)
      : prodSummary.slice(0, 500),
  };

  const baseUrl = getSteadfastBaseUrl();

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
      const errMsg = extractErrorMessage(
        data,
        `Steadfast API request failed (HTTP ${res.status}: ${res.statusText})`
      );
      return {
        success: false,
        error: errMsg,
        responseRaw: JSON.stringify(data),
      };
    }

    if (data.status === 200 && data.consignment) {
      const parcelId = String(
        data.consignment.consignment_id ||
          data.consignment.tracking_code ||
          data.consignment.id
      );
      return {
        success: true,
        parcelId,
        responseRaw: JSON.stringify(data),
      };
    } else {
      const errMsg = extractErrorMessage(
        data,
        'Steadfast was unable to create the consignment.'
      );
      return {
        success: false,
        error: errMsg,
        responseRaw: JSON.stringify(data),
      };
    }
  } catch (err: any) {
    console.error('Steadfast API network error:', err);
    return {
      success: false,
      error: formatNetworkError(err, baseUrl),
    };
  }
}

export async function fetchSteadfastStatus(parcelIdOrTrackingCode: string): Promise<any> {
  const { apiKey, secretKey } = db.getSteadfastConfig();
  if (!apiKey || !secretKey) {
    return { success: false, error: 'Steadfast credentials not configured' };
  }

  const baseUrl = getSteadfastBaseUrl();

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

/**
 * Check customer Steadfast delivery history & rating via official merchant API (/fraud_check)
 * or real shop database records.
 * NEVER estimates or invents fake ratings.
 */
export async function checkSteadfastCustomerHistory(rawPhone: string): Promise<SteadfastCustomerFraudCheckResult> {
  let phone = (rawPhone || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('8801')) {
    phone = phone.slice(2);
  }
  if (phone.length > 11 && phone.startsWith('88')) {
    phone = phone.replace(/^88/, '');
  }

  if (phone.length !== 11 || !phone.startsWith('01')) {
    return {
      isAvailable: false,
      isRealData: false,
      phone: rawPhone,
      statusMessage: 'Invalid phone number format',
      source: 'none',
    };
  }

  const { apiKey, secretKey } = db.getSteadfastConfig();
  const baseUrl = getSteadfastBaseUrl();

  // 1. Query official Steadfast /fraud_check API if credentials are configured
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
        const cancelled = Number(data.total_cancelled ?? data.total_canceled ?? data.cancelled_parcels ?? data.cancelled);
        const fraudReports = Number(data.total_fraud_reports ?? data.fraud_reports ?? data.reports ?? 0);

        if (!isNaN(total)) {
          const successRate = total > 0 ? `${Math.round((delivered / total) * 100)}%` : 'N/A';
          let ratingText = '';
          if (total === 0) {
            ratingText = 'New Buyer on Steadfast (0 prior deliveries)';
          } else {
            ratingText = `${successRate} Delivery Success (${delivered}/${total} Delivered)`;
          }

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
            statusMessage: 'Official Steadfast Merchant Data',
            source: 'official_api',
          };
        }
      }
    } catch (err) {
      console.warn('Steadfast /fraud_check API lookup warning:', err);
    }
  }

  // 2. Real fallback: check our own database for past Steadfast parcels for this customer
  const pastOrders = db.getAllOrders().filter((o: Order) => {
    const oPhone = (o.phone || '').replace(/[^0-9]/g, '');
    const cleanOPhone = oPhone.startsWith('8801') ? oPhone.slice(2) : oPhone;
    return cleanOPhone === phone && Boolean(o.steadfastParcelId);
  });

  if (pastOrders.length > 0) {
    const total = pastOrders.length;
    const delivered = pastOrders.filter(
      (o: Order) => o.status === 'SHIPPING' || o.shippingStatus === 'delivered'
    ).length;
    const cancelled = pastOrders.filter(
      (o: Order) => o.shippingStatus === 'cancelled' || o.shippingStatus === 'returned'
    ).length;
    const successRate = `${Math.round((delivered / total) * 100)}%`;

    return {
      isAvailable: true,
      isRealData: true,
      phone,
      rating: `${successRate} Success (${delivered}/${total} shop deliveries)`,
      totalParcels: total,
      deliveredParcels: delivered,
      cancelledParcels: cancelled,
      fraudReports: 0,
      successRate,
      warningRemark: cancelled > 0 ? `${cancelled} return/cancellation in shop history` : null,
      statusMessage: 'Real Steadfast Shop Order History',
      source: 'merchant_database',
    };
  }

  // 3. Data is unavailable
  return {
    isAvailable: false,
    isRealData: false,
    phone,
    statusMessage: 'Data unavailable',
    source: 'none',
  };
}
