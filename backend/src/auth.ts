import type { Context, Next } from 'hono';
import type { Env } from './env';
import type { SaasRole, SaasStatus, SaasUserRow } from './saas';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: SaasRole | 'team_member';
  planId: string;
  status: SaasStatus;
  ownerId: string | null;
  permissions: Record<string, boolean> | null;
  company: string | null;
};

export type AppVariables = {
  user: AuthUser;
  tenantId: string;
};

const PBKDF2_ITERATIONS = 100_000;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(bits)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !stored.startsWith('pbkdf2$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  const salt = b64urlDecode(parts[2]!);
  const expected = b64urlDecode(parts[3]!);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

export function resolveTenantId(user: AuthUser): string {
  if (user.role === 'team_member' && user.ownerId) return user.ownerId;
  return user.id;
}

export function isPlatformAdmin(user: AuthUser): boolean {
  return user.role === 'super_admin' || user.role === 'admin';
}

export function rowToAuthUser(row: SaasUserRow): AuthUser {
  let permissions: Record<string, boolean> | null = null;
  if (row.permissions) {
    try {
      permissions = JSON.parse(row.permissions);
    } catch {
      permissions = null;
    }
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    planId: row.plan_id,
    status: row.status,
    ownerId: row.owner_id,
    permissions,
    company: row.company,
  };
}

export async function signToken(user: AuthUser, secret: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        role: user.role,
        tid: resolveTenantId(user),
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
      })
    )
  );
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<{ sub: string; email: string; role: string; tid: string; exp: number } | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];
  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(sig),
    new TextEncoder().encode(`${header}.${payload}`)
  );
  if (!ok) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (!data?.sub || !data?.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function getAuthSecret(env: Env): string {
  const secret = env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  // Local-dev fallback only — production must set AUTH_SECRET
  if (env.ENVIRONMENT === 'production') {
    throw new Error('AUTH_SECRET must be set (min 16 chars) in production');
  }
  return 'dev-only-auth-secret-change-me';
}

export function publicAuthPaths(path: string, method: string): boolean {
  if (path === '/api/health') return true;
  if (path === '/api/auth/login' && method === 'POST') return true;
  if (path === '/api/auth/signup' && method === 'POST') return true;
  if (path === '/api/steadfast/webhook' && method === 'POST') return true;
  if (path === '/api/config/branding' && method === 'GET') return true;
  return false;
}

export async function requireAuth(c: Context<{ Bindings: Env; Variables: AppVariables }>, next: Next) {
  const path = new URL(c.req.url).pathname;
  const method = c.req.method.toUpperCase();
  if (method === 'OPTIONS') return next();
  if (publicAuthPaths(path, method)) return next();

  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return c.json({ error: 'Authentication required' }, 401);

  let secret: string;
  try {
    secret = getAuthSecret(c.env);
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }

  const claims = await verifyToken(token, secret);
  if (!claims) return c.json({ error: 'Invalid or expired token' }, 401);

  const { createSaasDb } = await import('./saas');
  const saas = createSaasDb(c.env);
  const row = await saas.getUserById(claims.sub);
  if (!row || row.status !== 'active') return c.json({ error: 'Account inactive or not found' }, 401);

  const user = rowToAuthUser(row);
  c.set('user', user);
  c.set('tenantId', resolveTenantId(user));
  return next();
}

export function requireRoles(...roles: Array<SaasRole | 'team_member'>) {
  return async (c: Context<{ Bindings: Env; Variables: AppVariables }>, next: Next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    return next();
  };
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i]! ^ bb[i]!;
  return diff === 0;
}

export async function verifyWebhookSecret(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): Promise<boolean> {
  const expected = c.env.STEADFAST_WEBHOOK_SECRET?.trim();
  if (!expected) {
    // Reject unverified webhooks when secret is not configured in production
    if (c.env.ENVIRONMENT === 'production') return false;
    // Dev: allow only if explicitly opted in
    return c.env.ALLOW_INSECURE_WEBHOOK === 'true';
  }
  const provided =
    c.req.header('X-Webhook-Secret') ||
    c.req.header('X-Steadfast-Secret') ||
    c.req.query('secret') ||
    '';
  return timingSafeEqualString(provided, expected);
}

export function sanitizeLogoUrl(url: string): string {
  const v = (url || '').trim();
  if (!v) return '';
  if (v.startsWith('data:image/')) {
    // Cap data-URL size (~200KB) to limit abuse
    if (v.length > 200_000) return '';
    return v;
  }
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
  } catch {
    /* ignore */
  }
  return '';
}

export function redactConfigSecrets(config: Record<string, unknown> | null | undefined) {
  if (!config || typeof config !== 'object') return {};
  const clone: Record<string, unknown> = { ...config };
  const scrub = (obj: Record<string, unknown>) => {
    for (const key of Object.keys(obj)) {
      const lower = key.toLowerCase();
      const val = obj[key];
      if (
        lower.includes('key') ||
        lower.includes('secret') ||
        lower.includes('password') ||
        lower.includes('token')
      ) {
        if (typeof val === 'string' && val.length > 0) {
          obj[key] = val.length <= 8 ? '********' : `${val.slice(0, 4)}…${val.slice(-4)}`;
        }
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        scrub(val as Record<string, unknown>);
      }
    }
  };
  scrub(clone);
  return clone;
}

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 128) return 'Password is too long';
  return null;
}
