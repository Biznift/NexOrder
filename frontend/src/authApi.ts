import { apiFetch, setAuthToken, getAuthToken } from './apiClient';
import type { SaasUser } from './saas/types';

export type AuthUserPayload = Omit<SaasUser, 'password'> & { password?: never };

function mapUser(raw: any): SaasUser {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    role: raw.role,
    planId: raw.planId,
    status: raw.status,
    company: raw.company || undefined,
    phone: raw.phone || undefined,
    notes: raw.notes || undefined,
    avatarUrl: raw.avatarUrl || undefined,
    ordersUsedThisMonth: raw.ordersUsedThisMonth ?? 0,
    ownerId: raw.ownerId || undefined,
    permissions: raw.permissions || undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastLoginAt: raw.lastLoginAt || undefined,
  };
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ ok: true; user: SaasUser; token: string } | { ok: false; error: string }> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Login failed' };
  setAuthToken(data.token);
  return { ok: true, user: mapUser(data.user), token: data.token };
}

export async function apiSignup(input: {
  name: string;
  email: string;
  password: string;
  company?: string;
}): Promise<{ ok: true; user: SaasUser; token: string } | { ok: false; error: string }> {
  const res = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Signup failed' };
  setAuthToken(data.token);
  return { ok: true, user: mapUser(data.user), token: data.token };
}

export async function apiMe(): Promise<SaasUser | null> {
  if (!getAuthToken()) return null;
  const res = await apiFetch('/api/auth/me');
  if (!res.ok) {
    setAuthToken(null);
    return null;
  }
  const data = await res.json();
  return mapUser(data.user);
}

export async function apiCreateTeamMember(input: {
  name: string;
  email: string;
  password: string;
  status?: string;
  permissions?: Record<string, boolean>;
  ownerId?: string;
  planId?: string;
}): Promise<{ ok: true; user: SaasUser; temporaryPassword?: string } | { ok: false; error: string }> {
  const res = await apiFetch('/api/saas/team-members', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Failed to create team member' };
  return {
    ok: true,
    user: mapUser(data.user),
    temporaryPassword: data.temporaryPassword,
  };
}

export async function apiUpdateTeamMember(
  id: string,
  patch: Record<string, unknown>
): Promise<{ ok: true; user: SaasUser; temporaryPassword?: string } | { ok: false; error: string }> {
  const res = await apiFetch(`/api/saas/team-members/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Failed to update team member' };
  return {
    ok: true,
    user: mapUser(data.user),
    temporaryPassword: data.temporaryPassword,
  };
}

export async function apiDeleteTeamMember(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiFetch(`/api/saas/team-members/${id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Failed to delete team member' };
  return { ok: true };
}

export async function apiCreateUser(input: Record<string, unknown>): Promise<
  { ok: true; user: SaasUser } | { ok: false; error: string }
> {
  const res = await apiFetch('/api/saas/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Failed to create user' };
  return { ok: true, user: mapUser(data.user) };
}

export async function apiUpdateUser(
  id: string,
  patch: Record<string, unknown>
): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const res = await apiFetch(`/api/saas/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Failed to update user' };
  return { ok: true, user: mapUser(data.user) };
}

export async function apiDeleteUser(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await apiFetch(`/api/saas/users/${id}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Failed to delete user' };
  return { ok: true };
}

export async function apiListUsers(): Promise<SaasUser[]> {
  const res = await apiFetch('/api/saas/users');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.users || []).map(mapUser);
}

export async function apiUpdateMe(patch: {
  name?: string;
  company?: string;
  phone?: string;
  password?: string;
}): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const res = await apiFetch('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Failed to update profile' };
  return { ok: true, user: mapUser(data.user) };
}

export async function apiListPlans() {
  const res = await apiFetch('/api/saas/plans');
  if (!res.ok) return [];
  const data = await res.json();
  return data.plans || [];
}
