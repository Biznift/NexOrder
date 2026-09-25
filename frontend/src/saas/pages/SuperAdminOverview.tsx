import { Link } from 'react-router-dom';
import { CreditCard, Layers, Users, Activity, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSaasData } from '@/saas/AuthContext';
import { ROLE_LABELS } from '@/saas/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export function SuperAdminOverview() {
  const data = useSaasData();
  const activeUsers = data.users.filter((u) => u.status === 'active').length;
  const paidUsers = data.users.filter((u) => {
    const plan = data.plans.find((p) => p.id === u.planId);
    return plan && plan.priceMonthly > 0;
  }).length;
  const mrr = data.users.reduce((sum, u) => {
    const plan = data.plans.find((p) => p.id === u.planId);
    return sum + (plan?.priceMonthly || 0);
  }, 0);

  const stats = [
    { label: 'Total users', value: data.users.length, hint: `${activeUsers} active`, icon: Users },
    { label: 'Active plans', value: data.plans.filter((p) => p.isActive).length, hint: `${data.plans.length} total`, icon: Layers },
    { label: 'Paid seats', value: paidUsers, hint: 'Non-free plans', icon: CreditCard },
    { label: 'Est. MRR', value: formatCurrency(mrr), hint: 'From assigned plans', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform overview</h1>
          <p className="text-sm text-slate-500 mt-1">Create plans, manage every account, and watch usage.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/super-admin/users">Manage users</Link>
          </Button>
          <Button asChild>
            <Link to="/super-admin/plans">Manage plans</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>{stat.label}</CardDescription>
                <stat.icon className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Plans</CardTitle>
            <CardDescription>Product catalog controlled by Super Admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.plans
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((plan) => (
                <div key={plan.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{plan.name}</span>
                      {plan.isDefault ? <Badge variant="info">Default</Badge> : null}
                      {!plan.isActive ? <Badge variant="warning">Inactive</Badge> : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatCurrency(plan.priceMonthly)}/mo ·{' '}
                      {data.users.filter((u) => u.planId === plan.id).length} users
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest platform events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.auditLog.slice(0, 6).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-slate-100 px-3 py-3">
                <div className="text-sm font-medium">{entry.action}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{entry.actorName}</span>
                  {entry.target ? <span>{entry.target}</span> : null}
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role mix</CardTitle>
          <CardDescription>How seats are distributed across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((role) => (
            <Badge key={role} variant={role === 'super_admin' ? 'purple' : role === 'admin' ? 'info' : 'secondary'}>
              {ROLE_LABELS[role]}: {data.users.filter((u) => u.role === role).length}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
