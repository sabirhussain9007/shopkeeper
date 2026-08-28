import type { CartItem, PaymentMethod, SaleType } from "@/types";
import { requiresFullPayment } from "@/types";
import { createInvoiceNumber } from "@/lib/utils";
import { computeSaleTotals, lineTotalFor, unitPriceFor } from "@/lib/pricing";

const PAYMENT_REFERENCE_MAX = 120;

export function validatePaymentReference(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Payment reference is required.";
  if (/^\d{4}$/.test(trimmed)) return null;
  if (trimmed.length < 3) {
    return "Enter at least 3 characters (transaction ID, last 4 digits, or bank ref).";
  }
  if (trimmed.length > PAYMENT_REFERENCE_MAX) {
    return `Payment reference must be ${PAYMENT_REFERENCE_MAX} characters or less.`;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9\s\-_/]*$/.test(trimmed)) {
    return "Use letters, numbers, spaces, or - _ / only.";
  }
  return null;
}

export function validateWalletLastFourDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "Last 4 digits are required.";
  if (digits.length !== 4) return "Enter exactly 4 digits.";
  return null;
}

export function normalizePaymentReference(value: string) {
  return value.trim();
}

type BuildSaleParams = {
  invoiceNumber: string;
  customerId?: string;
  saleType: SaleType;
  items: CartItem[];
  discountType: "flat" | "percentage";
  discountValue: number;
  couponCode?: string;
  couponDiscount?: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  orderNotes?: string;
  paymentReference?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string | Date | null;
  groupDiscountPercent?: number;
  pointsRedeemed?: number;
};

export function buildSalePayload(params: BuildSaleParams) {
  const computed = computeSaleTotals({
    items: params.items,
    discountType: params.discountType,
    discountValue: params.discountValue,
    couponDiscount: params.couponDiscount ?? 0,
    groupDiscountPercent: params.groupDiscountPercent ?? 0,
    pointsRedeemed: params.pointsRedeemed ?? 0,
  });
  const { grandTotal } = computed;
  const paidAmount = params.paymentMethod === "credit" ? 0 : requiresFullPayment(params.paymentMethod) ? grandTotal : params.paidAmount;
  const noteParts = [
    params.orderNotes?.trim(),
    params.paymentReference?.trim() ? `Ref: ${normalizePaymentReference(params.paymentReference)}` : "",
    params.couponCode ? `Coupon: ${params.couponCode}` : "",
    computed.groupDiscount > 0 ? `Group discount: ${computed.groupDiscount}` : "",
    computed.pointsRedeemed > 0 ? `Points redeemed: ${computed.pointsRedeemed}` : "",
  ].filter(Boolean);

  return {
    invoiceNumber: params.invoiceNumber,
    customer: params.customerId,
    saleType: params.saleType,
    items: params.items.map((item) => ({
      product: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      purchasePrice: item.purchasePrice,
      taxRate: item.taxRate,
      discount: item.discount,
      lineTotal: lineTotalFor(item),
    })),
    subtotal: computed.subtotal,
    discountType: params.discountType,
    // The manual order discount only. Coupon, group, and points ride in their
    // own fields so nothing mixes a percentage with rupee amounts.
    discountValue: params.discountValue,
    couponDiscount: computed.couponDiscount,
    groupDiscount: computed.groupDiscount,
    pointsRedeemed: computed.pointsRedeemed,
    taxTotal: computed.taxTotal,
    grandTotal,
    paidAmount,
    changeDue: Math.max(paidAmount - grandTotal, 0),
    paymentMethod: params.paymentMethod,
    status: "completed" as const,
    notes: noteParts.join(" · ") || "",
    couponCode: params.couponCode ?? "",
    chequeNumber: params.paymentMethod === "cheque" ? params.chequeNumber?.trim() ?? "" : "",
    bankName: ["cheque", "bank", "easypaisa", "jazzcash"].includes(params.paymentMethod)
      ? params.bankName?.trim() ?? ""
      : "",
    chequeDate: params.paymentMethod === "cheque" ? params.chequeDate ?? null : null,
  };
}

export function productToCartItem(
  product: {
    _id: string;
    productName: string;
    sku: string;
    barcode?: string;
    sellingPrice: number;
    wholesalePrice?: number;
    purchasePrice: number;
    taxRate: number;
    quantity: number;
  },
  saleType: SaleType = "retail",
): CartItem {
  return {
    productId: product._id,
    name: product.productName,
    sku: product.sku,
    barcode: product.barcode,
    quantity: 1,
    unitPrice: unitPriceFor(product, saleType),
    sellingPrice: product.sellingPrice,
    wholesalePrice: product.wholesalePrice ?? 0,
    purchasePrice: product.purchasePrice,
    taxRate: product.taxRate,
    discount: 0,
    stockAvailable: product.quantity,
  };
}

export { createInvoiceNumber };
