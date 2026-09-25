import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowDownAZ,
  ArrowUpAZ,
  Download,
  Loader2,
  Search,
  Settings2,
  Users,
  X,
  ChevronDown,
  Mail,
  Phone,
  Package,
  ShoppingBag,
} from 'lucide-react';
import {
  Customer,
  CustomerCategory,
  CustomerSortKey,
  Order,
  DEFAULT_CUSTOMER_CATEGORIES,
} from '../types/order';
import {
  exportCustomersFile,
  fetchCustomerDetail,
  fetchCustomers,
  saveCustomerCategories,
  type CustomersQuery,
} from '../api';

interface CustomersPageProps {
  onBack: () => void;
  canEditCategories?: boolean;
}

type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { value: CustomerSortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'orderCount', label: 'Order count' },
  { value: 'totalPaid', label: 'Paid amount' },
  { value: 'lastOrderAt', label: 'Last order time' },
  { value: 'firstOrderAt', label: 'First order time' },
  { value: 'category', label: 'Category' },
];

function formatMoney(n: number) {
  return `৳${Number(n || 0).toLocaleString('en-BD')}`;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  onBack,
  canEditCategories = false,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<CustomerCategory[]>(DEFAULT_CUSTOMER_CATEGORIES);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderId, setOrderId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sortBy, setSortBy] = useState<CustomerSortKey>('lastOrderAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [debounced, setDebounced] = useState({ q: '', name: '', email: '', phone: '', orderId: '' });

  const [selected, setSelected] = useState<Customer | null>(null);
  const [detailOrders, setDetailOrders] = useState<Order[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editCats, setEditCats] = useState<CustomerCategory[]>([]);
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced({ q, name, email, phone, orderId });
    }, 280);
    return () => clearTimeout(t);
  }, [q, name, email, phone, orderId]);

  const query: CustomersQuery = useMemo(
    () => ({
      q: debounced.q || undefined,
      name: debounced.name || undefined,
      email: debounced.email || undefined,
      phone: debounced.phone || undefined,
      orderId: debounced.orderId || undefined,
      categoryId: categoryId || undefined,
      sortBy,
      sortDir,
    }),
    [debounced, categoryId, sortBy, sortDir]
  );

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers(query);
      setCustomers(data.customers);
      setTotal(data.total);
      setCategories(data.categories?.length ? data.categories : DEFAULT_CUSTOMER_CATEGORIES);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const openDetail = async (customer: Customer) => {
    setSelected(customer);
    setDetailLoading(true);
    try {
      const data = await fetchCustomerDetail(customer.phoneKey);
      setSelected(data.customer);
      setDetailOrders(data.orders);
    } catch {
      setDetailOrders([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleSort = (key: CustomerSortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'name' || key === 'email' || key === 'phone' || key === 'category' ? 'asc' : 'desc');
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(format);
    try {
      await exportCustomersFile(format, query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const openCategoryEditor = () => {
    setEditCats(categories.map((c) => ({ ...c })));
    setCatError(null);
    setShowCategoryEditor(true);
  };

  const saveCategories = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatSaving(true);
    setCatError(null);
    try {
      const saved = await saveCustomerCategories(editCats);
      setCategories(saved);
      setShowCategoryEditor(false);
      await loadCustomers();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCatSaving(false);
    }
  };

  const SortIcon = sortDir === 'asc' ? ArrowUpAZ : ArrowDownAZ;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Customers
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Matched by phone ({total} customer{total === 1 ? '' : 's'}). Formats like +880… / 01… count as one.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
          {canEditCategories && (
            <button
              type="button"
              onClick={openCategoryEditor}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Categories</span>
            </button>
          )}
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting === 'xlsx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Excel
          </button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone, order #, products…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Column filters
          </button>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as CustomerSortKey)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? 'A → Z / low → high' : 'Z → A / high → low'}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            >
              <SortIcon className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Filter by name"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Filter by email"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Filter by phone"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Filter by order number"
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm sm:col-span-2"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryId('')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              !categoryId
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            All
          </button>
          {categories
            .filter((c) => c.enabled !== false)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id === categoryId ? '' : c.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  categoryId === c.id ? 'text-white border-transparent' : 'bg-white border-slate-200'
                }`}
                style={
                  categoryId === c.id
                    ? { backgroundColor: c.color }
                    : { color: c.color, borderColor: `${c.color}55` }
                }
              >
                {c.name}
              </button>
            ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl border border-red-100">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                {(
                  [
                    ['name', 'Name'],
                    ['phone', 'Phone'],
                    ['email', 'Email'],
                    ['orderCount', 'Orders'],
                    ['totalPaid', 'Paid'],
                    ['category', 'Category'],
                    ['lastOrderAt', 'Last order'],
                  ] as [CustomerSortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-3 py-2.5 font-semibold">
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1 hover:text-slate-800"
                    >
                      {label}
                      {sortBy === key && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading customers…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                    No customers yet. Create an order to add the first customer.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.phoneKey}
                    onClick={() => openDetail(c)}
                    className="border-b border-slate-100 hover:bg-emerald-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 font-semibold text-slate-800">{c.name || '—'}</td>
                    <td className="px-3 py-3 text-slate-600 font-mono text-xs">
                      <div>{c.phone}</div>
                      <div className="text-[10px] text-slate-400">key: {c.phoneKey}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{c.email || '—'}</td>
                    <td className="px-3 py-3 font-bold text-slate-800">{c.orderCount}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-700">{formatMoney(c.totalPaid)}</td>
                    <td className="px-3 py-3">
                      {c.categoryName ? (
                        <span
                          className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: c.categoryColor || '#64748b' }}
                        >
                          {c.categoryName}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {formatDate(c.lastOrderAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 truncate">{selected.name || 'Customer'}</h3>
              <button type="button" onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Orders</div>
                  <div className="text-xl font-bold text-slate-800">{selected.orderCount}</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <div className="text-[10px] uppercase text-emerald-700/70 font-semibold">Paid</div>
                  <div className="text-xl font-bold text-emerald-700">{formatMoney(selected.totalPaid)}</div>
                </div>
              </div>

              {selected.categoryName && (
                <span
                  className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: selected.categoryColor || '#64748b' }}
                >
                  {selected.categoryName}
                </span>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 text-slate-700">
                  <Phone className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-medium">{selected.phone}</div>
                    <div className="text-xs text-slate-400">Match key: {selected.phoneKey}</div>
                  </div>
                </div>
                {selected.email && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Mail className="w-4 h-4 text-slate-400" />
                    {selected.email}
                  </div>
                )}
                {selected.address && (
                  <div className="text-slate-600 text-xs leading-relaxed bg-slate-50 rounded-xl p-3">
                    {selected.address}
                  </div>
                )}
                {selected.productNames.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {selected.productNames.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Orders
                </h4>
                {detailLoading ? (
                  <div className="text-slate-500 text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Loading…
                  </div>
                ) : detailOrders.length === 0 ? (
                  <p className="text-sm text-slate-500">No orders found.</p>
                ) : (
                  <ul className="space-y-2">
                    {detailOrders.map((o) => (
                      <li key={o.id} className="border border-slate-200 rounded-xl p-3 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-slate-800">{o.orderId}</span>
                          <span className="text-xs font-semibold text-slate-500">{o.status}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{formatDate(o.createdAt)}</div>
                        <div className="text-emerald-700 font-semibold mt-1">
                          {formatMoney(Number(o.price) || 0)}
                        </div>
                        {o.product && <div className="text-xs text-slate-600 mt-1 truncate">{o.product}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category editor modal */}
      {showCategoryEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCategoryEditor(false)}
          />
          <form
            onSubmit={saveCategories}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Customer categories</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set min orders and/or paid amount. Highest priority match wins.
                </p>
              </div>
              <button type="button" onClick={() => setShowCategoryEditor(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {editCats.map((cat, idx) => (
                <div key={cat.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={cat.color}
                      onChange={(e) => {
                        const next = [...editCats];
                        next[idx] = { ...cat, color: e.target.value };
                        setEditCats(next);
                      }}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <input
                      value={cat.name}
                      onChange={(e) => {
                        const next = [...editCats];
                        next[idx] = { ...cat, name: e.target.value };
                        setEditCats(next);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={cat.enabled !== false}
                        onChange={(e) => {
                          const next = [...editCats];
                          next[idx] = { ...cat, enabled: e.target.checked };
                          setEditCats(next);
                        }}
                      />
                      On
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[11px] text-slate-500 space-y-1">
                      Min orders
                      <input
                        type="number"
                        min={0}
                        value={cat.minOrders}
                        onChange={(e) => {
                          const next = [...editCats];
                          next[idx] = { ...cat, minOrders: Math.max(0, Number(e.target.value) || 0) };
                          setEditCats(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                      />
                    </label>
                    <label className="text-[11px] text-slate-500 space-y-1">
                      Min paid ৳
                      <input
                        type="number"
                        min={0}
                        value={cat.minPaidAmount}
                        onChange={(e) => {
                          const next = [...editCats];
                          next[idx] = {
                            ...cat,
                            minPaidAmount: Math.max(0, Number(e.target.value) || 0),
                          };
                          setEditCats(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                      />
                    </label>
                    <label className="text-[11px] text-slate-500 space-y-1">
                      Priority
                      <input
                        type="number"
                        value={cat.priority}
                        onChange={(e) => {
                          const next = [...editCats];
                          next[idx] = { ...cat, priority: Number(e.target.value) || 0 };
                          setEditCats(next);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            {catError && <p className="text-sm text-red-600">{catError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCategoryEditor(false)}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={catSaving}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {catSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save categories
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
