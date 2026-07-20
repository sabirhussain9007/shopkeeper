import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Customer, LedgerEntry, Product, Sale, SaleItem } from "@/models";

export async function getSaleDetail(saleId: string, shopId: string) {
  await connectDb();
  const sale = await Sale.findOne(withShopFilter(shopId, { _id: saleId, deletedAt: { $exists: false } }))
    .populate("customer", "name phone currentBalance")
    .populate("cashier", "name email")
    .lean();
  if (!sale) return null;
  const items = await SaleItem.find(withShopFilter(shopId, { sale: saleId, deletedAt: { $exists: false } })).lean();
  return { sale, items };
}

export async function processRefund(saleId: string, userId: string, shopId: string) {
  await connectDb();
  const sale = await Sale.findOne(withShopFilter(shopId, { _id: saleId, deletedAt: { $exists: false }, status: "completed" }));
  if (!sale) return { ok: false as const, status: 404, error: "Completed sale not found." };

  const items = await SaleItem.find(withShopFilter(shopId, { sale: saleId }));
  await Promise.all(items.map((item) => Product.updateOne(withShopFilter(shopId, { _id: item.product }), { $inc: { quantity: item.quantity } })));

  const creditAmount =
    sale.paymentMethod === "credit" ? sale.grandTotal : sale.paymentMethod === "split" ? Math.max(sale.grandTotal - (sale.paidAmount ?? 0), 0) : 0;

  if (sale.customer && creditAmount > 0) {
    const customer = await Customer.findOneAndUpdate(withShopFilter(shopId, { _id: sale.customer }), { $inc: { currentBalance: -creditAmount } }, { new: true });
    if (customer) {
      await LedgerEntry.create({
        shopId,
        customer: sale.customer,
        sale: sale._id,
        type: "adjustment",
        debit: 0,
        credit: creditAmount,
        balance: customer.currentBalance,
        description: `Refund for ${sale.invoiceNumber}`,
        createdBy: userId,
      });
    }
  }

  sale.status = "refunded";
  sale.updatedBy = new Types.ObjectId(userId);
  await sale.save();

  return { ok: true as const, sale };
}

export async function getDailySalesSummary(shopId: string) {
  await connectDb();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();

  const sales = await Sale.find(
    withShopFilter(shopId, {
      createdAt: { $gte: start, $lte: end },
      status: "completed",
      deletedAt: { $exists: false },
    }),
  ).lean();

  const summary = {
    count: sales.length,
    total: sales.reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
    cash: sales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
    credit: sales.filter((s) => s.paymentMethod === "credit").reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
    split: sales.filter((s) => s.paymentMethod === "split").reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
    refunded: 0,
  };

  const refunded = await Sale.countDocuments(
    withShopFilter(shopId, {
      createdAt: { $gte: start, $lte: end },
      status: "refunded",
      deletedAt: { $exists: false },
    }),
  );
  summary.refunded = refunded;

  return summary;
}
