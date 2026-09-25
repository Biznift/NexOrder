import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/saas/AuthContext';
import { homeForRole } from '@/saas/ProtectedRoute';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signup({ name, email, password, company });
    setLoading(false);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    navigate(homeForRole('free'), { replace: true });
  };

  return (
    <div className="saas-auth-shell flex items-center justify-center px-4 py-10">
      <div className="saas-orb h-36 w-36 bg-amber-300/35 right-[10%] top-[14%]" />
      <div className="saas-orb h-24 w-24 bg-emerald-300/40 left-[14%] bottom-[18%]" style={{ animationDelay: '0.8s' }} />

      <div className="uiverse-auth-card relative z-10 w-full">
        <div className="uiverse-auth-inner">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">NexOrder</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Create your account</h2>
            <p className="mt-1 text-sm text-slate-500">
              New signups land on the Free plan. Admins can upgrade you anytime.
            </p>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sakil Ahmed" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@store.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Shop / company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Rifa Baby Shop"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}

            <Button type="submit" className="uiverse-cta w-full h-11 rounded-xl text-base" disabled={loading}>
              {loading ? 'Creating…' : (
                <>
                  Create Free account <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-emerald-700 hover:text-emerald-600">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
