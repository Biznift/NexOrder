import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Eye, EyeOff, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth, useSaasData } from '@/saas/AuthContext';
import {
  createTeamMember,
  deleteTeamMember,
  generateTeamPassword,
  getAccountOwner,
  getTeamSeatInfo,
  listTeamMembers,
  updateTeamMember,
} from '@/saas/store';
import {
  DEFAULT_TEAM_PERMISSIONS,
  PERMISSION_LABELS,
  STATUS_LABELS,
  type SaasUser,
  type TeamPermissionKey,
  type TeamPermissions,
  type UserStatus,
} from '@/saas/types';

type FormState = {
  name: string;
  email: string;
  password: string;
  status: UserStatus;
  permissions: TeamPermissions;
};

function emptyForm(): FormState {
  return {
    name: '',
    email: '',
    password: generateTeamPassword(),
    status: 'active',
    permissions: { ...DEFAULT_TEAM_PERMISSIONS },
  };
}

export function TeamMembersPage() {
  const { user, canManageTeam } = useAuth();
  const data = useSaasData();
  const owner = getAccountOwner(user);
  const ownerId = owner?.id || '';

  const seats = ownerId
    ? getTeamSeatInfo(ownerId)
    : { used: 0, limit: 0, remaining: 0, plan: undefined as ReturnType<typeof getTeamSeatInfo>['plan'] | undefined };
  const members = useMemo(() => (ownerId ? listTeamMembers(ownerId) : []), [ownerId, data.users]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SaasUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [shareCreds, setShareCreds] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copied, setCopied] = useState('');

  if (!user) return null;

  if (!canManageTeam) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-8">
        <Button asChild variant="outline" size="sm">
          <Link to="/app">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to app
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Team access denied</CardTitle>
            <CardDescription>
              Your account does not include permission to manage team members. Ask the shop owner to enable
              “Manage team members” for you.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError('');
    setShowPassword(true);
    setOpen(true);
  };

  const openEdit = (member: SaasUser) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: '',
      status: member.status,
      permissions: { ...DEFAULT_TEAM_PERMISSIONS, ...(member.permissions || {}) },
    });
    setError('');
    setShowPassword(false);
    setOpen(true);
  };

  const setPerm = (key: TeamPermissionKey, value: boolean) => {
    setForm((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: value } }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (editing) {
      const res = await updateTeamMember(editing.id, {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        status: form.status,
        permissions: form.permissions,
      });
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      if (res.user.password) {
        setShareCreds({ email: res.user.email, password: res.user.password, name: res.user.name });
      }
    } else {
      const res = await createTeamMember({
        name: form.name,
        email: form.email,
        password: form.password,
        status: form.status,
        permissions: form.permissions,
        ownerId,
      });
      if (res.ok === false) {
        setError(res.error);
        return;
      }
      setShareCreds({
        email: res.user.email,
        password: res.user.password || form.password,
        name: res.user.name,
      });
    }
    setOpen(false);
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      setCopied('failed');
    }
  };

  const shareBlock = shareCreds
    ? `Login for ${shareCreds.name}\nEmail: ${shareCreds.email}\nPassword: ${shareCreds.password}\n\nSign in at the app login page and share these details with your teammate.`
    : '';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/app">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to app
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Team members</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create logins with name, email, and password — then share credentials with your staff. Set what each
            person can do.
          </p>
        </div>
        <Button onClick={openCreate} disabled={seats.remaining <= 0}>
          <Plus className="h-4 w-4" />
          Add team member
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Seats used</CardDescription>
            <CardTitle className="text-3xl">
              {seats.used}
              <span className="text-base font-medium text-slate-500"> / {seats.limit}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">Based on your {seats.plan?.name || 'current'} plan</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remaining seats</CardDescription>
            <CardTitle className="text-3xl">{seats.remaining}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            {seats.remaining <= 0 ? 'Upgrade plan for more seats' : 'Ready to invite staff'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Account owner</CardDescription>
            <CardTitle className="text-lg truncate">{owner?.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 truncate">{owner?.email}</CardContent>
        </Card>
      </div>

      {shareCreds ? (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-base">Share login with your teammate</CardTitle>
            <CardDescription>
              No email delivery is wired yet — copy these credentials and send them yourself (WhatsApp, SMS, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Email</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{shareCreds.email}</span>
                  <Button size="icon" variant="ghost" onClick={() => copyText('email', shareCreds.email)}>
                    {copied === 'email' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Password</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{shareCreds.password}</span>
                  <Button size="icon" variant="ghost" onClick={() => copyText('password', shareCreds.password)}>
                    {copied === 'password' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={() => copyText('all', shareBlock)}>
              <Copy className="h-4 w-4" />
              {copied === 'all' ? 'Copied message' : 'Copy share message'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            Your team
          </CardTitle>
          <CardDescription>
            {members.length === 0
              ? 'No team members yet. Add someone with email + password to collaborate.'
              : `${members.length} member${members.length === 1 ? '' : 's'} on this account.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Free includes {seats.limit} seat{seats.limit === 1 ? '' : 's'}. Pro includes more.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const enabled = Object.entries(member.permissions || DEFAULT_TEAM_PERMISSIONS)
                    .filter(([, v]) => v)
                    .map(([k]) => PERMISSION_LABELS[k as TeamPermissionKey]);
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {enabled.slice(0, 3).map((label) => (
                            <Badge key={label} variant="secondary">
                              {label}
                            </Badge>
                          ))}
                          {enabled.length > 3 ? (
                            <Badge variant="outline">+{enabled.length - 3}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.status === 'active' ? 'default' : member.status === 'suspended' ? 'danger' : 'warning'
                          }
                        >
                          {STATUS_LABELS[member.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(member)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              const res = await deleteTeamMember(member.id);
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
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit team member' : 'Add team member'}</DialogTitle>
            <DialogDescription>
              Set login details and toggle what this person can do in the order app.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email (login)</Label>
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
                <Label>Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm({ ...form, password: generateTeamPassword() })}
                  >
                    Generate
                  </Button>
                </div>
              </div>
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
            </div>

            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(PERMISSION_LABELS) as TeamPermissionKey[]).map((key) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 gap-3"
                  >
                    <span className="text-sm font-medium">{PERMISSION_LABELS[key]}</span>
                    <Switch checked={form.permissions[key]} onCheckedChange={(v) => setPerm(key, v)} />
                  </label>
                ))}
              </div>
            </div>

            {error ? <div className="text-sm text-rose-600">{error}</div> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? 'Save member' : 'Create & share'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
