import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bot,
  Check,
  MapPin,
  Package,
  Phone,
  Shield,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type DemoKey = 'ai' | 'pipeline' | 'courier' | 'customers' | 'inventory' | 'team';

const TABS: { key: DemoKey; label: string; icon: typeof Bot }[] = [
  { key: 'ai', label: 'AI parsing', icon: Bot },
  { key: 'pipeline', label: 'Order pipeline', icon: Package },
  { key: 'courier', label: 'Couriers', icon: Truck },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'inventory', label: 'Inventory', icon: Warehouse },
  { key: 'team', label: 'Team & roles', icon: Shield },
];

function AiDemo() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer message</p>
        <motion.p
          className="mt-3 font-mono text-sm leading-relaxed text-slate-700"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ভাই আসসালামু আলাইকুম। ১টা ব্ল্যাক হুডি L size, ঠিকানা উত্তরা সেক্টর ৭ রোড ১২। ফোন 01711XXXXXX। COD ১৪৫০ টাকা।
        </motion.p>
      </div>
      <div className="space-y-2.5">
        {[
          ['Product', 'Black Hoodie · L'],
          ['Qty', '1'],
          ['Address', 'Uttara Sec-7, Road 12'],
          ['Phone', '01711XXXXXX'],
          ['Payment', 'COD ৳1,450'],
        ].map(([k, v], i) => (
          <motion.div
            key={k}
            className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-sm"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 * i }}
          >
            <span className="text-slate-500">{k}</span>
            <span className="font-semibold text-slate-900">{v}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PipelineDemo() {
  const stages = [
    { name: 'New', desc: 'Paste & extract', tone: 'border-emerald-400 bg-emerald-50' },
    { name: 'On Hold', desc: 'Review / edit', tone: 'border-amber-300 bg-amber-50' },
    { name: 'Assign', desc: 'Pick courier', tone: 'border-sky-300 bg-sky-50' },
    { name: 'Ship', desc: 'Track parcel', tone: 'border-indigo-300 bg-indigo-50' },
    { name: 'Done', desc: 'Delivered', tone: 'border-teal-300 bg-teal-50' },
  ];
  return (
    <div className="relative">
      <div className="absolute left-4 right-4 top-[28px] hidden h-px bg-gradient-to-r from-emerald-300 via-sky-300 to-teal-300 sm:block" />
      <div className="grid gap-3 sm:grid-cols-5">
        {stages.map((s, i) => (
          <motion.div
            key={s.name}
            className={cn('relative rounded-2xl border-2 p-3 text-center', s.tone)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-800 shadow-sm">
              {i + 1}
            </div>
            <div className="text-sm font-bold text-slate-900">{s.name}</div>
            <div className="mt-0.5 text-[11px] text-slate-600">{s.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CourierDemo() {
  return (
    <div className="space-y-3">
      {[
        { name: 'Steadfast', id: 'SF-94821', status: 'In transit', progress: 72 },
        { name: 'Pathao', id: 'PT-33102', status: 'Booked', progress: 35 },
        { name: 'Redx', id: 'RX-77110', status: 'Delivered', progress: 100 },
      ].map((row, i) => (
        <motion.div
          key={row.id}
          className="rounded-2xl border border-slate-200 bg-white p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-slate-900">{row.name}</span>
              <Badge variant="secondary">{row.id}</Badge>
            </div>
            <span className="text-sm text-slate-600">{row.status}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${row.progress}%` }}
              transition={{ duration: 0.8, delay: 0.15 + i * 0.1 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function CustomersDemo() {
  const rows = [
    { name: 'Rafi Ahmed', phone: '01818…', cat: 'VIP', orders: 14, spend: '৳42,800' },
    { name: 'Nusrat Jahan', phone: '01711…', cat: 'Loyal', orders: 8, spend: '৳18,200' },
    { name: 'Karim Store', phone: '01999…', cat: 'New', orders: 1, spend: '৳950' },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.5fr_0.7fr] gap-2 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span>Customer</span>
        <span>Phone</span>
        <span>Category</span>
        <span>Orders</span>
        <span>Paid</span>
      </div>
      {rows.map((r, i) => (
        <motion.div
          key={r.phone}
          className="grid grid-cols-[1.2fr_0.8fr_0.6fr_0.5fr_0.7fr] gap-2 border-t border-slate-100 px-4 py-3 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.08 }}
        >
          <span className="font-medium text-slate-900">{r.name}</span>
          <span className="flex items-center gap-1 text-slate-600">
            <Phone className="h-3 w-3" />
            {r.phone}
          </span>
          <Badge variant={r.cat === 'VIP' ? 'warning' : r.cat === 'New' ? 'info' : 'default'}>{r.cat}</Badge>
          <span className="text-slate-700">{r.orders}</span>
          <span className="font-semibold text-slate-900">{r.spend}</span>
        </motion.div>
      ))}
      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-500">
        Export filtered lists as CSV or Excel · phone-normalized profiles
      </div>
    </div>
  );
}

function InventoryDemo() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { sku: 'HOODIE-BLK-L', stock: 42, low: false },
        { sku: 'MUG-CERAMIC', stock: 8, low: true },
        { sku: 'TEE-NAVY-M', stock: 120, low: false },
      ].map((item, i) => (
        <motion.div
          key={item.sku}
          className="rounded-2xl border border-slate-200 bg-white p-4"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <Package className="mb-3 h-5 w-5 text-emerald-600" />
          <div className="font-mono text-xs text-slate-500">{item.sku}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{item.stock}</div>
          <div className="text-xs text-slate-500">in stock</div>
          {item.low ? (
            <Badge variant="danger" className="mt-3">
              Low stock
            </Badge>
          ) : (
            <Badge className="mt-3">Healthy</Badge>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function TeamDemo() {
  const perms = [
    ['Create orders', true],
    ['Courier assign', true],
    ['Inventory', false],
    ['Settings', false],
    ['Manage team', false],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold">
            SA
          </div>
          <div>
            <div className="font-semibold text-slate-900">Sadia · Staff</div>
            <div className="text-xs text-slate-500">team_member · Rifa Store</div>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Owners invite staff with generated passwords and per-feature permission gates.
        </p>
      </div>
      <div className="space-y-2">
        {perms.map(([label, on], i) => (
          <motion.div
            key={label}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <span className="text-slate-700">{label}</span>
            {on ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Check className="h-4 w-4" /> Allowed
              </span>
            ) : (
              <span className="text-slate-400">Locked</span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const DEMO_COPY: Record<DemoKey, { title: string; body: string }> = {
  ai: {
    title: 'Paste a message. Get a clean order.',
    body: 'Bangla or English customer chats become structured fields — product, address, phone, COD — ready for review.',
  },
  pipeline: {
    title: 'One workflow from create to delivered.',
    body: 'Move orders through On Hold → Courier assign → Shipping → Delivered without losing context.',
  },
  courier: {
    title: 'Book and track parcels from the same desk.',
    body: 'Steadfast, Pathao, Redx and more — send parcels, read webhooks, and refresh status without leaving NexOrder.',
  },
  customers: {
    title: 'Phone-matched customer profiles that grow with every order.',
    body: 'Normalize +880 / 01… numbers, auto-tag VIP / Loyal / New, then export filtered lists as CSV or Excel.',
  },
  inventory: {
    title: 'Stock that stays in sync with fulfillment.',
    body: 'Pro and Business plans unlock inventory so SKUs, stock levels, and order picks stay aligned.',
  },
  team: {
    title: 'Roles that match how your shop actually works.',
    body: 'Super Admin, Admin, shop owners, and team members — each with plan gates and fine-grained permissions.',
  },
};

function DemoBody({ demo }: { demo: DemoKey }) {
  switch (demo) {
    case 'ai':
      return <AiDemo />;
    case 'pipeline':
      return <PipelineDemo />;
    case 'courier':
      return <CourierDemo />;
    case 'customers':
      return <CustomersDemo />;
    case 'inventory':
      return <InventoryDemo />;
    case 'team':
      return <TeamDemo />;
  }
}

export function FeatureVisualDemos() {
  const [active, setActive] = useState<DemoKey>('ai');
  const copy = DEMO_COPY[active];

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer',
                selected
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
          >
            <h3 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-slate-900">
              {copy.title}
            </h3>
            <p className="mt-2 max-w-2xl text-slate-600 leading-relaxed">{copy.body}</p>
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)]">
              <DemoBody demo={active} />
            </div>
            {active === 'courier' ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                Webhooks update parcel status automatically when configured.
              </p>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
