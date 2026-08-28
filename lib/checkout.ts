import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Customer, LedgerEntry, Product, Sale, SaleItem } from "@/models";
import type { SaleInput } from "@/types";
import { pointsEarned, getCustomerGroupDiscountPercent } from "@/lib/customer-benefits";
import { computeSaleTotals, lineTotalFor, moneyMatches, unitPriceFor } from "@/lib/pricing";
import { validateCoupon } from "@/lib/coupons";

function creditAmount(method: SaleInput["paymentMethod"], grandTotal: number, paidAmount: number) {
  if (method === "credit") return grandTotal;
  if (method === "split") return Math.max(grandTotal - paidAmount, 0);
  return 0;
}

function isCreditPayment(method: SaleInput["paymentMethod"]) {
  return method === "credit" || method === "split";
}

const STALE_PRICING =
  "Pricing has changed since this cart was built. Refresh the product list and try again.";

export async function processCheckout(sale: SaleInput, cashierId: string, shopId: string) {
  await connectDb();

  const saleType = sale.saleType ?? "retail";

  // --- Stock and price enforcement -----------------------------------------
  // Every figure below is re-derived from the database. Nothing the client
  // sent about money is trusted; it is only compared, and a mismatch is a
  // hard failure so the cashier never charges a total they did not see.
  const productIds = sale.items.map((item) => item.product);
  const products = await Product.find(
    withShopFilter(shopId, { _id: { $in: productIds }, deletedAt: { $exists: false } }),
  ).lean();
  const productById = new Map(products.map((product) => [String(product._id), product]));

  const enforcedItems: Array<SaleInput["items"][number] & { lineTotal: number }> = [];
  for (const item of sale.items) {
    const product = productById.get(String(item.product));
    if (!product) return { ok: false as const, status: 404, error: `${item.name} no longer exists.` };
    if (product.quantity < item.quantity) {
      return { ok: false as const, status: 409, error: `${item.name} has insufficient stock.` };
    }

    const expectedUnitPrice = unitPriceFor(product, saleType);
    if (!moneyMatches(item.unitPrice, expectedUnitPrice)) {
      return {
        ok: false as const,
        status: 409,
        error: `${item.name} is priced at ${expectedUnitPrice} for a ${saleType} sale. Refresh the product list and try again.`,
      };
    }

    const enforced = {
      ...item,
      unitPrice: expectedUnitPrice,
      taxRate: product.taxRate ?? 0,
      purchasePrice: product.purchasePrice ?? item.purchasePrice ?? 0,
      lineTotal: 0,
    };
    enforced.lineTotal = lineTotalFor(enforced);
    if (!moneyMatches(item.lineTotal, enforced.lineTotal)) {
      return { ok: false as const, status: 409, error: STALE_PRICING };
    }
    enforcedItems.push(enforced);
  }

  // --- Discount enforcement -------------------------------------------------
  const totalsInput = {
    items: enforcedItems,
    discountType: sale.discountType,
    discountValue: sale.discountValue,
  };

  // The coupon percentage applies to the pre-coupon total, so derive that
  // first, then re-validate the code against it exactly as /api/coupons/validate does.
  const preCoupon = computeSaleTotals(totalsInput);
  let couponDiscount = 0;
  if (sale.couponCode) {
    const coupon = await validateCoupon(shopId, sale.couponCode, preCoupon.couponBase);
    if (!coupon.ok) return { ok: false as const, status: 409, error: coupon.error };
    couponDiscount = coupon.discount;
  }
  if (!moneyMatches(sale.couponDiscount ?? 0, couponDiscount)) {
    return {
      ok: false as const,
      status: 409,
      error: "The coupon discount is out of date. Re-apply the coupon and try again.",
    };
  }

  const groupDiscountPercent = await getCustomerGroupDiscountPercent(shopId, sale.customer);
  const pointsRedeemed = sale.pointsRedeemed ?? 0;

  const computed = computeSaleTotals({
    ...totalsInput,
    couponDiscount,
    groupDiscountPercent,
    pointsRedeemed,
  });

  if (!moneyMatches(sale.groupDiscount ?? 0, computed.groupDiscount)) {
    return {
      ok: false as const,
      status: 409,
      error: "The customer group discount has changed. Reload the customer and try again.",
    };
  }
  if (
    !moneyMatches(sale.subtotal, computed.subtotal) ||
    !moneyMatches(sale.taxTotal, computed.taxTotal) ||
    !moneyMatches(sale.grandTotal, computed.grandTotal)
  ) {
    return { ok: false as const, status: 409, error: STALE_PRICING };
  }

  const grandTotal = computed.grandTotal;
  const paidAmount = sale.paymentMethod === "credit" ? 0 : Math.max(sale.paidAmount ?? 0, 0);
  const changeDue = Math.max(paidAmount - grandTotal, 0);
  const creditDue = creditAmount(sale.paymentMethod, grandTotal, paidAmount);

  // --- Customer eligibility -------------------------------------------------
  if (isCreditPayment(sale.paymentMethod) && creditDue > 0 && !sale.customer) {
    return { ok: false as const, status: 422, error: "A customer is required for credit or split payments." };
  }

  if (sale.customer && (creditDue > 0 || pointsRedeemed > 0)) {
    const customer = await Customer.findOne(withShopFilter(shopId, { _id: sale.customer }));
    if (!customer) return { ok: false as const, status: 404, error: "Customer not found" };
    if (creditDue > 0 && (customer.currentBalance ?? 0) + creditDue > customer.creditLimit) {
      return { ok: false as const, status: 409, error: "Credit limit exceeded for this customer." };
    }
    if (pointsRedeemed > 0 && (customer.rewardPoints ?? 0) < pointsRedeemed) {
      return { ok: false as const, status: 409, error: "Insufficient reward points." };
    }
  }

  // --- Persist --------------------------------------------------------------
  const createdSale = await Sale.create({
    ...sale,
    shopId,
    cashier: cashierId,
    createdBy: cashierId,
    saleType,
    subtotal: computed.subtotal,
    discountType: sale.discountType,
    discountValue: sale.discountValue,
    orderDiscount: computed.orderDiscount,
    couponDiscount: computed.couponDiscount,
    groupDiscount: computed.groupDiscount,
    pointsRedeemed: computed.pointsRedeemed,
    discountTotal: computed.discountTotal,
    taxTotal: computed.taxTotal,
    grandTotal,
    paidAmount,
    changeDue,
  });
  await SaleItem.insertMany(
    enforcedItems.map((item) => ({ ...item, shopId, sale: createdSale._id, createdBy: cashierId })),
  );
  await Promise.all(
    enforcedItems.map((item) =>
      Product.updateOne(withShopFilter(shopId, { _id: item.product }), { $inc: { quantity: -item.quantity } }),
    ),
  );

  if (sale.customer) {
    const earned = pointsEarned(grandTotal);
    const pointDelta = earned - pointsRedeemed;
    const customer = await Customer.findOneAndUpdate(
      withShopFilter(shopId, { _id: sale.customer }),
      { $inc: { currentBalance: creditDue, rewardPoints: pointDelta } },
      { new: true },
    );
    if (creditDue > 0 && customer) {
      await LedgerEntry.create({
        shopId,
        customer: sale.customer,
        sale: createdSale._id,
        type: "credit_sale",
        debit: creditDue,
        credit: 0,
        balance: customer.currentBalance ?? creditDue,
        description: `Credit sale ${sale.invoiceNumber}`,
        createdBy: cashierId,
      });
    }
  }

  const { logActivity } = await import("@/lib/activity");
  await logActivity({
    shopId,
    userId: cashierId,
    action: "sale.created",
    entity: "sale",
    entityId: String(createdSale._id),
    description: `Sale created: ${sale.invoiceNumber} — ${saleType} — Rs. ${grandTotal}`,
  });

  if (sale.couponCode) {
    const { markCouponUsed } = await import("@/lib/coupons");
    await markCouponUsed(shopId, sale.couponCode);
  }

  const { syncSaleAccounting } = await import("@/lib/accounting-sync");
  await syncSaleAccounting(shopId, cashierId, {
    id: String(createdSale._id),
    invoiceNumber: sale.invoiceNumber,
    grandTotal,
    paymentMethod: sale.paymentMethod,
    paidAmount,
    bankName: sale.bankName,
    chequeNumber: sale.chequeNumber,
    chequeDate: sale.chequeDate,
  });

  return { ok: true as const, sale: createdSale };
}
