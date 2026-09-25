import type { Env } from './env';
import { hashPassword } from './auth';

export type SaasRole = 'super_admin' | 'admin' | 'pro' | 'free' | 'team_member';
export type SaasStatus = 'active' | 'inactive' | 'suspended';

export interface SaasPlanRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: string;
  is_active: number;
  is_default: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SaasUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  role: SaasRole;
  plan_id: string;
  status: SaasStatus;
  company: string | null;
  phone: string | null;
  notes: string | null;
  orders_used_this_month: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  owner_id: string | null;
  permissions: string | null;
  avatar_url: string | null;
}

const DEFAULT_PLANS = [
  {
    id: 'plan_free',
    name: 'Free',
    slug: 'free',
    description: 'Get started with core order management.',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'USD',
    features: JSON.stringify({
      maxOrdersPerMonth: 50,
      inventory: false,
      courierIntegrations: false,
      aiOrderParsing: true,
      analytics: false,
      teamMembers: 1,
      prioritySupport: false,
      customBranding: false,
    }),
    is_active: 1,
    is_default: 1,
    sort_order: 1,
  },
  {
    id: 'plan_pro',
    name: 'Pro',
    slug: 'pro',
    description: 'Unlimited orders, inventory, courier APIs.',
    price_monthly: 29,
    price_yearly: 290,
    currency: 'USD',
    features: JSON.stringify({
      maxOrdersPerMonth: -1,
      inventory: true,
      courierIntegrations: true,
      aiOrderParsing: true,
      analytics: true,
      teamMembers: 5,
      prioritySupport: true,
      customBranding: true,
    }),
    is_active: 1,
    is_default: 0,
    sort_order: 2,
  },
  {
    id: 'plan_business',
    name: 'Business',
    slug: 'business',
    description: 'For agencies and multi-store operators.',
    price_monthly: 79,
    price_yearly: 790,
    currency: 'USD',
    features: JSON.stringify({
      maxOrdersPerMonth: -1,
      inventory: true,
      courierIntegrations: true,
      aiOrderParsing: true,
      analytics: true,
      teamMembers: 25,
      prioritySupport: true,
      customBranding: true,
    }),
    is_active: 1,
    is_default: 0,
    sort_order: 3,
  },
];

const SEED_USERS: Array<{
  id: string;
  email: string;
  name: string;
  role: SaasRole;
  plan_id: string;
  company: string;
  phone: string;
  owner_id?: string;
  permissions?: Record<string, boolean>;
}> = [
  {
    id: 'user_super',
    email: 'super@admin.com',
    name: 'Super Admin',
    role: 'super_admin',
    plan_id: 'plan_business',
    company: 'Platform HQ',
    phone: '+8801700000001',
  },
  {
    id: 'user_admin',
    email: 'admin@demo.com',
    name: 'Demo Admin',
    role: 'admin',
    plan_id: 'plan_pro',
    company: 'Ops Team',
    phone: '+8801700000002',
  },
  {
    id: 'user_pro',
    email: 'pro@demo.com',
    name: 'Pro Shop Owner',
    role: 'pro',
    plan_id: 'plan_pro',
    company: 'Rifa Baby Shop',
    phone: '+8801700000003',
  },
  {
    id: 'user_free',
    email: 'free@demo.com',
    name: 'Free Shop Owner',
    role: 'free',
    plan_id: 'plan_free',
    company: 'Starter Store',
    phone: '+8801700000004',
  },
  {
    id: 'user_team_pro',
    email: 'staff@rifa.com',
    name: 'Rifa Staff',
    role: 'team_member',
    plan_id: 'plan_pro',
    company: 'Rifa Baby Shop',
    phone: '+8801700000005',
    owner_id: 'user_pro',
    permissions: {
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
    },
  },
];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function publicUser(row: SaasUserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    planId: row.plan_id,
    status: row.status,
    company: row.company,
    phone: row.phone,
    notes: row.notes,
    ordersUsedThisMonth: row.orders_used_this_month,
    ownerId: row.owner_id || undefined,
    permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
    avatarUrl: row.avatar_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

export function createSaasDb(env: Env) {
  const d1 = env.DB;

  return {
    async ensureSeeded(demoPassword = 'demo') {
      const planCount = await this.countPlans();
      if (planCount === 0) {
        const ts = nowIso();
        for (const p of DEFAULT_PLANS) {
          await d1
            .prepare(
              `INSERT INTO saas_plans
               (id, name, slug, description, price_monthly, price_yearly, currency, features,
                is_active, is_default, sort_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              p.id,
              p.name,
              p.slug,
              p.description,
              p.price_monthly,
              p.price_yearly,
              p.currency,
              p.features,
              p.is_active,
              p.is_default,
              p.sort_order,
              ts,
              ts
            )
            .run();
        }
      }

      const userCount = await this.countUsers();
      if (userCount === 0) {
        const hash = await hashPassword(demoPassword);
        const ts = nowIso();
        for (const u of SEED_USERS) {
          await d1
            .prepare(
              `INSERT INTO saas_users
               (id, email, name, password_hash, role, plan_id, status, company, phone, notes,
                orders_used_this_month, created_at, updated_at, last_login_at, owner_id, permissions, avatar_url)
               VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, 0, ?, ?, ?, ?, ?, NULL)`
            )
            .bind(
              u.id,
              u.email,
              u.name,
              hash,
              u.role,
              u.plan_id,
              u.company,
              u.phone,
              ts,
              ts,
              ts,
              u.owner_id || null,
              u.permissions ? JSON.stringify(u.permissions) : null
            )
            .run();
        }
      }
    },

    async listPlans() {
      const { results } = await d1
        .prepare('SELECT * FROM saas_plans ORDER BY sort_order ASC, name ASC')
        .all<SaasPlanRow>();
      return results || [];
    },

    async getDefaultPlan() {
      return (
        (await d1
          .prepare('SELECT * FROM saas_plans WHERE is_default = 1 AND is_active = 1 LIMIT 1')
          .first<SaasPlanRow>()) ||
        (await d1.prepare('SELECT * FROM saas_plans WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1').first<SaasPlanRow>())
      );
    },

    async listUsers() {
      const { results } = await d1
        .prepare('SELECT * FROM saas_users ORDER BY created_at DESC')
        .all<SaasUserRow>();
      return results || [];
    },

    async listUsersForTenant(tenantId: string) {
      const { results } = await d1
        .prepare(
          `SELECT * FROM saas_users
           WHERE id = ? OR owner_id = ?
           ORDER BY created_at DESC`
        )
        .bind(tenantId, tenantId)
        .all<SaasUserRow>();
      return results || [];
    },

    async getUserByEmail(email: string) {
      return d1
        .prepare('SELECT * FROM saas_users WHERE lower(email) = lower(?)')
        .bind(email.trim())
        .first<SaasUserRow>();
    },

    async getUserById(id: string) {
      return d1.prepare('SELECT * FROM saas_users WHERE id = ?').bind(id).first<SaasUserRow>();
    },

    async countUsers() {
      const row = await d1.prepare('SELECT COUNT(*) as c FROM saas_users').first<{ c: number }>();
      return row?.c || 0;
    },

    async countPlans() {
      const row = await d1.prepare('SELECT COUNT(*) as c FROM saas_plans').first<{ c: number }>();
      return row?.c || 0;
    },

    async touchLogin(id: string) {
      const ts = nowIso();
      await d1
        .prepare('UPDATE saas_users SET last_login_at = ?, updated_at = ? WHERE id = ?')
        .bind(ts, ts, id)
        .run();
    },

    async createUser(input: {
      email: string;
      name: string;
      password: string;
      role: SaasRole;
      planId: string;
      company?: string;
      phone?: string;
      notes?: string;
      ownerId?: string | null;
      permissions?: Record<string, boolean> | null;
      status?: SaasStatus;
    }) {
      const existing = await this.getUserByEmail(input.email);
      if (existing) throw new Error('An account with this email already exists');
      const id = uid('user');
      const ts = nowIso();
      const password_hash = await hashPassword(input.password);
      await d1
        .prepare(
          `INSERT INTO saas_users
           (id, email, name, password_hash, role, plan_id, status, company, phone, notes,
            orders_used_this_month, created_at, updated_at, last_login_at, owner_id, permissions, avatar_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, NULL)`
        )
        .bind(
          id,
          input.email.trim().toLowerCase(),
          input.name.trim(),
          password_hash,
          input.role,
          input.planId,
          input.status || 'active',
          input.company?.trim() || null,
          input.phone?.trim() || null,
          input.notes?.trim() || null,
          ts,
          ts,
          ts,
          input.ownerId || null,
          input.permissions ? JSON.stringify(input.permissions) : null
        )
        .run();
      return (await this.getUserById(id))!;
    },

    async updateUser(
      id: string,
      updates: Partial<{
        name: string;
        role: SaasRole;
        planId: string;
        status: SaasStatus;
        company: string | null;
        phone: string | null;
        notes: string | null;
        permissions: Record<string, boolean> | null;
        password: string;
      }>
    ) {
      const current = await this.getUserById(id);
      if (!current) return null;
      const password_hash = updates.password
        ? await hashPassword(updates.password)
        : current.password_hash;
      const ts = nowIso();
      await d1
        .prepare(
          `UPDATE saas_users SET
             name = ?, role = ?, plan_id = ?, status = ?, company = ?, phone = ?, notes = ?,
             permissions = ?, password_hash = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          updates.name?.trim() ?? current.name,
          updates.role ?? current.role,
          updates.planId ?? current.plan_id,
          updates.status ?? current.status,
          updates.company !== undefined ? updates.company : current.company,
          updates.phone !== undefined ? updates.phone : current.phone,
          updates.notes !== undefined ? updates.notes : current.notes,
          updates.permissions !== undefined
            ? updates.permissions
              ? JSON.stringify(updates.permissions)
              : null
            : current.permissions,
          password_hash,
          ts,
          id
        )
        .run();
      return this.getUserById(id);
    },

    async deleteUser(id: string) {
      const result = await d1.prepare('DELETE FROM saas_users WHERE id = ?').bind(id).run();
      return (result.meta?.changes || 0) > 0;
    },

    async writeAudit(actorId: string, actorName: string, action: string, target?: string) {
      await d1
        .prepare(
          `INSERT INTO saas_audit_log (id, actor_id, actor_name, action, target, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(uid('audit'), actorId, actorName, action, target || null, nowIso())
        .run();
    },
  };
}
