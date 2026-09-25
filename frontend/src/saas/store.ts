import { SEED_AUDIT, SEED_PLANS, SEED_USERS } from './seed';
import type {
  AuditLogEntry,
  Plan,
  PlanFeatures,
  SaasState,
  SaasUser,
  TeamPermissionKey,
  TeamPermissions,
  UserRole,
  UserStatus,
} from './types';
import { DEFAULT_TEAM_PERMISSIONS, FULL_PERMISSIONS, generateTeamPassword } from './types';
import {
  apiLogin,
  apiSignup,
  apiMe,
  apiCreateTeamMember,
  apiUpdateTeamMember,
  apiDeleteTeamMember,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser,
  apiListUsers,
  apiListPlans,
  apiUpdateMe,
} from '../authApi';
import { setAuthToken } from '../apiClient';

const STORAGE_KEY = 'oms_saas_state_v3';

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function now() {
  return new Date().toISOString();
}

function roleAlignedToPlan(role: UserRole, planId: string): UserRole {
  if (role === 'super_admin' || role === 'admin' || role === 'team_member') return role;
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return role;
  if (plan.slug === 'free' || plan.priceMonthly === 0) return 'free';
  return 'pro';
}

function defaultState(): SaasState {
  return {
    users: structuredClone(SEED_USERS),
    plans: structuredClone(SEED_PLANS),
    auditLog: structuredClone(SEED_AUDIT),
    currentUserId: null,
  };
}

function load(): SaasState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as SaasState;
    if (!parsed.users?.length || !parsed.plans?.length) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function save(state: SaasState) {
  // Never persist passwords
  const safe: SaasState = {
    ...state,
    users: state.users.map(({ password: _p, ...rest }) => rest),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
}

let state = typeof window !== 'undefined' ? load() : defaultState();
const listeners = new Set<() => void>();

function emit() {
  save(state);
  listeners.forEach((l) => l());
}

function pushAudit(actor: SaasUser | null, action: string, target?: string) {
  const entry: AuditLogEntry = {
    id: uid('audit'),
    actorId: actor?.id || 'system',
    actorName: actor?.name || 'System',
    action,
    target,
    createdAt: now(),
  };
  state = { ...state, auditLog: [entry, ...state.auditLog].slice(0, 200) };
}

export function subscribeSaas(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSaasSnapshot(): SaasState {
  return state;
}

export function resetSaasDemoData() {
  const current = state.currentUserId;
  state = { ...defaultState(), currentUserId: current };
  emit();
}

/** Replace entire SaaS snapshot (used by Super Admin platform restore). */
export function replaceSaasState(next: Omit<SaasState, 'currentUserId'> & { currentUserId?: string | null }) {
  state = {
    users: next.users,
    plans: next.plans,
    auditLog: next.auditLog,
    currentUserId: next.currentUserId ?? state.currentUserId,
  };
  emit();
}

/** Replace one owner's account + team members; leave everyone else untouched. */
export function replaceOwnerTeamSlice(ownerId: string, account: SaasUser, teamMembers: SaasUser[]) {
  const others = state.users.filter(
    (u) => u.id !== ownerId && !(u.role === 'team_member' && u.ownerId === ownerId)
  );
  const normalizedTeam = teamMembers.map((m) => ({
    ...m,
    role: 'team_member' as const,
    ownerId,
    planId: account.planId,
  }));
  state = {
    ...state,
    users: [account, ...normalizedTeam, ...others],
  };
  emit();
}

export function getCurrentUser(): SaasUser | null {
  if (!state.currentUserId) return null;
  return state.users.find((u) => u.id === state.currentUserId) || null;
}

/** Account owner for billing/plan — team members resolve to their owner. */
export function getAccountOwner(user: SaasUser | null): SaasUser | null {
  if (!user) return null;
  if (user.role !== 'team_member') return user;
  if (!user.ownerId) return null;
  return state.users.find((u) => u.id === user.ownerId) || null;
}

export function getPlanById(planId: string): Plan | undefined {
  return state.plans.find((p) => p.id === planId);
}

export function getUserPlan(user: SaasUser): Plan | undefined {
  const owner = getAccountOwner(user) || user;
  return getPlanById(owner.planId);
}

export function listTeamMembers(ownerId: string): SaasUser[] {
  return state.users
    .filter((u) => u.role === 'team_member' && u.ownerId === ownerId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getTeamSeatInfo(ownerId: string) {
  const owner = state.users.find((u) => u.id === ownerId);
  const plan = owner ? getUserPlan(owner) : undefined;
  const used = listTeamMembers(ownerId).length;
  const limit = plan?.features.teamMembers ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used), plan };
}

export function canManageTeam(user: SaasUser | null): boolean {
  if (!user || user.status !== 'active') return false;
  if (user.role === 'team_member') {
    return !!user.permissions?.manageTeam;
  }
  return true;
}

export function hasPermission(user: SaasUser | null, key: TeamPermissionKey): boolean {
  if (!user || user.status !== 'active') return false;
  if (user.role !== 'team_member') return true;
  const perms = { ...DEFAULT_TEAM_PERMISSIONS, ...(user.permissions || {}) };
  return !!perms[key];
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const res = await apiLogin(email, password);
  if (!res.ok) return res;
  upsertUser(res.user);
  state = { ...state, currentUserId: res.user.id };
  pushAudit(res.user, 'Signed in', res.user.email);
  emit();
  // Refresh tenant roster from API when possible
  void syncUsersFromApi();
  return { ok: true, user: res.user };
}

export function logout() {
  const user = getCurrentUser();
  if (user) pushAudit(user, 'Signed out', user.email);
  setAuthToken(null);
  state = { ...state, currentUserId: null };
  emit();
}

export async function signup(input: {
  name: string;
  email: string;
  password: string;
  company?: string;
}): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const res = await apiSignup(input);
  if (!res.ok) return res;
  upsertUser(res.user);
  state = { ...state, currentUserId: res.user.id };
  pushAudit(res.user, 'Signed up (Free plan)', res.user.email);
  emit();
  return { ok: true, user: res.user };
}

function upsertUser(user: SaasUser) {
  const exists = state.users.some((u) => u.id === user.id);
  state = {
    ...state,
    users: exists
      ? state.users.map((u) => (u.id === user.id ? { ...u, ...user, password: undefined } : u))
      : [{ ...user, password: undefined }, ...state.users],
  };
}

export async function hydrateSession(): Promise<SaasUser | null> {
  const user = await apiMe();
  if (!user) {
    if (state.currentUserId) {
      state = { ...state, currentUserId: null };
      emit();
    }
    return null;
  }
  upsertUser(user);
  state = { ...state, currentUserId: user.id };
  emit();
  await syncUsersFromApi();
  return user;
}

export async function syncUsersFromApi() {
  try {
    const [users, plans] = await Promise.all([apiListUsers(), apiListPlans()]);
    if (users.length) {
      const byId = new Map(state.users.map((u) => [u.id, u]));
      for (const u of users) byId.set(u.id, { ...(byId.get(u.id) || u), ...u, password: undefined });
      state = { ...state, users: Array.from(byId.values()) };
    }
    if (plans.length) {
      state = { ...state, plans: plans as Plan[] };
    }
    emit();
  } catch {
    /* offline / unauthorized */
  }
}

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
  planId: string;
  status?: UserStatus;
  company?: string;
  phone?: string;
  notes?: string;
  password?: string;
}): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  if (input.role === 'team_member') {
    return { ok: false, error: 'Use Team Members to add staff with permissions.' };
  }
  const actor = getCurrentUser();
  if (actor?.role !== 'super_admin' && actor?.role !== 'admin') {
    return { ok: false, error: 'Insufficient permissions.' };
  }
  const password = (input.password || generateTeamPassword()).trim();
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

  const res = await apiCreateUser({
    name: input.name,
    email: input.email,
    role: roleAlignedToPlan(input.role, input.planId),
    planId: input.planId,
    status: input.status || 'active',
    company: input.company,
    phone: input.phone,
    notes: input.notes,
    password,
  });
  if (!res.ok) return res;
  upsertUser({ ...res.user, password });
  pushAudit(actor, `Created user (${res.user.role})`, res.user.email);
  emit();
  return { ok: true, user: { ...res.user, password } };
}

export async function createTeamMember(input: {
  name: string;
  email: string;
  password?: string;
  status?: UserStatus;
  permissions?: TeamPermissions;
  ownerId?: string;
}): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const actor = getCurrentUser();
  if (!canManageTeam(actor)) {
    return { ok: false, error: 'You do not have permission to manage team members.' };
  }

  const owner =
    input.ownerId
      ? state.users.find((u) => u.id === input.ownerId) || null
      : getAccountOwner(actor);

  if (!owner || owner.role === 'team_member') {
    return { ok: false, error: 'Team owner account not found.' };
  }

  const seats = getTeamSeatInfo(owner.id);
  if (seats.limit <= 0) {
    return { ok: false, error: 'Your plan does not include team seats. Upgrade to add members.' };
  }
  if (seats.used >= seats.limit) {
    return {
      ok: false,
      error: `Team seat limit reached (${seats.used}/${seats.limit}). Upgrade your plan or remove a member.`,
    };
  }

  const password = (input.password || generateTeamPassword()).trim();
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

  const res = await apiCreateTeamMember({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password,
    status: input.status || 'active',
    permissions: { ...DEFAULT_TEAM_PERMISSIONS, ...(input.permissions || {}) },
    ownerId: owner.id,
    planId: owner.planId,
  });
  if (!res.ok) return res;

  const user: SaasUser = {
    ...res.user,
    password: res.temporaryPassword || password,
  };
  upsertUser(user);
  pushAudit(actor, 'Added team member', user.email);
  emit();
  return { ok: true, user };
}

export async function updateTeamMember(
  id: string,
  patch: Partial<
    Pick<SaasUser, 'name' | 'email' | 'password' | 'status' | 'permissions' | 'phone' | 'notes'>
  >
): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const actor = getCurrentUser();
  if (!canManageTeam(actor)) {
    return { ok: false, error: 'You do not have permission to manage team members.' };
  }

  const existing = state.users.find((u) => u.id === id && u.role === 'team_member');
  if (!existing) return { ok: false, error: 'Team member not found.' };

  if (patch.password !== undefined && patch.password.trim().length > 0 && patch.password.trim().length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const res = await apiUpdateTeamMember(id, {
    name: patch.name,
    status: patch.status,
    phone: patch.phone,
    notes: patch.notes,
    permissions: patch.permissions,
    password: patch.password?.trim() || undefined,
  });
  if (!res.ok) return res;

  const user: SaasUser = {
    ...res.user,
    password: res.temporaryPassword || undefined,
  };
  upsertUser(user);
  pushAudit(actor, 'Updated team member', user.email);
  emit();
  return { ok: true, user };
}

export async function deleteTeamMember(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = getCurrentUser();
  if (!canManageTeam(actor)) {
    return { ok: false, error: 'You do not have permission to manage team members.' };
  }
  const existing = state.users.find((u) => u.id === id && u.role === 'team_member');
  if (!existing) return { ok: false, error: 'Team member not found.' };
  if (actor?.id === id) return { ok: false, error: 'You cannot delete your own login while signed in.' };

  const res = await apiDeleteTeamMember(id);
  if (!res.ok) return res;

  state = { ...state, users: state.users.filter((u) => u.id !== id) };
  pushAudit(actor, 'Removed team member', existing.email);
  emit();
  return { ok: true };
}

export async function updateOwnProfile(patch: {
  name?: string;
  company?: string;
  phone?: string;
  password?: string;
}): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const res = await apiUpdateMe(patch);
  if (!res.ok) return res;
  upsertUser(res.user);
  emit();
  return res;
}

export async function updateUser(
  id: string,
  patch: Partial<
    Pick<
      SaasUser,
      'name' | 'email' | 'role' | 'planId' | 'status' | 'company' | 'phone' | 'notes' | 'password' | 'ordersUsedThisMonth'
    >
  >
): Promise<{ ok: true; user: SaasUser } | { ok: false; error: string }> {
  const actor = getCurrentUser();
  if (actor?.role !== 'super_admin' && actor?.role !== 'admin') {
    return { ok: false, error: 'Insufficient permissions.' };
  }
  const existing = state.users.find((u) => u.id === id);
  if (!existing) return { ok: false, error: 'User not found.' };
  const nextRole = patch.role ?? existing.role;
  if (existing.role === 'team_member' || nextRole === 'team_member') {
    return { ok: false, error: 'Edit team members from the Team page.' };
  }
  if (patch.password && patch.password.trim().length > 0 && patch.password.trim().length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' };
  }

  const res = await apiUpdateUser(id, {
    name: patch.name,
    role: patch.role ? roleAlignedToPlan(patch.role, patch.planId ?? existing.planId) : undefined,
    planId: patch.planId,
    status: patch.status,
    company: patch.company,
    phone: patch.phone,
    notes: patch.notes,
    password: patch.password?.trim() || undefined,
  });
  if (!res.ok) return res;

  upsertUser(res.user);
  if (patch.planId) {
    state = {
      ...state,
      users: state.users.map((u) =>
        u.role === 'team_member' && u.ownerId === id
          ? { ...u, planId: patch.planId!, updatedAt: now() }
          : u
      ),
    };
  }
  pushAudit(actor, 'Updated user', res.user.email);
  emit();
  return { ok: true, user: res.user };
}

export async function deleteUser(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const actor = getCurrentUser();
  const existing = state.users.find((u) => u.id === id);
  if (!existing) return { ok: false, error: 'User not found.' };
  if (existing.role === 'team_member') {
    return deleteTeamMember(id);
  }
  if (existing.role === 'super_admin' && state.users.filter((u) => u.role === 'super_admin').length <= 1) {
    return { ok: false, error: 'Cannot delete the last super admin.' };
  }
  if (actor?.id === id) return { ok: false, error: 'You cannot delete your own account while signed in.' };

  const res = await apiDeleteUser(id);
  if (!res.ok) return res;

  state = {
    ...state,
    users: state.users.filter((u) => u.id !== id && u.ownerId !== id),
  };
  pushAudit(actor, 'Deleted user', existing.email);
  emit();
  return { ok: true };
}

export function createPlan(input: {
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeatures;
  isActive?: boolean;
  isDefault?: boolean;
}): { ok: true; plan: Plan } | { ok: false; error: string } {
  const actor = getCurrentUser();
  const slug = input.slug.trim().toLowerCase().replace(/\s+/g, '-');
  if (!input.name.trim() || !slug) return { ok: false, error: 'Name and slug are required.' };
  if (state.plans.some((p) => p.slug === slug)) return { ok: false, error: 'Plan slug already exists.' };
  let plans = [...state.plans];
  if (input.isDefault) {
    plans = plans.map((p) => ({ ...p, isDefault: false }));
  }
  const plan: Plan = {
    id: uid('plan'),
    name: input.name.trim(),
    slug,
    description: input.description.trim(),
    priceMonthly: Number(input.priceMonthly) || 0,
    priceYearly: Number(input.priceYearly) || 0,
    currency: 'USD',
    features: input.features,
    isActive: input.isActive ?? true,
    isDefault: input.isDefault ?? false,
    sortOrder: plans.length + 1,
    createdAt: now(),
    updatedAt: now(),
  };
  state = { ...state, plans: [...plans, plan].sort((a, b) => a.sortOrder - b.sortOrder) };
  pushAudit(actor, 'Created plan', plan.name);
  emit();
  return { ok: true, plan };
}

export function updatePlan(
  id: string,
  patch: Partial<Omit<Plan, 'id' | 'createdAt'>>
): { ok: true; plan: Plan } | { ok: false; error: string } {
  const actor = getCurrentUser();
  const existing = state.plans.find((p) => p.id === id);
  if (!existing) return { ok: false, error: 'Plan not found.' };
  let plans = state.plans.map((p) => p);
  if (patch.isDefault) {
    plans = plans.map((p) => ({ ...p, isDefault: false }));
  }
  if (patch.slug) {
    const slug = patch.slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (plans.some((p) => p.id !== id && p.slug === slug)) {
      return { ok: false, error: 'Plan slug already exists.' };
    }
    patch.slug = slug;
  }
  const plan: Plan = { ...existing, ...patch, updatedAt: now() };
  state = {
    ...state,
    plans: plans.map((p) => (p.id === id ? plan : p)).sort((a, b) => a.sortOrder - b.sortOrder),
  };
  pushAudit(actor, 'Updated plan', plan.name);
  emit();
  return { ok: true, plan };
}

export function deletePlan(id: string): { ok: true } | { ok: false; error: string } {
  const actor = getCurrentUser();
  const existing = state.plans.find((p) => p.id === id);
  if (!existing) return { ok: false, error: 'Plan not found.' };
  if (state.users.some((u) => u.planId === id)) {
    return { ok: false, error: 'Plan is assigned to users. Reassign them first.' };
  }
  if (state.plans.length <= 1) return { ok: false, error: 'At least one plan is required.' };
  state = { ...state, plans: state.plans.filter((p) => p.id !== id) };
  pushAudit(actor, 'Deleted plan', existing.name);
  emit();
  return { ok: true };
}

export function assignPlanToUser(userId: string, planId: string) {
  return updateUser(userId, { planId });
}

export function canAccessFeature(user: SaasUser | null, feature: keyof PlanFeatures): boolean {
  if (!user) return false;
  const owner = getAccountOwner(user) || user;
  if (owner.role === 'super_admin' || owner.role === 'admin') return true;
  const plan = getUserPlan(owner);
  if (!plan) return false;
  const value = plan.features[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === -1 || value > 0;
  return false;
}

export function isOrderLimitReached(user: SaasUser | null): boolean {
  if (!user) return true;
  const owner = getAccountOwner(user) || user;
  if (owner.role === 'super_admin' || owner.role === 'admin') return false;
  const plan = getUserPlan(owner);
  if (!plan) return true;
  const max = plan.features.maxOrdersPerMonth;
  if (max === -1) return false;
  return owner.ordersUsedThisMonth >= max;
}

export { FULL_PERMISSIONS, DEFAULT_TEAM_PERMISSIONS, generateTeamPassword };
