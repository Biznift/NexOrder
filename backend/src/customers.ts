import type { Order, Customer, CustomerCategory, CustomerSortKey } from './types';
import { DEFAULT_CUSTOMER_CATEGORIES } from './types';

/**
 * Unique phone match key for BD-style numbers.
 * +8801818984883 / 01818984883 / 1818984883 → "1818984883"
 */
export function normalizePhoneKey(phone: string | null | undefined): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('880') && digits.length >= 13) {
    digits = digits.slice(3);
  }
  if (digits.startsWith('0') && digits.length >= 11) {
    digits = digits.slice(1);
  }
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}

export function phonesMatch(a: string, b: string): boolean {
  const ka = normalizePhoneKey(a);
  const kb = normalizePhoneKey(b);
  if (!ka || !kb || ka.length < 5 || kb.length < 5) return false;
  return ka === kb;
}

function orderPaidAmount(order: Order): number {
  const fromSummary = Number(order.price);
  if (Number.isFinite(fromSummary) && fromSummary > 0) return fromSummary;
  const products = Array.isArray(order.products) ? order.products : [];
  return products.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
}

function orderProductNames(order: Order): string[] {
  const products = Array.isArray(order.products) ? order.products : [];
  if (products.length > 0) {
    return products.map((p) => p.productName).filter(Boolean);
  }
  if (order.product) return [String(order.product)];
  return [];
}

export function resolveCustomerCategory(
  orderCount: number,
  totalPaid: number,
  categories: CustomerCategory[]
): CustomerCategory | null {
  const sorted = [...categories]
    .filter((c) => c.enabled !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const cat of sorted) {
    const minOrders = Math.max(0, Number(cat.minOrders) || 0);
    const minPaid = Math.max(0, Number(cat.minPaidAmount) || 0);
    const ordersOk = orderCount >= minOrders;
    const paidOk = totalPaid >= minPaid;
    // Both thresholds must be met when set (>0). If only one is set, that one applies.
    if (minOrders > 0 && minPaid > 0) {
      if (ordersOk && paidOk) return cat;
    } else if (minOrders > 0) {
      if (ordersOk) return cat;
    } else if (minPaid > 0) {
      if (paidOk) return cat;
    } else if (ordersOk) {
      return cat;
    }
  }
  return null;
}

export function buildCustomersFromOrders(
  orders: Order[],
  categories: CustomerCategory[] = DEFAULT_CUSTOMER_CATEGORIES
): Customer[] {
  const map = new Map<
    string,
    {
      phoneKey: string;
      name: string;
      email: string;
      phoneDisplay: string;
      address: string;
      orderIds: string[];
      orderCount: number;
      totalPaid: number;
      productSet: Set<string>;
      firstOrderAt: string;
      lastOrderAt: string;
      phonesSeen: Set<string>;
    }
  >();

  for (const order of orders) {
    const phoneKey = normalizePhoneKey(order.phone);
    if (!phoneKey || phoneKey.length < 5) continue;

    const paid = orderPaidAmount(order);
    const created = order.createdAt || order.updatedAt || '';
    const existing = map.get(phoneKey);

    if (!existing) {
      map.set(phoneKey, {
        phoneKey,
        name: order.customerName || '',
        email: (order as Order & { email?: string }).email || '',
        phoneDisplay: order.phone || phoneKey,
        address: order.address || '',
        orderIds: [order.orderId || order.id],
        orderCount: 1,
        totalPaid: paid,
        productSet: new Set(orderProductNames(order)),
        firstOrderAt: created,
        lastOrderAt: created,
        phonesSeen: new Set(order.phone ? [order.phone] : []),
      });
      continue;
    }

    existing.orderCount += 1;
    existing.totalPaid += paid;
    existing.orderIds.push(order.orderId || order.id);
    for (const name of orderProductNames(order)) existing.productSet.add(name);
    if (order.phone) existing.phonesSeen.add(order.phone);

    // Prefer newest non-empty name/email/address
    if (order.customerName?.trim()) existing.name = order.customerName.trim();
    const email = (order as Order & { email?: string }).email?.trim();
    if (email) existing.email = email;
    if (order.address?.trim()) existing.address = order.address.trim();
    if (order.phone) existing.phoneDisplay = order.phone;

    if (created) {
      if (!existing.firstOrderAt || created < existing.firstOrderAt) existing.firstOrderAt = created;
      if (!existing.lastOrderAt || created > existing.lastOrderAt) existing.lastOrderAt = created;
    }
  }

  const cats = categories?.length ? categories : DEFAULT_CUSTOMER_CATEGORIES;

  return Array.from(map.values()).map((row) => {
    const category = resolveCustomerCategory(row.orderCount, row.totalPaid, cats);
    return {
      id: row.phoneKey,
      phoneKey: row.phoneKey,
      name: row.name,
      email: row.email || undefined,
      phone: row.phoneDisplay,
      address: row.address || undefined,
      orderCount: row.orderCount,
      totalPaid: Math.round(row.totalPaid * 100) / 100,
      productNames: Array.from(row.productSet),
      orderIds: row.orderIds,
      firstOrderAt: row.firstOrderAt,
      lastOrderAt: row.lastOrderAt,
      categoryId: category?.id,
      categoryName: category?.name,
      categoryColor: category?.color,
    } satisfies Customer;
  });
}

export type CustomerListFilters = {
  q?: string;
  name?: string;
  email?: string;
  phone?: string;
  orderId?: string;
  categoryId?: string;
  sortBy?: CustomerSortKey;
  sortDir?: 'asc' | 'desc';
};

export function filterAndSortCustomers(
  customers: Customer[],
  filters: CustomerListFilters = {}
): Customer[] {
  const q = (filters.q || '').trim().toLowerCase();
  const nameF = (filters.name || '').trim().toLowerCase();
  const emailF = (filters.email || '').trim().toLowerCase();
  const phoneF = (filters.phone || '').trim();
  const phoneKeyF = phoneF ? normalizePhoneKey(phoneF) : '';
  const orderF = (filters.orderId || '').trim().toLowerCase();
  const categoryF = (filters.categoryId || '').trim();

  let list = customers.filter((c) => {
    if (categoryF && c.categoryId !== categoryF) return false;
    if (nameF && !(c.name || '').toLowerCase().includes(nameF)) return false;
    if (emailF && !(c.email || '').toLowerCase().includes(emailF)) return false;
    if (phoneKeyF) {
      const ck = normalizePhoneKey(c.phone) || c.phoneKey;
      if (!ck.includes(phoneKeyF) && !c.phoneKey.includes(phoneKeyF) && !(c.phone || '').includes(phoneF)) {
        return false;
      }
    }
    if (orderF && !c.orderIds.some((id) => id.toLowerCase().includes(orderF))) return false;

    if (q) {
      const hay = [
        c.name,
        c.email,
        c.phone,
        c.phoneKey,
        c.address,
        c.categoryName,
        ...c.productNames,
        ...c.orderIds,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q) && !c.phoneKey.includes(normalizePhoneKey(q))) return false;
    }
    return true;
  });

  const sortBy: CustomerSortKey = filters.sortBy || 'lastOrderAt';
  const dir = filters.sortDir === 'asc' ? 1 : -1;

  list = [...list].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name':
        cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
        break;
      case 'email':
        cmp = (a.email || '').localeCompare(b.email || '', undefined, { sensitivity: 'base' });
        break;
      case 'phone':
        cmp = (a.phoneKey || '').localeCompare(b.phoneKey || '');
        break;
      case 'orderCount':
        cmp = a.orderCount - b.orderCount;
        break;
      case 'totalPaid':
        cmp = a.totalPaid - b.totalPaid;
        break;
      case 'firstOrderAt':
        cmp = (a.firstOrderAt || '').localeCompare(b.firstOrderAt || '');
        break;
      case 'category':
        cmp = (a.categoryName || '').localeCompare(b.categoryName || '', undefined, {
          sensitivity: 'base',
        });
        break;
      case 'lastOrderAt':
      default:
        cmp = (a.lastOrderAt || '').localeCompare(b.lastOrderAt || '');
        break;
    }
    return cmp * dir;
  });

  return list;
}

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function customersToCsv(customers: Customer[]): string {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Phone Key',
    'Address',
    'Orders',
    'Total Paid',
    'Category',
    'Products',
    'Order IDs',
    'First Order',
    'Last Order',
  ];
  const lines = [headers.join(',')];
  for (const c of customers) {
    lines.push(
      [
        c.name,
        c.email || '',
        c.phone,
        c.phoneKey,
        c.address || '',
        c.orderCount,
        c.totalPaid,
        c.categoryName || '',
        c.productNames.join('; '),
        c.orderIds.join('; '),
        c.firstOrderAt,
        c.lastOrderAt,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\r\n');
}

export function customersToExcelXml(customers: Customer[]): string {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Phone Key',
    'Address',
    'Orders',
    'Total Paid',
    'Category',
    'Products',
    'Order IDs',
    'First Order',
    'Last Order',
  ];

  const esc = (v: unknown) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
  const rows = customers
    .map((c) => {
      const cells = [
        c.name,
        c.email || '',
        c.phone,
        c.phoneKey,
        c.address || '',
        c.orderCount,
        c.totalPaid,
        c.categoryName || '',
        c.productNames.join('; '),
        c.orderIds.join('; '),
        c.firstOrderAt,
        c.lastOrderAt,
      ]
        .map((v, i) => {
          const isNum = i === 5 || i === 6;
          return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(v)}</Data></Cell>`;
        })
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Customers">
  <Table>
   <Row>${headerRow}</Row>
   ${rows}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function normalizeCategories(input: unknown): CustomerCategory[] {
  if (!Array.isArray(input) || input.length === 0) {
    return DEFAULT_CUSTOMER_CATEGORIES.map((c) => ({ ...c }));
  }
  return input
    .map((raw, index) => {
      const c = raw as Partial<CustomerCategory>;
      const id = String(c.id || `cat_${index + 1}`).trim();
      if (!id) return null;
      return {
        id,
        name: String(c.name || id).trim() || id,
        minOrders: Math.max(0, Number(c.minOrders) || 0),
        minPaidAmount: Math.max(0, Number(c.minPaidAmount) || 0),
        color: String(c.color || '#64748b'),
        priority: Number.isFinite(Number(c.priority)) ? Number(c.priority) : index,
        enabled: c.enabled !== false,
      } satisfies CustomerCategory;
    })
    .filter(Boolean) as CustomerCategory[];
}
