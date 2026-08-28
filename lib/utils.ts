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

