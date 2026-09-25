import { FormEvent, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useSaasData } from '@/saas/AuthContext';
import { createPlan, deletePlan, updatePlan } from '@/saas/store';
import type { Plan, PlanFeatures } from '@/saas/types';
import { formatCurrency } from '@/lib/utils';

const emptyFeatures = (): PlanFeatures => ({
  maxOrdersPerMonth: 50,
  inventory: false,
  courierIntegrations: false,
  aiOrderParsing: true,
  analytics: false,
  teamMembers: 1,
  prioritySupport: false,
  customBranding: false,
});

type FormState = {
  name: string;
  slug: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  isActive: boolean;
  isDefault: boolean;
  features: PlanFeatures;
};

function toForm(plan?: Plan): FormState {
  if (!plan) {
    return {
      name: '',
      slug: '',
      description: '',
      priceMonthly: '0',
      priceYearly: '0',
      isActive: true,
      isDefault: false,
      features: emptyFeatures(),
    };
  }
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    priceMonthly: String(plan.priceMonthly),
    priceYearly: String(plan.priceYearly),
    isActive: plan.isActive,
    isDefault: plan.isDefault,
    features: { ...plan.features },
  };
}

export function PlansPage() {
  const data = useSaasData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<FormState>(toForm());
  const [error, setError] = useState('');

  const plans = useMemo(
    () => data.plans.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [data.plans]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(toForm());
    setError('');
    setOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm(toForm(plan));
    setError('');
    setOpen(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name,
      slug: form.slug || form.name,
      description: form.description,
      priceMonthly: Number(form.priceMonthly) || 0,
      priceYearly: Number(form.priceYearly) || 0,
      features: form.features,
      isActive: form.isActive,
      isDefault: form.isDefault,
    };
    const res = editing ? updatePlan(editing.id, payload) : createPlan(payload);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription plans</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define Free, Pro, and custom tiers. Feature gates follow these settings.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create plan
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const seats = data.users.filter((u) => u.planId === plan.id).length;
          return (
            <Card key={plan.id} className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-400 to-amber-400" />
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{plan.description}</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {plan.isDefault ? <Badge variant="info">Default</Badge> : null}
                    <Badge variant={plan.isActive ? 'default' : 'warning'}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-3xl font-bold tracking-tight">
                    {formatCurrency(plan.priceMonthly)}
                    <span className="text-sm font-medium text-slate-500">/mo</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {formatCurrency(plan.priceYearly)}/yr · {seats} assigned
                  </div>
                </div>

                <ul className="space-y-1.5 text-sm text-slate-600">
                  <li>
                    Orders/mo:{' '}
                    <strong>
                      {plan.features.maxOrdersPerMonth === -1 ? 'Unlimited' : plan.features.maxOrdersPerMonth}
                    </strong>
                  </li>
                  <li>Inventory: {plan.features.inventory ? 'Yes' : 'No'}</li>
                  <li>Couriers: {plan.features.courierIntegrations ? 'Yes' : 'No'}</li>
                  <li>AI parsing: {plan.features.aiOrderParsing ? 'Yes' : 'No'}</li>
                  <li>Extra team seats: {plan.features.teamMembers}</li>
                </ul>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => openEdit(plan)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => {
                      const res = deletePlan(plan.id);
                      if (res.ok === false) alert(res.error);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit plan' : 'Create plan'}</DialogTitle>
            <DialogDescription>Control pricing and feature entitlements for this tier.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="pro"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Monthly price</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.priceMonthly}
                  onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Yearly price</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.priceYearly}
                  onChange={(e) => setForm({ ...form, priceYearly: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Max orders / month (-1 unlimited)</Label>
                <Input
                  type="number"
                  value={form.features.maxOrdersPerMonth}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      features: { ...form.features, maxOrdersPerMonth: Number(e.target.value) },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Max team members (extra seats)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.features.teamMembers}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      features: { ...form.features, teamMembers: Number(e.target.value) || 1 },
                    })
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['inventory', 'Inventory'],
                  ['courierIntegrations', 'Courier integrations'],
                  ['aiOrderParsing', 'AI order parsing'],
                  ['analytics', 'Analytics'],
                  ['prioritySupport', 'Priority support'],
                  ['customBranding', 'Custom branding'],
                ] as Array<[keyof PlanFeatures, string]>
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={Boolean(form.features[key])}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, features: { ...form.features, [key]: checked } })
                    }
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
                Default for new signups
              </label>
            </div>

            {error ? <div className="text-sm text-rose-600">{error}</div> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save changes' : 'Create plan'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
