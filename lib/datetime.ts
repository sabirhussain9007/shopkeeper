export const PAKISTAN_TIMEZONE = "Asia/Karachi";
export const PAKISTAN_LOCALE = "en-PK";

const PAKISTAN_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPakistanDateParts(value: DateInput = new Date()) {
  const date = toDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PAKISTAN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? 0),
    month: Number(parts.find((part) => part.type === "month")?.value ?? 0),
    day: Number(parts.find((part) => part.type === "day")?.value ?? 0),
  };
}

/** Midnight at the start of the calendar day in Pakistan (PKT). */
export function pakistanStartOfDay(value: DateInput = new Date()) {
  const parts = getPakistanDateParts(value);
  if (!parts) return new Date();
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - PAKISTAN_UTC_OFFSET_MS);
}

/** Monday-based week start in Pakistan (PKT). */
export function pakistanWeekStart(value: DateInput = new Date()) {
  const parts = getPakistanDateParts(value);
  const date = toDate(value);
  if (!parts || !date) return pakistanStartOfDay(value);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: PAKISTAN_TIMEZONE,
    weekday: "short",
  }).format(date);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[weekday.slice(0, 3)] ?? 0;
  const mondayDiff = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - PAKISTAN_UTC_OFFSET_MS - mondayDiff * 24 * 60 * 60 * 1000);
}

/** First day of the month in Pakistan (PKT). */
export function pakistanMonthStart(value: DateInput = new Date()) {
  const parts = getPakistanDateParts(value);
  if (!parts) return pakistanStartOfDay(value);
  return new Date(Date.UTC(parts.year, parts.month - 1, 1) - PAKISTAN_UTC_OFFSET_MS);
}

/** First day of the year in Pakistan (PKT). */
export function pakistanYearStart(value: DateInput = new Date()) {
  const parts = getPakistanDateParts(value);
  if (!parts) return pakistanStartOfDay(value);
  return new Date(Date.UTC(parts.year, 0, 1) - PAKISTAN_UTC_OFFSET_MS);
}

export function parsePakistanDateInput(key: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return pakistanStartOfDay(key);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day) - PAKISTAN_UTC_OFFSET_MS);
}

/** Date picker value → stored timestamp. Today keeps the current PKT time; other days use PKT midnight. */
export function resolvePakistanEntryDate(dateKey: string, now = new Date()) {
  if (!dateKey) return now;
  if (dateKey === pakistanTodayKey(now)) return now;
  return parsePakistanDateInput(dateKey);
}

export function hasMeaningfulPakistanTime(value: DateInput) {
  const date = toDate(value);
  if (!date) return false;
  // Legacy: HTML date values saved via new Date("YYYY-MM-DD") become UTC midnight (shows as 5:00 AM PKT).
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return false;
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PAKISTAN_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const second = Number(parts.find((part) => part.type === "second")?.value ?? 0);
  return !(hour === 0 && minute === 0 && second === 0);
}

export function resolvePakistanTimestamp(entryDate: DateInput, recordedAt?: DateInput) {
  if (hasMeaningfulPakistanTime(entryDate)) {
    return toDate(entryDate)!;
  }
  const recorded = toDate(recordedAt);
  if (recorded) return recorded;
  return toDate(entryDate) ?? new Date();
}

export function pakistanTodayKey(value: DateInput = new Date()) {
  return formatPakistanDateInput(value);
}

export function formatPakistanDateInput(value: DateInput) {
  const parts = getPakistanDateParts(value);
  if (!parts) return "";
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function formatPakistanDate(value: DateInput, fallback = "—") {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, {
    timeZone: PAKISTAN_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatPakistanTime(value: DateInput, fallback = "—") {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, {
    timeZone: PAKISTAN_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatPakistanDateTime(value: DateInput, fallback = "—") {
  const date = toDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, {
    timeZone: PAKISTAN_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatPakistanMonth(value: DateInput) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, {
    timeZone: PAKISTAN_TIMEZONE,
    month: "long",
  }).format(date);
}

export function formatPakistanMonthYear(month: number, year: number) {
  return new Intl.DateTimeFormat(PAKISTAN_LOCALE, {
    timeZone: PAKISTAN_TIMEZONE,
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}
