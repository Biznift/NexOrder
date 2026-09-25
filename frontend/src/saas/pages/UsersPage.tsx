import { FormEvent, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, useSaasData } from '@/saas/AuthContext';
import { createUser, deleteUser, updateUser } from '@/saas/store';
import { ROLE_LABELS, STATUS_LABELS, type SaasUser, type UserRole, type UserStatus } from '@/saas/types';
import { formatDate } from '@/lib/utils';

type FormState = {
  name: string;
  email: string;
  role: UserRole;
  planId: string;
  status: UserStatus;
  company: string;
  phone: string;
  notes: string;
  password: string;
};

function emptyForm(defaultPlanId: string, allowAdminRoles: boolean): FormState {
  return {
    name: '',
    email: '',
    role: allowAdminRoles ? 'free' : 'free',
    planId: defaultPlanId,
    status: 'active',
    company: '',
    phone: '',
    notes: '',
    password: '',
  };
}

function roleBadge(role: UserRole) {
  if (role === 'super_admin') return 'purple' as const;
  if (role === 'admin') return 'info' as const;
  if (role === 'pro') return 'default' as const;
  if (role === 'team_member') return 'outline' as const;
  return 'secondary' as const;
}

export function UsersPage({ mode }: { mode: 'super_admin' | 'admin' }) {
  const data = useSaasData();
  const { user: actor } = useAuth();
  const allowAdminRoles = mode === 'super_admin';
  const defaultPlanId = data.plans.find((p) => p.isDefault)?.id || data.plans[0]?.id || '';

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SaasUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(defaultPlanId, allowAdminRoles));
  const [error, setError] = useState('');

  const users = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.users
      .filter((u) => {
        if (mode === 'admin' && u.role === 'super_admin') return false;
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.company || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.users, query, mode]);

  const roleOptions: UserRole[] =
    mode === 'super_admin' ? ['super_admin', 'admin', 'pro', 'free'] : ['admin', 'pro', 'free'];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(defaultPlanId, allowAdminRoles));
    setError('');
    setOpen(true);
  };

  const openEdit = (user: SaasUser) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      planId: user.planId,
      status: user.status,
      company: user.company || '',
      phone: user.phone || '',
      notes: user.notes || '',
      password: '',
    });
    setError('');
    setOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'admin' && form.role === 'super_admin') {
      setError('Admins cannot create super admins.');
      return;
    }
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      planId: form.planId,
      status: form.status,
      company: form.company,
      phone: form.phone,
      notes: form.notes,
      password: form.password || undefined,
    };
    const res = editing ? await updateUser(editing.id, payload) : await createUser(payload);
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
          <h1 className="text-2xl font-bold tracking-tight">{mode === 'super_admin' ? 'All users' : 'User management'}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create accounts, assign plans, edit details, and control access.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create user
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Directory</CardTitle>
              <CardDescription>
                {users.length} users · signed in as {actor?.email}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search name, email, company…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const plan = data.plans.find((p) => p.id === user.planId);
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      {user.company ? <div className="text-xs text-slate-400">{user.company}</div> : null}
                      {user.role === 'team_member' && user.ownerId ? (
                        <div className="text-[11px] text-violet-600 mt-0.5">
                          Team of {data.users.find((o) => o.id === user.ownerId)?.email || user.ownerId}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={roleBadge(user.role)}>{ROLE_LABELS[user.role]}</Badge>
                    </TableCell>
                    <TableCell>{plan?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.status === 'active' ? 'default' : user.status === 'suspended' ? 'danger' : 'warning'
                        }
                      >
                        {STATUS_LABELS[user.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{user.ordersUsedThisMonth} orders</div>
                      <div className="text-[11px] text-slate-400">
                        {user.lastLoginAt ? `Last login ${formatDate(user.lastLoginAt)}` : 'Never logged in'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {user.role !== 'team_member' ? (
                          <Button size="icon" variant="ghost" onClick={() => openEdit(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            const res = await deleteUser(user.id);
                            if (res.ok === false) alert(res.error);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'Create user'}</DialogTitle>
            <DialogDescription>Assign a role and plan. Access follows plan entitlements.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={form.planId} onValueChange={(v) => setForm({ ...form, planId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {data.plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as UserStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as UserStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Password {editing ? '(leave blank to keep)' : '(min 8 chars)'}</Label>
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {error ? <div className="text-sm text-rose-600">{error}</div> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save user' : 'Create user'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
