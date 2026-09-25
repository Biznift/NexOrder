import { Order, OrderDateFilter } from '../types/order';

export const DATE_FILTER_OPTIONS: OrderDateFilter[] = [
  'TODAY',
  'YESTERDAY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
  'LIFETIME',
];

interface ParsedYMD {
  year: number;
  month: number; // 1-indexed (1..12)
  day: number;
}

function parseOrderDateYMD(order: Order): ParsedYMD | null {
  const dateStr = order.confirmDate || order.createdAt;
  if (!dateStr) return null;

  // Handles "2026-09-23" or "2026-09-23T20:41:28.294Z"
  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, month: m, day: d };
    }
  }

  // Fallback to Date object parsing
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return {
      year: fallback.getFullYear(),
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
    };
  }

  return null;
}

/**
 * Checks if an order matches the specified date filter
 */
export function matchesDateFilter(order: Order, filter: OrderDateFilter): boolean {
  if (filter === 'LIFETIME') return true;

  const orderYMD = parseOrderDateYMD(order);
  if (!orderYMD) return false;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  const curDay = now.getDate();

  switch (filter) {
    case 'TODAY': {
      return (
        orderYMD.year === curYear &&
        orderYMD.month === curMonth &&
        orderYMD.day === curDay
      );
    }

    case 'YESTERDAY': {
      const yDate = new Date(curYear, curMonth - 1, curDay - 1);
      return (
        orderYMD.year === yDate.getFullYear() &&
        orderYMD.month === yDate.getMonth() + 1 &&
        orderYMD.day === yDate.getDate()
      );
    }

    case 'WEEKLY': {
      // Current week: Monday to Sunday
      const todayDate = new Date(curYear, curMonth - 1, curDay);
      const dayOfWeek = todayDate.getDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const startOfWeek = new Date(curYear, curMonth - 1, curDay - diffToMonday, 0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const target = new Date(orderYMD.year, orderYMD.month - 1, orderYMD.day, 12, 0, 0);
      return target >= startOfWeek && target <= endOfWeek;
    }

    case 'MONTHLY': {
      return orderYMD.year === curYear && orderYMD.month === curMonth;
    }

    case 'YEARLY': {
      return orderYMD.year === curYear;
    }

    default:
      return true;
  }
}

/**
 * Filters an array of orders according to the date filter
 */
export function filterOrdersByDate(orders: Order[], filter: OrderDateFilter): Order[] {
  if (filter === 'LIFETIME') return orders;
  return orders.filter((o) => matchesDateFilter(o, filter));
}
