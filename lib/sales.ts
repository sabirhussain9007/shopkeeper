import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Customer, LedgerEntry, Product, Sale, SaleItem } from "@/models";
import type { SaleInput } from "@/types";
import { processCheckout } from "@/lib/checkout";

export async function getSaleDetail(saleId: string, shopId: string) {
  await connectDb();
  const sale = await Sale.findOne(withShopFilter(shopId, { _id: saleId, deletedAt: { $exists: false } }))
    .populate("customer", "name phone currentBalance rewardPoints")
    .populate("cashier", "name email")
    .lean();
  if (!sale) return null;
  const items = await SaleItem.find(withShopFilter(shopId, { sale: saleId, deletedAt: { $exists: false } })).lean();
  const chequeBounced =
    sale.paymentMethod === "cheque"
      ? !!(await LedgerEntry.exists({
          shopId,
          type: "cheque_bounce",
          sale: saleId,
          deletedAt: { $exists: false },
        }))
      : false;
  return { sale, items, chequeBounced };
}

export async function getCustomerSales(customerId: string, shopId: string, limit = 50) {
  await connectDb();
  const sales = await Sale.find(withShopFilter(shopId, { customer: customerId, deletedAt: { $exists: false } }))
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("invoiceNumber grandTotal paymentMethod status createdAt")
    .lean();
  return sales;
}

async function reverseCredit(shopId: string, sale: { customer?: unknown; _id: unknown; invoiceNumber: string }, amount: number, userId: string) {
  if (!sale.customer || amount <= 0) return;
  const customerId = String(sale.customer);
  const customer = await Customer.findOneAndUpdate(withShopFilter(shopId, { _id: customerId }), { $inc: { currentBalance: -amount } }, { new: true });
  if (!customer) return;
  await LedgerEntry.create({
    shopId,
    customer: customerId,
    sale: String(sale._id),
    type: "adjustment",
    debit: 0,
    credit: amount,
    balance: customer.currentBalance,
    description: `Refund for ${sale.invoiceNumber}`,
    createdBy: userId,
  });
}

export async function processRefund(saleId: string, userId: string, shopId: string) {
  await connectDb();
  const sale = await Sale.findOne(withShopFilter(shopId, { _id: saleId, deletedAt: { $exists: false }, status: "completed" }));
  if (!sale) return { ok: false as const, status: 404, error: "Completed sale not found." };

  const items = await SaleItem.find(withShopFilter(shopId, { sale: saleId }));
  await Promise.all(items.map((item) => Product.updateOne(withShopFilter(shopId, { _id: item.product }), { $inc: { quantity: item.quantity } })));

  const creditAmount =
    sale.paymentMethod === "credit" ? sale.grandTotal : sale.paymentMethod === "split" ? Math.max(sale.grandTotal - (sale.paidAmount ?? 0), 0) : 0;

  await reverseCredit(shopId, sale, creditAmount, userId);

  sale.status = "refunded";
  sale.updatedBy = new Types.ObjectId(userId);
  await sale.save();

  return { ok: true as const, sale };
}

export async function processPartialRefund(
  saleId: string,
  userId: string,
  shopId: string,
  lines: Array<{ saleItemId: string; quantity: number }>,
) {
  await connectDb();
  const sale = await Sale.findOne(withShopFilter(shopId, { _id: saleId, deletedAt: { $exists: false }, status: "completed" }));
  if (!sale) return { ok: false as const, status: 404, error: "Completed sale not found." };

  const items = await SaleItem.find(withShopFilter(shopId, { sale: saleId }));
  let refundTotal = 0;

  for (const line of lines) {
    const item = items.find((row) => String(row._id) === line.saleItemId);
    if (!item || line.quantity <= 0 || line.quantity > item.quantity) {
      return { ok: false as const, status: 422, error: "Invalid refund quantity." };
    }
    await Product.updateOne(withShopFilter(shopId, { _id: item.product }), { $inc: { quantity: line.quantity } });
    const ratio = line.quantity / item.quantity;
    refundTotal += item.lineTotal * ratio;
    item.quantity -= line.quantity;
    item.lineTotal = Math.max(item.lineTotal - item.lineTotal * ratio, 0);
    await item.save();
  }

  sale.grandTotal = Math.max((sale.grandTotal ?? 0) - refundTotal, 0);
  sale.subtotal = Math.max((sale.subtotal ?? 0) - refundTotal, 0);
  if (items.every((item) => item.quantity <= 0)) sale.status = "refunded";
  sale.updatedBy = new Types.ObjectId(userId);
  await sale.save();

  if (sale.paymentMethod === "credit" || sale.paymentMethod === "split") {
    await reverseCredit(shopId, sale, refundTotal, userId);
  }

  return { ok: true as const, sale, refundTotal };
}

export async function processExchange(
  saleId: string,
  userId: string,
  shopId: string,
  returnLines: Array<{ saleItemId: string; quantity: number }>,
  newSale: SaleInput,
) {
  const partial = await processPartialRefund(saleId, userId, shopId, returnLines);
  if (!partial.ok) return partial;
  const checkout = await processCheckout(newSale, userId, shopId);
  if (!checkout.ok) return checkout;
  return { ok: true as const, refundTotal: partial.refundTotal, newSale: checkout.sale };
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
