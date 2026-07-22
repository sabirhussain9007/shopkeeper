import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export {
  PAKISTAN_LOCALE,
  PAKISTAN_TIMEZONE,
  formatPakistanDate,
  formatPakistanDateInput,
  formatPakistanDateTime,
  formatPakistanMonth,
  formatPakistanMonthYear,
  formatPakistanTime,
  getPakistanDateParts,
  hasMeaningfulPakistanTime,
  pakistanMonthStart,
  pakistanStartOfDay,
  pakistanTodayKey,
  pakistanWeekStart,
  pakistanYearStart,
  parsePakistanDateInput,
  resolvePakistanEntryDate,
  resolvePakistanTimestamp,
} from "./datetime";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currency(value: number, locale = "en-PK", code = "PKR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function percentage(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;
}

export function createInvoiceNumber(prefix = "INV") {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function totals(items: Array<{ quantity: number; unitPrice: number; taxRate: number; discount: number }>, orderDiscount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const itemDiscount = items.reduce((sum, item) => sum + item.discount, 0);
  const taxable = Math.max(subtotal - itemDiscount - orderDiscount, 0);
  const tax = items.reduce((sum, item) => {
    const line = Math.max(item.quantity * item.unitPrice - item.discount, 0);
    return sum + (line * item.taxRate) / 100;
  }, 0);
  return {
    subtotal,
    discount: itemDiscount + orderDiscount,
    tax,
    grandTotal: taxable + tax,
  };
}
