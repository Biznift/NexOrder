import { Link } from 'react-router-dom';
import { Users, CreditCard, Package, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth, useSaasData } from '@/saas/AuthContext';
import { ROLE_LABELS } from '@/saas/types';
import { formatCurrency } from '@/lib/utils';

export function AdminOverview() {
  const { user } = useAuth();
  const data = useSaasData();
  const managed = data.users.filter((u) => u.role !== 'super_admin');
  const freeCount = managed.filter((u) => u.role === 'free').length;
  const proCount = managed.filter((u) => u.role === 'pro').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create users, assign Free/Pro plans, and keep accounts healthy.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/users">Manage users</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Managed users</CardDescription>
            <CardTitle className="text-3xl">{managed.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Excludes super admins</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Free seats</CardDescription>
            <CardTitle className="text-3xl">{freeCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Limited plan entitlements</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pro seats</CardDescription>
            <CardTitle className="text-3xl">{proCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Full product access</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your role</CardDescription>
            <CardTitle className="text-xl">{user ? ROLE_LABELS[user.role] : '—'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="info">Can assign any plan</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common admin workflows.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Link to="/admin/users" className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
              <Users className="h-5 w-5 text-emerald-600 mb-2" />
              <div className="font-semibold">Create / edit users</div>
              <p className="text-sm text-slate-500 mt-1">Set role, plan, status, and profile details.</p>
            </Link>
            <Link to="/admin/billing" className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
              <CreditCard className="h-5 w-5 text-emerald-600 mb-2" />
              <div className="font-semibold">Review plans</div>
              <p className="text-sm text-slate-500 mt-1">See Free vs Pro entitlements before assigning.</p>
            </Link>
            <Link to="/app" className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
              <Package className="h-5 w-5 text-emerald-600 mb-2" />
              <div className="font-semibold">Open order app</div>
              <p className="text-sm text-slate-500 mt-1">Jump into the shop operations surface.</p>
            </Link>
            <Link to="/admin/account" className="rounded-2xl border border-slate-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
              <ShieldCheck className="h-5 w-5 text-emerald-600 mb-2" />
              <div className="font-semibold">Account</div>
              <p className="text-sm text-slate-500 mt-1">Your profile and assigned plan.</p>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan catalog</CardTitle>
            <CardDescription>Read-only for admins.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.plans
              .filter((p) => p.isActive)
              .map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-100 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{plan.name}</span>
                    <span className="text-sm text-slate-600">{formatCurrency(plan.priceMonthly)}/mo</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{plan.description}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
