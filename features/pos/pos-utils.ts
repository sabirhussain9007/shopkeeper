import type { CartItem, PaymentMethod } from "@/types";
import { requiresFullPayment } from "@/types";
import { createInvoiceNumber, totals } from "@/lib/utils";

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

export function normalizePaymentReference(value: string) {
  return value.trim();
}

type BuildSaleParams = {
  invoiceNumber: string;
  customerId?: string;
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
  groupDiscount?: number;
  pointsRedeemed?: number;
};

function lineTotal(item: CartItem) {
  const base = Math.max(item.quantity * item.unitPrice - item.discount, 0);
  return base + (base * item.taxRate) / 100;
}

export function buildSalePayload(params: BuildSaleParams) {
  const subtotal = params.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const orderDiscount = params.discountType === "percentage" ? (subtotal * params.discountValue) / 100 : params.discountValue;
  const computed = totals(params.items, orderDiscount);
  const couponDiscount = params.couponDiscount ?? 0;
  const groupDiscount = params.groupDiscount ?? 0;
  const pointsRedeemed = params.pointsRedeemed ?? 0;
  const grandTotal = Math.max(computed.grandTotal - couponDiscount - groupDiscount - pointsRedeemed, 0);
  const paidAmount = params.paymentMethod === "credit" ? 0 : requiresFullPayment(params.paymentMethod) ? grandTotal : params.paidAmount;
  const noteParts = [
    params.orderNotes?.trim(),
    params.paymentReference?.trim() ? `Ref: ${normalizePaymentReference(params.paymentReference)}` : "",
    params.couponCode ? `Coupon: ${params.couponCode}` : "",
    groupDiscount > 0 ? `Group discount: ${groupDiscount}` : "",
    pointsRedeemed > 0 ? `Points redeemed: ${pointsRedeemed}` : "",
  ].filter(Boolean);

  return {
    invoiceNumber: params.invoiceNumber,
    customer: params.customerId,
    items: params.items.map((item) => ({
      product: item.productId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      purchasePrice: item.purchasePrice,
      taxRate: item.taxRate,
      discount: item.discount,
      lineTotal: lineTotal(item),
    })),
    subtotal: computed.subtotal,
    discountType: params.discountType,
    discountValue: params.discountValue + couponDiscount + groupDiscount + pointsRedeemed,
    taxTotal: computed.tax,
    grandTotal,
    paidAmount,
    changeDue: Math.max(paidAmount - grandTotal, 0),
    paymentMethod: params.paymentMethod,
    status: "completed" as const,
    notes: noteParts.join(" · ") || "",
    couponCode: params.couponCode ?? "",
    pointsRedeemed,
    groupDiscount,
    chequeNumber: params.paymentMethod === "cheque" ? params.chequeNumber?.trim() ?? "" : "",
    bankName: ["cheque", "bank"].includes(params.paymentMethod)
      ? params.bankName?.trim() ?? ""
      : "",
    chequeDate: params.paymentMethod === "cheque" ? params.chequeDate ?? null : null,
  };
}

export function productToCartItem(product: {
  _id: string;
  productName: string;
  sku: string;
  barcode?: string;
  sellingPrice: number;
  purchasePrice: number;
  taxRate: number;
  quantity: number;
}): CartItem {
  return {
    productId: product._id,
    name: product.productName,
    sku: product.sku,
    barcode: product.barcode,
    quantity: 1,
    unitPrice: product.sellingPrice,
    purchasePrice: product.purchasePrice,
    taxRate: product.taxRate,
    discount: 0,
    stockAvailable: product.quantity,
  };
}

export { createInvoiceNumber };
