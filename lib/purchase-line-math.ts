export type PurchaseDiscountType = "flat" | "flat_per_piece" | "percentage";

export type PurchaseLineCalcInput = {
  quantity: number;
  cost: number;
  discountType: PurchaseDiscountType;
  discountValue: number;
  salesTaxType: "flat" | "percentage";
  salesTaxValue: number;
};

export type PurchaseLineAmounts = {
  grossAmount: number;
  discountAmount: number;
  salesTaxAmount: number;
  netAmount: number;
};

export function calcPurchaseLineAmounts(line: PurchaseLineCalcInput): PurchaseLineAmounts {
  const grossAmount = line.quantity * line.cost;
  const discountAmount =
    line.discountType === "percentage"
      ? (grossAmount * line.discountValue) / 100
      : line.discountType === "flat_per_piece"
        ? line.quantity * line.discountValue
        : line.discountValue;
  const afterDiscount = Math.max(grossAmount - discountAmount, 0);
  const salesTaxAmount = line.salesTaxType === "percentage" ? (afterDiscount * line.salesTaxValue) / 100 : line.salesTaxValue;
  const netAmount = afterDiscount + salesTaxAmount;
  return { grossAmount, discountAmount, salesTaxAmount, netAmount };
}

export function aggregatePurchaseLines(
  lines: Array<Pick<PurchaseLineAmounts, "grossAmount" | "discountAmount" | "salesTaxAmount" | "netAmount">>,
) {
  const subtotal = lines.reduce((sum, line) => sum + line.grossAmount, 0);
  const discountAmount = lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const salesTaxAmount = lines.reduce((sum, line) => sum + line.salesTaxAmount, 0);
  const grandTotal = lines.reduce((sum, line) => sum + line.netAmount, 0);
  return { subtotal, discountAmount, salesTaxAmount, grandTotal };
}
