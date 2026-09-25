import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/saas/AuthContext';
import { updateOwnProfile } from '@/saas/store';
import { ROLE_LABELS } from '@/saas/types';
import { formatCurrency } from '@/lib/utils';

export function AccountPage() {
  const { user, plan, accountOwner, isTeamMember, canManageTeam } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [company, setCompany] = useState(user?.company || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');

  if (!user) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isTeamMember) {
      setMessage('Ask the account owner to edit staff profiles from Team members.');
      return;
    }
    const res = await updateOwnProfile({ name, company, phone });
    if (res.ok === false) {
      setMessage(res.error);
      return;
    }
    setMessage('Profile updated.');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account</h1>
          <p className="text-sm text-slate-500 mt-1">Your profile and subscription snapshot.</p>
        </div>
        <div className="flex gap-2">
          {canManageTeam ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/app/team">
                <Users className="h-3.5 w-3.5" />
                Team
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link to="/app">
              <ArrowLeft className="h-3.5 w-3.5" />
              App
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{ROLE_LABELS[user.role]}</Badge>
              {plan ? (
                <Badge variant="secondary">
                  {plan.name} · {formatCurrency(plan.priceMonthly)}/mo
                </Badge>
              ) : null}
              {isTeamMember && accountOwner ? (
                <Badge variant="outline">Owner: {accountOwner.name}</Badge>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isTeamMember} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} disabled={isTeamMember} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isTeamMember} />
            </div>
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {!isTeamMember ? <Button type="submit">Save changes</Button> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
