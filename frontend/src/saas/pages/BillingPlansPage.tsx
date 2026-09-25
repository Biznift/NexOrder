import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth, useSaasData } from '@/saas/AuthContext';
import { formatCurrency } from '@/lib/utils';

export function BillingPlansPage({ canEditPlans = false }: { canEditPlans?: boolean }) {
  const { user, plan } = useAuth();
  const data = useSaasData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans & billing</h1>
          <p className="text-sm text-slate-500 mt-1">
            Compare entitlements. Admins assign plans from the users screen.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/app">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to app
            </Link>
          </Button>
          {canEditPlans ? (
            <Button asChild>
              <Link to="/super-admin/plans">Edit plans</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {user && plan ? (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <CardTitle>Current plan</CardTitle>
            <CardDescription>
              {user.name} is on <strong>{plan.name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge>{formatCurrency(plan.priceMonthly)}/mo</Badge>
            <Badge variant="secondary">
              Usage {user.ordersUsedThisMonth}
              {plan.features.maxOrdersPerMonth === -1
                ? ' / unlimited'
                : ` / ${plan.features.maxOrdersPerMonth}`}{' '}
              orders
            </Badge>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {data.plans
          .filter((p) => p.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => (
            <Card key={p.id} className={plan?.id === p.id ? 'ring-2 ring-emerald-500' : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  {plan?.id === p.id ? <Badge>Current</Badge> : null}
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {formatCurrency(p.priceMonthly)}
                  <span className="text-sm font-medium text-slate-500">/mo</span>
                </div>
                <ul className="space-y-2 text-sm">
                  {(
                    [
                      [
                        'Orders / month',
                        p.features.maxOrdersPerMonth === -1
                          ? 'Unlimited'
                          : String(p.features.maxOrdersPerMonth),
                      ],
                      ['Inventory', p.features.inventory],
                      ['Courier APIs', p.features.courierIntegrations],
                      ['AI parsing', p.features.aiOrderParsing],
                      ['Analytics', p.features.analytics],
                      ['Priority support', p.features.prioritySupport],
                    ] as Array<[string, string | boolean]>
                  ).map(([label, value]) => (
                    <li key={label} className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">{label}</span>
                      {typeof value === 'boolean' ? (
                        value ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="h-4 w-4 text-slate-300" />
                        )
                      ) : (
                        <span className="font-medium">{value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
