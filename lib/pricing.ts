export type SaleType = "retail" | "wholesale";

export const SALE_TYPES: readonly SaleType[] = ["retail", "wholesale"] as const;

/** Rounds to 2 decimals, killing float drift like 0.1 + 0.2. */
export function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

type PricedProduct = { sellingPrice: number; wholesalePrice?: number | null };

/**
 * Resolves the price a product sells at under a given sale type.
 * Wholesale falls back to the retail price when no wholesale price is set,
 * so products created before wholesale pricing existed keep working.
 */
export function unitPriceFor(product: PricedProduct, saleType: SaleType) {
  if (saleType === "wholesale") {
    const wholesale = Number(product.wholesalePrice) || 0;
    if (wholesale > 0) return wholesale;
  }
  return Number(product.sellingPrice) || 0;
}

export type TotalsItem = {
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
};

export function lineTotalFor(item: TotalsItem) {
  const base = Math.max(item.quantity * item.unitPrice - item.discount, 0);
  return round2(base + (base * item.taxRate) / 100);
}

export type SaleTotalsInput = {
  items: TotalsItem[];
  discountType: "flat" | "percentage";
  /** Manual order discount only: rupees when flat, percent when percentage. */
  discountValue: number;
  couponDiscount?: number;
  /** Customer group discount as a percent; the amount is derived from it. */
  groupDiscountPercent?: number;
  pointsRedeemed?: number;
};

export type SaleTotals = {
  subtotal: number;
  itemDiscount: number;
  orderDiscount: number;
  couponDiscount: number;
  groupDiscount: number;
  pointsRedeemed: number;
  /** Every discount, in rupees. This is the number reports should sum. */
  discountTotal: number;
  /** Kept for existing callers that read `.discount`; same as discountTotal. */
  discount: number;
  tax: number;
  taxTotal: number;
  /** Base the coupon percentage applies to, shared with /api/coupons/validate. */
  couponBase: number;
  grandTotal: number;
};

/**
 * The one place sale money is computed. The POS renders from this and
 * processCheckout re-derives from it, so the client can never post totals
 * the server would not have produced itself.
 */
export function computeSaleTotals(input: SaleTotalsInput): SaleTotals {
  const items = input.items ?? [];
  const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const itemDiscount = round2(items.reduce((sum, item) => sum + (Number(item.discount) || 0), 0));

  const rawDiscountValue = Math.max(Number(input.discountValue) || 0, 0);
  const orderDiscount =
    input.discountType === "percentage"
      ? round2((subtotal * Math.min(rawDiscountValue, 100)) / 100)
      : round2(Math.min(rawDiscountValue, subtotal));

  const taxTotal = round2(
    items.reduce((sum, item) => {
      const base = Math.max(item.quantity * item.unitPrice - item.discount, 0);
      return sum + (base * item.taxRate) / 100;
    }, 0),
  );

  const couponBase = round2(subtotal - orderDiscount + taxTotal);
  const couponDiscount = round2(Math.max(Number(input.couponDiscount) || 0, 0));

  const groupBase = Math.max(subtotal - itemDiscount - orderDiscount, 0);
  const groupPercent = Math.min(Math.max(Number(input.groupDiscountPercent) || 0, 0), 100);
  const groupDiscount = round2((groupBase * groupPercent) / 100);

  const pointsRedeemed = Math.max(Math.floor(Number(input.pointsRedeemed) || 0), 0);

  const discountTotal = round2(itemDiscount + orderDiscount + couponDiscount + groupDiscount + pointsRedeemed);
  const grandTotal = round2(Math.max(subtotal + taxTotal - discountTotal, 0));

  return {
    subtotal,
    itemDiscount,
    orderDiscount,
    couponDiscount,
    groupDiscount,
    pointsRedeemed,
    discountTotal,
    discount: discountTotal,
    tax: taxTotal,
    taxTotal,
    couponBase,
    grandTotal,
  };
}

/** Money comparison tolerance for validating client-submitted figures. */
export const MONEY_EPSILON = 0.01;

export function moneyMatches(a: number, b: number) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= MONEY_EPSILON;
}
