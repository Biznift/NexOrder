import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Cloud,
  Lock,
  Menu,
  Package,
  Shield,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/saas/AuthContext';
import { homeForRole } from '@/saas/ProtectedRoute';
import { formatCurrency } from '@/lib/utils';
import { SEED_PLANS } from '@/saas/seed';
import { HeroProductDemo } from '@/saas/components/landing/HeroProductDemo';
import { FeatureVisualDemos } from '@/saas/components/landing/FeatureVisualDemos';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#demo', label: 'Live demo' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

const HOW_STEPS = [
  {
    step: '01',
    title: 'Paste the customer chat',
    body: 'Drop Bangla or English order messages into New Order. AI extracts product, address, phone, and COD.',
  },
  {
    step: '02',
    title: 'Review on hold',
    body: 'Fix fields, attach inventory SKUs, then push the order into courier assign when ready.',
  },
  {
    step: '03',
    title: 'Book courier & ship',
    body: 'Send to Steadfast or other couriers, track webhooks, and move parcels through shipping to delivered.',
  },
  {
    step: '04',
    title: 'Grow the customer file',
    body: 'Every phone becomes one profile. Tag VIP / Loyal / New and export lists for campaigns.',
  },
];

const FEATURE_GRID = [
  {
    icon: Sparkles,
    title: 'AI order parsing',
    body: 'Turn messy chat into structured orders in seconds — built for BD ecommerce language.',
  },
  {
    icon: Package,
    title: 'Full order pipeline',
    body: 'Create → On Hold → Courier → Shipping → Delivered, with search and date filters.',
  },
  {
    icon: Zap,
    title: 'Courier integrations',
    body: 'Book parcels, refresh status, and accept Steadfast webhooks without spreadsheet chaos.',
  },
  {
    icon: Shield,
    title: 'Roles & team seats',
    body: 'Super Admin, Admin, owners, and staff — plan limits plus per-permission team gates.',
  },
  {
    icon: Lock,
    title: 'Tenant-safe auth',
    body: 'JWT login, shop-scoped data, and backups that only restore your tenant.',
  },
  {
    icon: Cloud,
    title: 'Cloudflare-ready',
    body: 'React Pages frontend + Hono Workers API + D1 — built to deploy edge-first.',
  },
];

const FAQ = [
  {
    q: 'What is NexOrder?',
    a: 'NexOrder is an order-management SaaS for online shops — AI message parsing, courier booking, inventory, customers, and role-based team access in one dashboard.',
  },
  {
    q: 'Can I try it without paying?',
    a: 'Yes. The Free plan includes AI parsing and up to 50 orders per month. Create an account from Sign up, or use demo logins on the Sign in page (password: demo).',
  },
  {
    q: 'Which couriers are supported?',
    a: 'Steadfast is fully wired (send + webhook + status). Pathao, Redx, and Carrybee connectors are available in the courier layer for Pro and Business shops.',
  },
  {
    q: 'How do customers get grouped?',
    a: 'Orders match on normalized phone numbers (+880 / 01…). Multiple orders with the same phone become one customer with history, categories, and export.',
  },
  {
    q: 'Who can manage staff?',
    a: 'Shop owners invite team members, set feature permissions (orders, shipping, inventory, settings, etc.), and share generated passwords securely.',
  },
];

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-4 text-left cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-semibold text-slate-900">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <p className="pb-4 text-sm leading-relaxed text-slate-600">{a}</p> : null}
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated, user, authReady } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const appHome = user ? homeForRole(user.role) : '/app';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="landing-page min-h-screen text-slate-900">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all ${
          scrolled ? 'border-b border-slate-200/80 bg-white/85 backdrop-blur-md shadow-sm' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Package className="h-4 w-4" />
            </span>
            <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">NexOrder</span>
          </a>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {authReady && isAuthenticated && user ? (
              <Button asChild>
                <Link to={appHome}>
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild className="uiverse-cta">
                  <Link to="/signup">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white md:hidden cursor-pointer"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              {authReady && isAuthenticated && user ? (
                <Button asChild className="w-full">
                  <Link to={appHome} onClick={() => setMenuOpen(false)}>
                    Open dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/login" onClick={() => setMenuOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/signup" onClick={() => setMenuOpen(false)}>
                      Start free
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main id="top">
        {/* HERO — brand + one headline + one line + CTAs + full-bleed product visual */}
        <section className="landing-hero relative overflow-hidden pt-16">
          <div className="landing-hero-glow" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-14 sm:pt-20 pb-6 text-center">
            <motion.p
              className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-slate-950"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
            >
              NexOrder
            </motion.p>
            <motion.h1
              className="mx-auto mt-4 max-w-3xl text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-emerald-800"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              Run every shop order from one calm dashboard.
            </motion.h1>
            <motion.p
              className="mx-auto mt-4 max-w-xl text-base sm:text-lg text-slate-600 leading-relaxed"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.14 }}
            >
              AI parses customer chats, couriers book parcels, and your team ships — without tab-hopping.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {authReady && isAuthenticated && user ? (
                <Button asChild size="lg" className="uiverse-cta h-12 rounded-xl px-7 text-base">
                  <Link to={appHome}>
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="uiverse-cta h-12 rounded-xl px-7 text-base">
                    <Link to="/signup">
                      Start free
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-7 text-base bg-white/70">
                    <Link to="/login">Sign in</Link>
                  </Button>
                </>
              )}
            </motion.div>
          </div>

          <HeroProductDemo />
        </section>

        {/* Features overview */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Features</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight">
                Everything your order desk needs
              </h2>
              <p className="mt-3 max-w-2xl text-slate-600">
                From messy Facebook comments to delivered parcels — NexOrder keeps the full loop in one place.
              </p>
            </FadeIn>

            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_GRID.map((f, i) => {
                const Icon = f.icon;
                return (
                  <FadeIn key={f.title} delay={i * 0.05}>
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-emerald-100/80 bg-emerald-50/40 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">How it works</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight">
                Four steps from chat to doorstep
              </h2>
              <p className="mt-3 max-w-2xl text-slate-600">
                Designed for Bangladesh ecommerce shops that live in Messenger, WhatsApp, and courier dashboards.
              </p>
            </FadeIn>

            <ol className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {HOW_STEPS.map((s, i) => (
                <FadeIn key={s.step} delay={i * 0.07}>
                  <li>
                    <div className="font-[family-name:var(--font-display)] text-4xl font-bold text-emerald-200">
                      {s.step}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                  </li>
                </FadeIn>
              ))}
            </ol>
          </div>
        </section>

        {/* Interactive visual demos */}
        <section id="demo" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Visualization</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight">
                See what you can do
              </h2>
              <p className="mt-3 max-w-2xl text-slate-600">
                Click a capability to preview how AI parsing, pipeline, couriers, customers, inventory, and team
                permissions look in practice.
              </p>
            </FadeIn>
            <div className="mt-10">
              <FadeIn delay={0.08}>
                <FeatureVisualDemos />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-y border-slate-200 bg-slate-50/80 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pricing</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight">
                Simple plans that grow with the shop
              </h2>
              <p className="mt-3 max-w-2xl text-slate-600">
                Start free. Unlock inventory, courier APIs, analytics, and team seats when you scale.
              </p>
            </FadeIn>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {SEED_PLANS.filter((p) => p.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((plan, i) => {
                  const featured = plan.slug === 'pro';
                  const rows: Array<[string, string | boolean]> = [
                    [
                      'Orders / month',
                      plan.features.maxOrdersPerMonth === -1
                        ? 'Unlimited'
                        : String(plan.features.maxOrdersPerMonth),
                    ],
                    ['AI order parsing', plan.features.aiOrderParsing],
                    ['Inventory', plan.features.inventory],
                    ['Courier APIs', plan.features.courierIntegrations],
                    ['Analytics', plan.features.analytics],
                    [
                      'Team seats',
                      plan.features.teamMembers === -1 ? 'Unlimited' : String(plan.features.teamMembers),
                    ],
                    ['Priority support', plan.features.prioritySupport],
                  ];
                  return (
                    <FadeIn key={plan.id} delay={i * 0.06}>
                      <div
                        className={`flex h-full flex-col rounded-3xl border p-6 ${
                          featured
                            ? 'border-emerald-500 bg-white shadow-[0_24px_60px_-28px_rgba(5,150,105,0.45)] ring-1 ring-emerald-500/30'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                          {featured ? <Badge>Most popular</Badge> : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                        <div className="mt-5">
                          <span className="font-[family-name:var(--font-display)] text-4xl font-bold">
                            {formatCurrency(plan.priceMonthly)}
                          </span>
                          <span className="text-sm text-slate-500">/mo</span>
                        </div>
                        <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                          {rows.map(([label, value]) => (
                            <li key={label} className="flex items-center justify-between gap-3">
                              <span className="text-slate-600">{label}</span>
                              {typeof value === 'boolean' ? (
                                value ? (
                                  <Check className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )
                              ) : (
                                <span className="font-medium text-slate-900">{value}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                        <Button asChild className={`mt-6 w-full ${featured ? 'uiverse-cta' : ''}`} variant={featured ? 'default' : 'outline'}>
                          <Link to="/signup">{plan.priceMonthly === 0 ? 'Create free account' : 'Get started'}</Link>
                        </Button>
                      </div>
                    </FadeIn>
                  );
                })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <FadeIn>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">FAQ</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight">
                Common questions
              </h2>
            </FadeIn>
            <FadeIn delay={0.08} className="mt-8">
              {FAQ.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </FadeIn>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <FadeIn>
              <div className="landing-cta-band relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16 text-center">
                <div className="relative z-10">
                  <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight text-white">
                    Ready to tidy up order chaos?
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-emerald-50/90">
                    Spin up a Free shop in minutes — or sign in with a demo account and click through the full
                    pipeline.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Button asChild size="lg" className="h-12 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 px-7">
                      <Link to="/signup">
                        Start free
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-xl border-white/40 bg-transparent text-white hover:bg-white/10 px-7"
                    >
                      <Link to="/login">Try demo login</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Package className="h-4 w-4" />
            </span>
            <span className="font-[family-name:var(--font-display)] font-bold">NexOrder</span>
          </div>
          <p className="text-sm text-slate-500">Order management for modern BD shops · AI · Couriers · Teams</p>
          <div className="flex gap-4 text-sm">
            <Link to="/login" className="text-slate-600 hover:text-emerald-700">
              Sign in
            </Link>
            <Link to="/signup" className="text-slate-600 hover:text-emerald-700">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
