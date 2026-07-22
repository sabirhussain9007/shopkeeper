import { connectDb } from "@/lib/db";
import {
  syncChequeBounceRepayAccounting,
  syncCustomerPaymentAccounting,
  syncExpenseAccounting,
  syncPurchaseAccounting,
  syncSalaryPaymentAccounting,
  syncSaleAccounting,
  syncVendorPaymentAccounting,
} from "@/lib/accounting-sync";
import { withShopFilter } from "@/lib/tenant";
import {
  Customer,
  Expense,
  LedgerEntry,
  Purchase,
  Salary,
  Sale,
  Supplier,
  SupplierLedgerEntry,
} from "@/models";

export type BankBackfillStats = {
  sales: number;
  expenses: number;
  purchases: number;
  vendorPayments: number;
  customerPayments: number;
  salaries: number;
  chequeRepayments: number;
};

export async function backfillBankTransactions(shopId: string, userId: string): Promise<BankBackfillStats> {
  await connectDb();
  const stats: BankBackfillStats = {
    sales: 0,
    expenses: 0,
    purchases: 0,
    vendorPayments: 0,
    customerPayments: 0,
    salaries: 0,
    chequeRepayments: 0,
  };

  const sales = await Sale.find(withShopFilter(shopId, { deletedAt: { $exists: false }, status: "completed" })).lean();
  for (const sale of sales) {
    await syncSaleAccounting(shopId, userId, {
      id: String(sale._id),
      invoiceNumber: sale.invoiceNumber,
      grandTotal: sale.grandTotal ?? 0,
      paymentMethod: sale.paymentMethod,
      paidAmount: sale.paidAmount ?? 0,
      bankName: sale.bankName ?? undefined,
      chequeNumber: sale.chequeNumber ?? undefined,
      chequeDate: sale.chequeDate,
    });
    stats.sales += 1;
  }

  const expenses = await Expense.find(withShopFilter(shopId, { deletedAt: { $exists: false } })).lean();
  for (const expense of expenses) {
    await syncExpenseAccounting(
      shopId,
      userId,
      String(expense._id),
      expense.title,
      expense.amount ?? 0,
      expense.paymentMethod ?? "cash",
      expense.reference ?? "",
    );
    stats.expenses += 1;
  }

  const purchases = await Purchase.find(
    withShopFilter(shopId, { deletedAt: { $exists: false }, status: "received" }),
  ).lean();
  for (const purchase of purchases) {
    await syncPurchaseAccounting(shopId, userId, {
      id: String(purchase._id),
      grandTotal: purchase.grandTotal ?? 0,
      paidAmount: purchase.paidAmount ?? 0,
      paymentMethod: purchase.paymentMethod,
      chequeNumber: purchase.chequeNumber ?? undefined,
      chequeDate: purchase.chequeDate,
    });
    stats.purchases += 1;
  }

  const vendorPayments = await SupplierLedgerEntry.find(
    withShopFilter(shopId, { deletedAt: { $exists: false }, type: "payment" }),
  ).lean();
  for (const entry of vendorPayments) {
    if (entry.relatedEntry) continue;
    const supplier = await Supplier.findOne(withShopFilter(shopId, { _id: entry.supplier })).select("supplierName").lean();
    await syncVendorPaymentAccounting(
      shopId,
      userId,
      String(entry._id),
      supplier?.supplierName ?? "Vendor",
      entry.credit ?? 0,
      entry.paymentMethod ?? "cash",
      entry.reference ?? "",
      entry.bankName ?? "",
      entry.chequeDate,
      entry.entryDate,
    );
    stats.vendorPayments += 1;
  }

  const customerPayments = await LedgerEntry.find(
    withShopFilter(shopId, { deletedAt: { $exists: false }, type: "payment_received" }),
  ).lean();
  for (const entry of customerPayments) {
    if (entry.relatedEntry) {
      const bounce = await LedgerEntry.findOne(
        withShopFilter(shopId, { _id: entry.relatedEntry, type: "cheque_bounce" }),
      ).lean();
      if (bounce) {
        await syncChequeBounceRepayAccounting(
          shopId,
          userId,
          String(entry._id),
          entry.credit ?? 0,
          entry.paymentMethod ?? "cash",
          entry.description,
          entry.reference ?? "",
          entry.bankName ?? "",
          entry.chequeDate,
          entry.entryDate,
        );
        stats.chequeRepayments += 1;
        continue;
      }
    }
    const customer = await Customer.findOne(withShopFilter(shopId, { _id: entry.customer })).select("name").lean();
    await syncCustomerPaymentAccounting(
      shopId,
      userId,
      String(entry._id),
      customer?.name ?? "Customer",
      entry.credit ?? 0,
      entry.paymentMethod ?? "cash",
      entry.reference ?? "",
      entry.bankName ?? "",
      entry.chequeDate,
      entry.entryDate,
    );
    stats.customerPayments += 1;
  }

  const salaries = await Salary.find(withShopFilter(shopId, { deletedAt: { $exists: false }, paymentStatus: "paid" }))
    .populate("employee", "fullName")
    .lean();
  for (const salary of salaries) {
    const employee = salary.employee as { fullName?: string } | null;
    await syncSalaryPaymentAccounting(
      shopId,
      userId,
      String(salary._id),
      employee?.fullName ?? "Employee",
      salary.netSalary ?? 0,
      "cash",
      "",
      salary.paidAt ?? new Date(),
    );
    stats.salaries += 1;
  }

  const supplierChequeRepays = await SupplierLedgerEntry.find(
    withShopFilter(shopId, { deletedAt: { $exists: false }, type: "payment", relatedEntry: { $exists: true } }),
  ).lean();
  for (const entry of supplierChequeRepays) {
    const bounce = await SupplierLedgerEntry.findOne(
      withShopFilter(shopId, { _id: entry.relatedEntry, type: "cheque_bounce" }),
    ).lean();
    if (!bounce) continue;
    const supplier = await Supplier.findOne(withShopFilter(shopId, { _id: entry.supplier })).select("supplierName").lean();
    await syncVendorPaymentAccounting(
      shopId,
      userId,
      String(entry._id),
      supplier?.supplierName ?? "Vendor",
      entry.credit ?? 0,
      entry.paymentMethod ?? "cash",
      entry.reference ?? "",
      entry.bankName ?? "",
      entry.chequeDate,
      entry.entryDate,
    );
    stats.chequeRepayments += 1;
  }

  return stats;
}
