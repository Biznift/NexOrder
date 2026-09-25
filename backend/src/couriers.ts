import type { Db } from './db';

export async function testPathaoCredentials(
  db: Db,
  clientId?: string,
  clientSecret?: string,
  username?: string,
  password?: string,
  customBaseUrl?: string
): Promise<{ success: boolean; message: string }> {
  const config = await db.getPathaoConfig();
  const cId = clientId?.trim() || config.clientId || '';
  const cSec = clientSecret?.trim() || config.clientSecret || '';
  const uName = username?.trim() || config.username || '';
  const pwd = password?.trim() || config.password || '';
  const baseUrl = (customBaseUrl?.trim() || config.baseUrl || 'https://api-hermes.pathao.com').replace(
    /\/+$/,
    ''
  );

  if (!cId || !cSec || !uName || !pwd) {
    return {
      success: false,
      message: 'Pathao Client ID, Client Secret, Username, and Password are all required.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: cId,
        client_secret: cSec,
        username: uName,
        password: pwd,
        grant_type: 'password',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data: any = await res.json().catch(() => null);
    if (res.ok && data?.access_token) {
      return { success: true, message: `Pathao connected successfully via ${baseUrl}! Token issued.` };
    }
    return {
      success: false,
      message: data?.message || `Pathao auth failed (HTTP ${res.status})`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Pathao network error' };
  }
}

export async function testRedxCredentials(
  db: Db,
  apiToken?: string,
  customBaseUrl?: string
): Promise<{ success: boolean; message: string }> {
  const config = await db.getRedxConfig();
  const token = apiToken?.trim() || config.apiToken || '';
  const baseUrl = (
    customBaseUrl?.trim() ||
    config.baseUrl ||
    'https://openapi.redx.com.bd/v1.0.0-beta'
  ).replace(/\/+$/, '');

  if (!token) {
    return { success: false, message: 'RedX API Token is required.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${baseUrl}/areas`, {
      headers: { 'API-ACCESS-TOKEN': token, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return { success: true, message: `RedX connected successfully via ${baseUrl}!` };
    }
    const errText = await res.text();
    return { success: false, message: `RedX failed (HTTP ${res.status}): ${errText.slice(0, 200)}` };
  } catch (err: any) {
    return { success: false, message: err.message || 'RedX network error' };
  }
}

export async function testCarrybeeCredentials(
  db: Db,
  apiKey?: string,
  secretKey?: string,
  customBaseUrl?: string
): Promise<{ success: boolean; message: string }> {
  const config = await db.getCarrybeeConfig();
  const key = apiKey?.trim() || config.apiKey || '';
  const secret = secretKey?.trim() || config.secretKey || '';
  const baseUrl = (customBaseUrl?.trim() || config.baseUrl || 'https://api.carrybee.com').replace(
    /\/+$/,
    ''
  );

  if (!key || !secret) {
    return { success: false, message: 'CarryBee API Key and Secret Key are required.' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${baseUrl}/api/v1/balance`, {
      headers: {
        'Api-Key': key,
        'Secret-Key': secret,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return { success: true, message: `CarryBee connected successfully via ${baseUrl}!` };
    }
    const errText = await res.text();
    return {
      success: false,
      message: `CarryBee failed (HTTP ${res.status}): ${errText.slice(0, 200)}`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'CarryBee network error' };
  }
}

export async function fetchCourierCustomerRatings(db: Db, env: any, phone: string) {
  const { checkSteadfastCustomerHistory } = await import('./steadfast');
  const steadfast = await checkSteadfastCustomerHistory(phone, db, env);
  return [
    {
      courier: 'STEADFAST' as const,
      isAvailable: steadfast.isAvailable,
      rating: steadfast.rating,
      deliveredCount: steadfast.deliveredParcels,
      returnCount: steadfast.cancelledParcels,
      totalOrders: steadfast.totalParcels,
      successRate: steadfast.successRate,
      warningRemark: steadfast.warningRemark,
      statusMessage: steadfast.statusMessage,
      isRealData: steadfast.isRealData,
    },
  ];
}
