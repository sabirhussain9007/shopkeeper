import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Customer, LedgerEntry, Product, Sale, SaleItem } from "@/models";
import type { SaleInput } from "@/types";
import { pointsEarned } from "@/lib/customer-benefits";

function creditAmount(sale: SaleInput) {
  if (sale.paymentMethod === "credit") return sale.grandTotal;
  if (sale.paymentMethod === "split") return Math.max(sale.grandTotal - sale.paidAmount, 0);
  return 0;
}

function isCreditPayment(method: SaleInput["paymentMethod"]) {
  return method === "credit" || method === "split";
}

export async function processCheckout(sale: SaleInput, cashierId: string, shopId: string) {
  await connectDb();

  const creditDue = creditAmount(sale);

  if (sale.customer && creditDue > 0) {
    const customer = await Customer.findOne(withShopFilter(shopId, { _id: sale.customer }));
    if (!customer) return { ok: false as const, status: 404, error: "Customer not found" };
    if ((customer.currentBalance ?? 0) + creditDue > customer.creditLimit) {
      return { ok: false as const, status: 409, error: "Credit limit exceeded for this customer." };
    }
  }

  if (isCreditPayment(sale.paymentMethod) && creditDue > 0 && !sale.customer) {
    return { ok: false as const, status: 422, error: "A customer is required for credit or split payments." };
  }

  const pointsRedeemed = sale.pointsRedeemed ?? 0;
  if (sale.customer && pointsRedeemed > 0) {
    const customer = await Customer.findOne(withShopFilter(shopId, { _id: sale.customer }));
    if (!customer) return { ok: false as const, status: 404, error: "Customer not found" };
    if ((customer.rewardPoints ?? 0) < pointsRedeemed) {
      return { ok: false as const, status: 409, error: "Insufficient reward points." };
    }
  }

  for (const item of sale.items) {
    const product = await Product.findOne(withShopFilter(shopId, { _id: item.product }));
    if (!product) return { ok: false as const, status: 404, error: `${item.name} no longer exists.` };
    if (product.quantity < item.quantity) return { ok: false as const, status: 409, error: `${item.name} has insufficient stock.` };
  }

  const createdSale = await Sale.create({ ...sale, shopId, cashier: cashierId, createdBy: cashierId });
  await SaleItem.insertMany(sale.items.map((item) => ({ ...item, shopId, sale: createdSale._id, createdBy: cashierId })));
  await Promise.all(
    sale.items.map((item) => Product.updateOne(withShopFilter(shopId, { _id: item.product }), { $inc: { quantity: -item.quantity } })),
  );

  if (sale.customer) {
    const earned = pointsEarned(sale.grandTotal);
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
    description: `Sale created: ${sale.invoiceNumber} — Rs. ${sale.grandTotal}`,
  });

  if (sale.couponCode) {
    const { markCouponUsed } = await import("@/lib/coupons");
    await markCouponUsed(shopId, sale.couponCode);
  }

  const { syncSaleAccounting } = await import("@/lib/accounting-sync");
  await syncSaleAccounting(shopId, cashierId, {
    id: String(createdSale._id),
    invoiceNumber: sale.invoiceNumber,
    grandTotal: sale.grandTotal,
    paymentMethod: sale.paymentMethod,
    paidAmount: sale.paidAmount ?? 0,
    bankName: sale.bankName,
    chequeNumber: sale.chequeNumber,
    chequeDate: sale.chequeDate,
  });

  return { ok: true as const, sale: createdSale };
}
