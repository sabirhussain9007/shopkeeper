import type { CartItem, PaymentMethod } from "@/types";
import { createInvoiceNumber, totals } from "@/lib/utils";

type BuildSaleParams = {
  invoiceNumber: string;
  customerId?: string;
  items: CartItem[];
  discountType: "flat" | "percentage";
  discountValue: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
};

function lineTotal(item: CartItem) {
  const base = Math.max(item.quantity * item.unitPrice - item.discount, 0);
  return base + (base * item.taxRate) / 100;
}

export function buildSalePayload(params: BuildSaleParams) {
  const subtotal = params.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const orderDiscount = params.discountType === "percentage" ? (subtotal * params.discountValue) / 100 : params.discountValue;
  const computed = totals(params.items, orderDiscount);

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
    discountValue: params.discountValue,
    taxTotal: computed.tax,
    grandTotal: computed.grandTotal,
    paidAmount: params.paymentMethod === "credit" ? 0 : params.paidAmount,
    changeDue: Math.max(params.paidAmount - computed.grandTotal, 0),
    paymentMethod: params.paymentMethod,
    status: "completed" as const,
    notes: "",
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
