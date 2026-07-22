import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Customer, LedgerEntry } from "@/models";

type PaymentMeta = {
  paymentMethod?: string;
  reference?: string;
  bankName?: string;
  chequeDate?: Date | null;
  entryDate?: Date;
};

export async function recordPayment(
  customerId: string,
  amount: number,
  description: string,
  userId: string,
  shopId: string,
  meta: PaymentMeta = {},
) {
  if (amount <= 0) return { ok: false as const, error: "Payment amount must be positive." };
  await connectDb();
  const customerDoc = await Customer.findOneAndUpdate(withShopFilter(shopId, { _id: customerId }), { $inc: { currentBalance: -amount } }, { new: true });
  if (!customerDoc) return { ok: false as const, error: "Customer not found" };
  const entry = await LedgerEntry.create({
    shopId,
    customer: customerId,
    type: "payment_received",
    debit: 0,
    credit: amount,
    balance: customerDoc.currentBalance,
    description,
    entryDate: meta.entryDate ?? new Date(),
    paymentMethod: meta.paymentMethod as "cash" | "cheque" | "bank" | "easypaisa" | "jazzcash" | "card" | undefined,
    reference: meta.reference?.trim() || undefined,
    bankName: meta.bankName?.trim() || undefined,
    chequeDate: meta.chequeDate ?? undefined,
    createdBy: userId,
  });

  const { syncCustomerPaymentAccounting } = await import("@/lib/accounting-sync");
  await syncCustomerPaymentAccounting(
    shopId,
    userId,
    String(entry._id),
    customerDoc.name ?? "Customer",
    amount,
    meta.paymentMethod ?? "cash",
    meta.reference ?? "",
    meta.bankName ?? "",
    meta.chequeDate,
    meta.entryDate,
  );

  return { ok: true as const, balance: customerDoc.currentBalance, entryId: String(entry._id) };
}

export async function recordAdjustment(
  customerId: string,
  amount: number,
  direction: "increase" | "decrease",
  description: string,
  userId: string,
  shopId: string,
) {
  if (amount <= 0) return { ok: false as const, error: "Adjustment amount must be positive." };
  await connectDb();
  const delta = direction === "increase" ? amount : -amount;
  const customer = await Customer.findOneAndUpdate(withShopFilter(shopId, { _id: customerId }), { $inc: { currentBalance: delta } }, { new: true });
  if (!customer) return { ok: false as const, error: "Customer not found" };
  await LedgerEntry.create({
    shopId,
    customer: customerId,
    type: "adjustment",
    debit: direction === "increase" ? amount : 0,
    credit: direction === "decrease" ? amount : 0,
    balance: customer.currentBalance,
    description,
    entryDate: new Date(),
    createdBy: userId,
  });
  return { ok: true as const, balance: customer.currentBalance };
}

export async function getLedgerOverview(shopId: string) {
  await connectDb();
  const [customers, entries] = await Promise.all([
    Customer.find(withShopFilter(shopId, { deletedAt: { $exists: false }, status: "active" }))
      .sort({ currentBalance: -1 })
      .select("name phone creditLimit currentBalance")
      .lean(),
    LedgerEntry.find(withShopFilter(shopId, { deletedAt: { $exists: false } }))
      .sort({ entryDate: -1 })
      .limit(50)
      .populate("customer", "name phone")
      .lean(),
  ]);
  return {
    customers,
    entries,
    totalOutstanding: customers.reduce((sum, c) => sum + (c.currentBalance ?? 0), 0),
  };
}

export async function getCustomerLedger(customerId: string, shopId: string) {
  await connectDb();
  const customer = await Customer.findOne(withShopFilter(shopId, { _id: customerId, deletedAt: { $exists: false } })).lean();
  if (!customer) return null;
  const entries = await LedgerEntry.find(withShopFilter(shopId, { customer: customerId, deletedAt: { $exists: false } }))
    .sort({ entryDate: -1 })
    .populate("sale", "invoiceNumber status paymentMethod subtotal discountValue taxTotal grandTotal paidAmount")
    .lean();
  return {
    customer,
    entries: entries.map((entry) => {
      const sale = entry.sale as {
        _id?: unknown;
        invoiceNumber?: string;
        status?: string;
        paymentMethod?: string;
        subtotal?: number;
        discountValue?: number;
        taxTotal?: number;
        grandTotal?: number;
        paidAmount?: number;
      } | undefined;
      return {
        ...entry,
        _id: String(entry._id),
        sale: sale
          ? {
              _id: String(sale._id),
              invoiceNumber: sale.invoiceNumber,
              status: sale.status,
              paymentMethod: sale.paymentMethod,
              subtotal: sale.subtotal,
              discountValue: sale.discountValue,
              taxTotal: sale.taxTotal,
              grandTotal: sale.grandTotal,
              paidAmount: sale.paidAmount,
            }
          : undefined,
      };
    }),
  };
}
