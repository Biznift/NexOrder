import type { ComponentType } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Shield,
  Users,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/saas/AuthContext';
import { ROLE_LABELS } from '@/saas/types';
import { DevelopedByBiznift } from '@/saas/components/DevelopedByBiznift';

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }>; end?: boolean };

export function PanelLayout({
  title,
  nav,
}: {
  title: string;
  nav: NavItem[];
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200/80 bg-white/80 backdrop-blur md:flex md:flex-col">
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">{title}</div>
              <div className="text-[11px] text-slate-500">SaaS control plane</div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
              {user ? <Badge className="mt-2" variant="secondary">{ROLE_LABELS[user.role]}</Badge> : null}
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
            <DevelopedByBiznift className="mt-3" align="left" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur px-4 py-3 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">{title}</div>
                <div className="text-xs text-slate-500">{user?.email}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium',
                      isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

export function SuperAdminLayout() {
  return (
    <PanelLayout
      title="Super Admin"
      nav={[
        { to: '/super-admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/super-admin/plans', label: 'Plans', icon: Layers },
        { to: '/super-admin/users', label: 'All users', icon: Users },
        { to: '/super-admin/audit', label: 'Audit log', icon: Activity },
        { to: '/super-admin/settings', label: 'System', icon: Settings },
        { to: '/app', label: 'Open app', icon: Package },
      ]}
    />
  );
}

export function AdminLayout() {
  return (
    <PanelLayout
      title="Admin"
      nav={[
        { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/billing', label: 'Plans & billing', icon: CreditCard },
        { to: '/app', label: 'Open app', icon: Package },
        { to: '/admin/account', label: 'Account', icon: Shield },
      ]}
    />
  );
}
