export type UserRole = 'super_admin' | 'admin' | 'pro' | 'free' | 'team_member';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export type PlanId = string;

export type TeamPermissionKey =
  | 'dashboard'
  | 'createOrders'
  | 'onHold'
  | 'courierAssign'
  | 'shipping'
  | 'delivered'
  | 'inventory'
  | 'customers'
  | 'search'
  | 'settings'
  | 'manageTeam';

export type TeamPermissions = Record<TeamPermissionKey, boolean>;

export interface PlanFeatures {
  maxOrdersPerMonth: number; // -1 = unlimited
  inventory: boolean;
  courierIntegrations: boolean;
  aiOrderParsing: boolean;
  analytics: boolean;
  teamMembers: number; // max additional seats (excludes account owner)
  prioritySupport: boolean;
  customBranding: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: PlanFeatures;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaasUser {
  id: string;
  email: string;
  name: string;
  /** Never stored after real auth — only held briefly when sharing a new invite password */
  password?: string;
  role: UserRole;
  planId: PlanId;
  status: UserStatus;
  company?: string;
  phone?: string;
  avatarUrl?: string;
  notes?: string;
  ordersUsedThisMonth: number;
  /** Present for team_member — the shop owner account they belong to */
  ownerId?: string;
  /** Present for team_member — what they can do inside the app */
  permissions?: TeamPermissions;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  target?: string;
  createdAt: string;
}

export interface SaasState {
  users: SaasUser[];
  plans: Plan[];
  auditLog: AuditLogEntry[];
  currentUserId: string | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  pro: 'Pro User',
  free: 'Free User',
  team_member: 'Team Member',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
};

export const PERMISSION_LABELS: Record<TeamPermissionKey, string> = {
  dashboard: 'Dashboard / Home',
  createOrders: 'Create new orders',
  onHold: 'On Hold orders',
  courierAssign: 'Courier assign',
  shipping: 'Shipping',
  delivered: 'Delivered',
  inventory: 'Inventory',
  customers: 'Customers & export',
  search: 'Search orders',
  settings: 'Settings & integrations',
  manageTeam: 'Manage team members',
};

export const DEFAULT_TEAM_PERMISSIONS: TeamPermissions = {
  dashboard: true,
  createOrders: true,
  onHold: true,
  courierAssign: true,
  shipping: true,
  delivered: true,
  inventory: false,
  customers: true,
  search: true,
  settings: false,
  manageTeam: false,
};

export const FULL_PERMISSIONS: TeamPermissions = {
  dashboard: true,
  createOrders: true,
  onHold: true,
  courierAssign: true,
  shipping: true,
  delivered: true,
  inventory: true,
  customers: true,
  search: true,
  settings: true,
  manageTeam: true,
};

export function generateTeamPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i]! % chars.length];
  return out;
}
