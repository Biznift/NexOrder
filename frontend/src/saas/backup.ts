import { downloadFullBackup, restoreFullBackup } from '@/api';
import {
  getAccountOwner,
  getCurrentUser,
  getSaasSnapshot,
  listTeamMembers,
  replaceOwnerTeamSlice,
  replaceSaasState,
} from './store';
import type { AuditLogEntry, Plan, SaasUser } from './types';

export type UserBackupPayload = {
  version: 2;
  scope: 'user';
  ownerId: string;
  exportedAt: string;
  account: SaasUser;
  teamMembers: SaasUser[];
  shop: {
    orders: unknown[];
    inventory: unknown[];
    config: Record<string, unknown>;
    counts?: { orders: number; inventory: number };
  };
};

export type PlatformBackupPayload = {
  version: 2;
  scope: 'platform';
  exportedAt: string;
  saas: {
    users: SaasUser[];
    plans: Plan[];
    auditLog: AuditLogEntry[];
  };
  shop: {
    orders: unknown[];
    inventory: unknown[];
    config: Record<string, unknown>;
    counts?: { orders: number; inventory: number };
  };
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

/** Build + download backup for the signed-in account owner (account + team + shop). */
export async function downloadUserBackup(): Promise<UserBackupPayload> {
  const me = getCurrentUser();
  const owner = getAccountOwner(me);
  if (!owner || owner.role === 'team_member') {
    throw new Error('Only the account owner can download a user backup.');
  }
  if (owner.role === 'super_admin') {
    throw new Error('Super Admin should use System → Full SaaS backup instead.');
  }

  const shop = await downloadFullBackup();
  const payload: UserBackupPayload = {
    version: 2,
    scope: 'user',
    ownerId: owner.id,
    exportedAt: new Date().toISOString(),
    account: { ...owner },
    teamMembers: listTeamMembers(owner.id).map((m) => ({ ...m })),
    shop: {
      orders: shop.orders || [],
      inventory: shop.inventory || [],
      config: shop.config || {},
      counts: shop.counts,
    },
  };

  downloadJson(`shop-backup-${owner.email.replace(/[^a-z0-9]/gi, '_')}-${stamp()}.json`, payload);
  return payload;
}

/** Restore a user-scoped backup for the current account owner only. */
export async function restoreUserBackup(raw: unknown): Promise<{
  teamRestored: number;
  shop: { orders: number; inventory: number; configKeys: number };
}> {
  const me = getCurrentUser();
  const owner = getAccountOwner(me);
  if (!owner || owner.role === 'team_member') {
    throw new Error('Only the account owner can restore a user backup.');
  }
  if (owner.role === 'super_admin') {
    throw new Error('Super Admin should restore full SaaS backups from System settings.');
  }

  const data = raw as Partial<UserBackupPayload> & Record<string, unknown>;
  const isUserScope = data.scope === 'user';
  const isLegacyShop =
    !data.scope && (Array.isArray(data.orders) || Array.isArray(data.inventory) || !!data.config);

  if (!isUserScope && !isLegacyShop) {
    if ((data as unknown as PlatformBackupPayload).scope === 'platform') {
      throw new Error(
        'This is a full platform backup. Only Super Admin can restore it from System settings.'
      );
    }
    throw new Error('Invalid user backup file.');
  }

  let teamRestored = 0;

  if (isUserScope) {
    if (
      data.ownerId &&
      data.ownerId !== owner.id &&
      data.account?.email?.toLowerCase() !== owner.email.toLowerCase()
    ) {
      throw new Error('This backup belongs to a different account. You can only restore your own data.');
    }

    const accountPatch: SaasUser = data.account
      ? {
          ...owner,
          name: data.account.name || owner.name,
          company: data.account.company ?? owner.company,
          phone: data.account.phone ?? owner.phone,
          notes: data.account.notes ?? owner.notes,
          planId: data.account.planId || owner.planId,
          status: data.account.status || owner.status,
          ordersUsedThisMonth: data.account.ordersUsedThisMonth ?? owner.ordersUsedThisMonth,
          updatedAt: new Date().toISOString(),
        }
      : owner;

    const incomingTeam = Array.isArray(data.teamMembers) ? data.teamMembers : [];
    replaceOwnerTeamSlice(owner.id, accountPatch, incomingTeam);
    teamRestored = incomingTeam.length;
  }

  const shopPayload = isUserScope
    ? {
        version: 1,
        app: 'nexorder',
        orders: data.shop?.orders || [],
        inventory: data.shop?.inventory || [],
        config: data.shop?.config || {},
      }
    : {
        version: 1,
        app: 'nexorder',
        orders: data.orders || [],
        inventory: data.inventory || [],
        config: data.config || {},
      };

  const result = await restoreFullBackup(shopPayload);
  return {
    teamRestored,
    shop: {
      orders: result.restored?.orders || 0,
      inventory: result.restored?.inventory || 0,
      configKeys: result.restored?.configKeys || 0,
    },
  };
}

/** Super Admin: full SaaS (users/plans/audit) + shop D1. */
export async function downloadPlatformBackup(): Promise<PlatformBackupPayload> {
  const me = getCurrentUser();
  if (me?.role !== 'super_admin') {
    throw new Error('Only Super Admin can download the full SaaS database.');
  }

  const snap = getSaasSnapshot();
  const shop = await downloadFullBackup();
  const payload: PlatformBackupPayload = {
    version: 2,
    scope: 'platform',
    exportedAt: new Date().toISOString(),
    saas: {
      users: structuredClone(snap.users),
      plans: structuredClone(snap.plans),
      auditLog: structuredClone(snap.auditLog),
    },
    shop: {
      orders: shop.orders || [],
      inventory: shop.inventory || [],
      config: shop.config || {},
      counts: shop.counts,
    },
  };

  downloadJson(`saas-platform-backup-${stamp()}.json`, payload);
  return payload;
}

/** Super Admin: restore full SaaS + shop. */
export async function restorePlatformBackup(raw: unknown): Promise<{
  users: number;
  plans: number;
  shop: { orders: number; inventory: number; configKeys: number };
}> {
  const me = getCurrentUser();
  if (me?.role !== 'super_admin') {
    throw new Error('Only Super Admin can restore the full SaaS database.');
  }

  const data = raw as Record<string, any>;

  if (data.scope === 'user') {
    throw new Error('This is a user shop backup. Restore it from that user’s Settings → Backup.');
  }

  const hasSaas = !!(data.saas && Array.isArray(data.saas.users) && Array.isArray(data.saas.plans));
  const hasShop =
    (data.shop && (Array.isArray(data.shop.orders) || Array.isArray(data.shop.inventory))) ||
    Array.isArray(data.orders) ||
    Array.isArray(data.inventory) ||
    !!data.config;

  if (!hasSaas && !hasShop) {
    throw new Error('Invalid platform backup file.');
  }

  const snap = getSaasSnapshot();
  let usersCount = snap.users.length;
  let plansCount = snap.plans.length;

  if (hasSaas && data.saas) {
    const nextUsers = data.saas.users;
    const stillMe =
      nextUsers.find((u) => u.id === me.id) || nextUsers.find((u) => u.email === me.email);
    replaceSaasState({
      users: nextUsers,
      plans: data.saas.plans,
      auditLog: Array.isArray(data.saas.auditLog) ? data.saas.auditLog : [],
      currentUserId: stillMe?.id || me.id,
    });
    usersCount = nextUsers.length;
    plansCount = data.saas.plans.length;
  }

  let shopResult = { orders: 0, inventory: 0, configKeys: 0 };
  if (hasShop) {
    const shopPayload = data.shop
      ? {
          version: 1,
          app: 'nexorder',
          orders: data.shop.orders || [],
          inventory: data.shop.inventory || [],
          config: data.shop.config || {},
        }
      : {
          version: 1,
          app: 'nexorder',
          orders: data.orders || [],
          inventory: data.inventory || [],
          config: data.config || {},
        };
    const result = await restoreFullBackup(shopPayload);
    shopResult = {
      orders: result.restored?.orders || 0,
      inventory: result.restored?.inventory || 0,
      configKeys: result.restored?.configKeys || 0,
    };
  }

  return { users: usersCount, plans: plansCount, shop: shopResult };
}
