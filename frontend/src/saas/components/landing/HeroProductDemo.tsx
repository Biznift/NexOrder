import { motion } from 'motion/react';
import {
  Clock,
  PackageCheck,
  Send,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';

const pipeline = [
  { label: 'On Hold', count: 12, icon: Clock, tone: 'bg-amber-100 text-amber-800' },
  { label: 'Courier', count: 7, icon: Send, tone: 'bg-sky-100 text-sky-800' },
  { label: 'Shipping', count: 18, icon: Truck, tone: 'bg-indigo-100 text-indigo-800' },
  { label: 'Delivered', count: 94, icon: PackageCheck, tone: 'bg-emerald-100 text-emerald-800' },
];

export function HeroProductDemo() {
  return (
    <div className="landing-hero-stage relative w-full overflow-hidden">
      <div className="absolute inset-0 landing-hero-mesh" aria-hidden />

      <motion.div
        className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 pb-10 pt-4"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      >
        <div className="landing-product-shell overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 bg-slate-950/40 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-3 text-xs font-medium tracking-wide text-slate-300">
              nexorder.app / dashboard
            </span>
          </div>

          <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
            <aside className="hidden border-r border-white/10 bg-slate-950/50 p-4 lg:block">
              <div className="mb-6 flex items-center gap-2 text-white">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight">
                  NexOrder
                </span>
              </div>
              <nav className="space-y-1.5 text-sm text-slate-400">
                {['Dashboard', 'New order', 'Customers', 'Inventory', 'Shipping'].map((item, i) => (
                  <div
                    key={item}
                    className={`rounded-lg px-3 py-2 ${i === 0 ? 'bg-emerald-500/20 text-emerald-200' : 'hover:bg-white/5'}`}
                  >
                    {item}
                  </div>
                ))}
              </nav>
            </aside>

            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
                    Live pipeline
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-white sm:text-2xl">
                    Today&apos;s order flow
                  </h3>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  <Users className="h-3.5 w-3.5 text-sky-300" />
                  248 customers · filter: Today
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {pipeline.map((stage, index) => {
                  const Icon = stage.icon;
                  return (
                    <motion.div
                      key={stage.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm"
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + index * 0.08, duration: 0.45 }}
                    >
                      <div className={`mb-3 inline-flex rounded-lg p-2 ${stage.tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-2xl font-bold text-white">{stage.count}</div>
                      <div className="text-xs text-slate-400">{stage.label}</div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <motion.div
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4"
                  animate={{ boxShadow: ['0 0 0 rgba(16,185,129,0)', '0 0 28px rgba(16,185,129,0.18)', '0 0 0 rgba(16,185,129,0)'] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="mb-2 flex items-center gap-2 text-emerald-200">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">AI order parse</span>
                  </div>
                  <p className="font-mono text-[11px] leading-relaxed text-slate-300 sm:text-xs">
                    &quot;ভাই ২টা মগ পাঠান, ঠিকানা মিরপুর ১০, ফোন 01818… COD 950&quot;
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Mug ×2', 'Mirpur 10', '01818…', 'COD ৳950'].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-md bg-slate-950/40 px-2 py-1 text-[11px] font-medium text-emerald-100"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </motion.div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Courier sync</p>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { name: 'Steadfast', status: 'Booked', ok: true },
                      { name: 'Pathao', status: 'Ready', ok: true },
                      { name: 'Redx', status: 'Webhook OK', ok: true },
                    ].map((c, i) => (
                      <motion.div
                        key={c.name}
                        className="flex items-center justify-between text-sm"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + i * 0.12 }}
                      >
                        <span className="text-slate-200">{c.name}</span>
                        <span className="text-emerald-300">{c.status}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
