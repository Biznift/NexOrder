import { Link, useNavigate } from 'react-router-dom';
import { Crown, LogOut, Shield, UserRound, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/saas/AuthContext';
import { homeForRole } from '@/saas/ProtectedRoute';
import { ROLE_LABELS } from '@/saas/types';
import { formatCurrency } from '@/lib/utils';

export function PlanBanner() {
  const { user, plan, orderLimitReached, can, isTeamMember, accountOwner } = useAuth();
  if (!user || !plan) return null;
  if (user.role === 'super_admin' || user.role === 'admin') return null;
  if (isTeamMember) return null;

  const isFree = plan.slug === 'free' || user.role === 'free';
  if (!isFree && !orderLimitReached) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-700 text-white">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm">
          {orderLimitReached ? (
            <>
              <strong>Order limit reached</strong> for {plan.name} (
              {accountOwner?.ordersUsedThisMonth ?? user.ordersUsedThisMonth}/
              {plan.features.maxOrdersPerMonth}). Upgrade to keep creating orders.
            </>
          ) : (
            <>
              You are on <strong>{plan.name}</strong> ({formatCurrency(plan.priceMonthly)}/mo). Inventory and
              courier APIs unlock on Pro.
            </>
          )}
          {!can('inventory') ? (
            <span className="block text-white/80 text-xs mt-0.5">
              Inventory & courier integrations are Pro features.
            </span>
          ) : null}
        </div>
        <Button asChild size="sm" className="bg-white text-emerald-800 hover:bg-emerald-50 shrink-0">
          <Link to="/app/billing">
            <Crown className="h-3.5 w-3.5" />
            View plans
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function AppUserMenu() {
  const { user, plan, logout, canManageTeam, isTeamMember, accountOwner } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="flex items-center gap-1.5">
      {canManageTeam ? (
        <Link
          to="/app/team"
          title="Team members"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      ) : null}

      <Link
        to="/app/account"
        title="Account"
        className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-left transition-colors"
      >
        <div className="h-7 w-7 rounded-lg bg-emerald-600/90 flex items-center justify-center">
          <UserRound className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-white truncate max-w-[90px]">{user.name}</div>
          <div className="text-[10px] text-slate-400 truncate">
            {isTeamMember
              ? `Staff · ${accountOwner?.name || 'Team'}`
              : plan?.name || ROLE_LABELS[user.role]}
          </div>
        </div>
      </Link>

      {(user.role === 'admin' || user.role === 'super_admin') && (
        <Link
          to={homeForRole(user.role)}
          title="Admin panel"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
        >
          <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
        </Link>
      )}

      <button
        type="button"
        title="Sign out"
        onClick={() => {
          logout();
          navigate('/login');
        }}
        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
      >
        <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
    </div>
  );
}

export function FeatureLocked({
  title,
  description,
  tone = 'pro',
}: {
  title: string;
  description: string;
  tone?: 'pro' | 'permission';
}) {
  return (
    <div className="rounded-2xl border border-dashed border-emerald-300 bg-white p-8 text-center shadow-sm">
      <Badge className="mb-3" variant="warning">
        {tone === 'permission' ? 'No access' : 'Pro feature'}
      </Badge>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">{description}</p>
      {tone === 'pro' ? (
        <Button asChild className="mt-5">
          <Link to="/app/billing">Upgrade to unlock</Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="mt-5">
          <Link to="/app">Back to home</Link>
        </Button>
      )}
    </div>
  );
}
