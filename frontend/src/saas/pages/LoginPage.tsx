import { FormEvent, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Package, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/saas/AuthContext';
import { homeForRole } from '@/saas/ProtectedRoute';
import { getCurrentUser } from '@/saas/store';

const DEMO_ACCOUNTS = [
  { email: 'super@admin.com', label: 'Super Admin' },
  { email: 'admin@demo.com', label: 'Admin' },
  { email: 'pro@demo.com', label: 'Pro Owner' },
  { email: 'staff@rifa.com', label: 'Team Staff' },
  { email: 'free@demo.com', label: 'Free' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('pro@demo.com');
  const [password, setPassword] = useState('demo');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    const user = getCurrentUser();
    navigate(from || homeForRole(user?.role || 'free'), { replace: true });
  };

  return (
    <div className="saas-auth-shell flex items-center justify-center px-4 py-10">
      <div className="saas-orb h-40 w-40 bg-emerald-300/40 left-[8%] top-[18%]" />
      <div className="saas-orb h-28 w-28 bg-sky-300/40 right-[12%] bottom-[16%]" style={{ animationDelay: '1.2s' }} />

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] gap-8 items-center">
        <div className="hidden lg:block text-slate-800 pl-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-white/80 px-3 py-1 text-xs font-medium text-emerald-800 shadow-sm mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            NexOrder
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
            Run your shop
            <span className="block text-emerald-700">from one calm dashboard.</span>
          </h1>
          <p className="mt-4 text-slate-600 max-w-md text-base leading-relaxed">
            Plans, roles, and order workflows — secured with real server authentication.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-500">
            <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Package className="h-5 w-5" />
            </div>
            Couriers · Inventory · AI order parse · Role gates
          </div>
        </div>

        <div className="uiverse-auth-card mx-auto w-full">
          <div className="uiverse-auth-inner">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Welcome back</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500">
                Demo accounts use password <code className="text-xs bg-slate-100 px-1 rounded">demo</code>.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@store.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
              ) : null}

              <Button type="submit" className="uiverse-cta w-full h-11 rounded-xl text-base" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-5">
              <p className="text-xs font-medium text-slate-500 mb-2">Quick demo accounts</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword('demo');
                      setError('');
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left hover:border-emerald-300 hover:bg-emerald-50/60 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-slate-800">{account.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{account.email}</div>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              New here?{' '}
              <Link to="/signup" className="font-semibold text-emerald-700 hover:text-emerald-600">
                Create a Free account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
