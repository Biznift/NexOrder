import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  getSaasSnapshot,
  subscribeSaas,
  login as storeLogin,
  logout as storeLogout,
  signup as storeSignup,
  getCurrentUser,
  getUserPlan,
  getAccountOwner,
  canAccessFeature,
  isOrderLimitReached,
  hasPermission,
  canManageTeam as storeCanManageTeam,
  hydrateSession,
} from './store';
import type { Plan, PlanFeatures, SaasUser, TeamPermissionKey, UserRole } from './types';

interface AuthContextValue {
  user: SaasUser | null;
  accountOwner: SaasUser | null;
  plan: Plan | null;
  isAuthenticated: boolean;
  isTeamMember: boolean;
  canManageTeam: boolean;
  authReady: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
    company?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
  can: (feature: keyof PlanFeatures) => boolean;
  hasPermission: (key: TeamPermissionKey) => boolean;
  orderLimitReached: boolean;
  refresh: number;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeSaas, getSaasSnapshot, getSaasSnapshot);
  const [refresh, setRefresh] = useState(0);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await hydrateSession();
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRefresh((n) => n + 1);
  }, [snapshot]);

  const user = useMemo(() => getCurrentUser(), [snapshot]);
  const accountOwner = useMemo(() => getAccountOwner(user), [user, snapshot]);
  const plan = useMemo(() => (user ? getUserPlan(user) || null : null), [user, snapshot]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accountOwner,
      plan,
      isAuthenticated: !!user,
      isTeamMember: user?.role === 'team_member',
      canManageTeam: storeCanManageTeam(user),
      authReady,
      login: async (email, password) => {
        const res = await storeLogin(email, password);
        if (!res.ok) return res;
        return { ok: true };
      },
      signup: async (input) => {
        const res = await storeSignup(input);
        if (!res.ok) return res;
        return { ok: true };
      },
      logout: () => storeLogout(),
      hasRole: (...roles) => !!user && roles.includes(user.role),
      can: (feature) => canAccessFeature(user, feature),
      hasPermission: (key) => hasPermission(user, key),
      orderLimitReached: isOrderLimitReached(user),
      refresh,
    }),
    [user, accountOwner, plan, refresh, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useSaasData() {
  return useSyncExternalStore(subscribeSaas, getSaasSnapshot, getSaasSnapshot);
}
