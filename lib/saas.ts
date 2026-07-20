import { getValidatedPlatformPaymentAccounts } from "@/lib/payment-env";

export const SHOP_PLANS = {
  monthly: {
    id: "monthly" as const,
    label: "1 Month",
    amount: 1000,
    durationHours: 24 * 30,
    description: "Full shop access for 30 days.",
  },
  yearly: {
    id: "yearly" as const,
    label: "1 Year",
    amount: 11000,
    discount: 1000,
    durationHours: 24 * 365,
    description: "Full shop access for 365 days. Save Rs. 1,000 vs monthly billing.",
  },
} as const;

export type ShopPlanId = keyof typeof SHOP_PLANS;
export type ShopPaymentMethod = "easypaisa" | "jazzcash" | "bank";
export type ShopStatus = "pending" | "active" | "expired" | "suspended" | "rejected";
export type ShopPaymentStatus = "pending" | "approved" | "rejected";

export function getPlanExpiry(plan: ShopPlanId, from = new Date()) {
  const hours = SHOP_PLANS[plan].durationHours;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function getPlatformPaymentAccounts() {
  return getValidatedPlatformPaymentAccounts();
}

export function slugifyShopName(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `shop-${Date.now().toString(36)}`;
}

export function isShopAccessAllowed(shop: { status: string; expiresAt?: Date | string | null }) {
  if (shop.status !== "active") return false;
  if (!shop.expiresAt) return false;
  return new Date(shop.expiresAt).getTime() > Date.now();
}

/** Whole calendar days remaining until expiry (0 = expires today, negative = expired). */
export function getRemainingDays(expiresAt?: Date | string | null) {
  if (!expiresAt) return Number.NEGATIVE_INFINITY;
  const end = new Date(expiresAt);
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export type ExpiryWarningLevel = "ok" | "green" | "yellow" | "orange" | "red" | "expired";

export function getExpiryWarningLevel(remainingDays: number): ExpiryWarningLevel {
  if (!Number.isFinite(remainingDays) || remainingDays < 0) return "expired";
  if (remainingDays === 0) return "red";
  if (remainingDays === 1) return "orange";
  if (remainingDays === 2) return "yellow";
  if (remainingDays === 3) return "yellow";
  if (remainingDays <= 7) return "green";
  return "ok";
}

export function getExpiryWarningLabel(remainingDays: number) {
  if (!Number.isFinite(remainingDays) || remainingDays < 0) return "Package Expired";
  if (remainingDays === 0) return "⚠ Package expires Today";
  if (remainingDays === 1) return "⚠ Package expires in 1 day";
  return `⚠ Package expires in ${remainingDays} days`;
}

export function shouldBlinkExpiry(remainingDays: number) {
  return Number.isFinite(remainingDays) && remainingDays <= 3;
}
