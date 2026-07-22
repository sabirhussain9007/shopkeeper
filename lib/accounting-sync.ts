import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { formatPakistanDateInput, resolvePakistanEntryDate } from "@/lib/datetime";
import { AccountingEntry } from "@/models";

type AccountingPaymentMethod = "cash" | "cheque" | "bank" | "easypaisa" | "jazzcash" | "card";

export type MoneyBook = "cash" | "bank";
export type AccountingSourceType =
  | "sale"
  | "purchase"
  | "expense"
  | "salary"
  | "customer_payment"
  | "vendor_payment"
  | "deposit"
  | "cheque_bounce_repay"
  | "manual"
  | "refund";

type PostParams = {
  shopId: string;
  userId: string;
  book: "cash" | "bank" | "income" | "expense";
  type: "debit" | "credit";
  amount: number;
  description: string;
  reference?: string;
  sourceType?: AccountingSourceType;
  sourceId?: string;
  paymentMethod?: string;
  bankName?: string;
  chequeNumber?: string;
  chequeDate?: Date | null;
  counterpartyName?: string;
  eventKey?: string;
  entryDate?: Date;
};

export function resolveMoneyBook(paymentMethod: string): MoneyBook | null {
  if (paymentMethod === "credit") return null;
  if (paymentMethod === "cash") return "cash";
  if (["bank", "card", "cheque", "easypaisa", "jazzcash"].includes(paymentMethod)) return "bank";
  return "cash";
}

export async function postAccountingEntry(params: PostParams) {
  if (params.amount <= 0) return;
  await connectDb();
  if (params.eventKey) {
    const exists = await AccountingEntry.exists({ shopId: params.shopId, eventKey: params.eventKey });
    if (exists) return;
  }
  await AccountingEntry.create({
    shopId: params.shopId,
    book: params.book,
    type: params.type,
    amount: params.amount,
    description: params.description,
    reference: params.reference?.trim() || undefined,
    sourceType: params.sourceType,
    sourceId: params.sourceId || undefined,
    paymentMethod: params.paymentMethod as AccountingPaymentMethod | undefined,
    bankName: params.bankName?.trim() || undefined,
    chequeNumber: params.chequeNumber?.trim() || undefined,
    chequeDate: params.chequeDate ?? undefined,
    counterpartyName: params.counterpartyName?.trim() || undefined,
    eventKey: params.eventKey || undefined,
    entryDate: params.entryDate ?? new Date(),
    createdBy: params.userId,
  });
}

type MoneyMeta = {
  paymentMethod?: string;
  bankName?: string;
  reference?: string;
  chequeNumber?: string;
  chequeDate?: Date | null;
  counterpartyName?: string;
  entryDate?: Date;
};

async function postMoneyIn(
  shopId: string,
  userId: string,
  book: MoneyBook,
  amount: number,
  description: string,
  sourceType: AccountingSourceType,
  sourceId: string | undefined,
  eventKey: string,
  meta: MoneyMeta = {},
) {
  await postAccountingEntry({
    shopId,
    userId,
    book,
    type: "debit",
    amount,
    description,
    reference: meta.reference,
    sourceType,
    sourceId,
    paymentMethod: meta.paymentMethod,
    bankName: meta.bankName,
    chequeNumber: meta.chequeNumber,
    chequeDate: meta.chequeDate,
    counterpartyName: meta.counterpartyName,
    eventKey,
    entryDate: meta.entryDate,
  });
}

async function postMoneyOut(
  shopId: string,
  userId: string,
  book: MoneyBook,
  amount: number,
  description: string,
  sourceType: AccountingSourceType,
  sourceId: string | undefined,
  eventKey: string,
  meta: MoneyMeta = {},
) {
  await postAccountingEntry({
    shopId,
    userId,
    book,
    type: "credit",
    amount,
    description,
    reference: meta.reference,
    sourceType,
    sourceId,
    paymentMethod: meta.paymentMethod,
    bankName: meta.bankName,
    chequeNumber: meta.chequeNumber,
    chequeDate: meta.chequeDate,
    counterpartyName: meta.counterpartyName,
    eventKey,
    entryDate: meta.entryDate,
  });
}

type SaleSyncInput = {
  id?: string;
  invoiceNumber: string;
  grandTotal: number;
  paymentMethod: string;
  paidAmount?: number;
  bankName?: string;
  chequeNumber?: string;
  chequeDate?: Date | null;
};

export async function syncSaleAccounting(shopId: string, userId: string, sale: SaleSyncInput) {
  const creditDue =
    sale.paymentMethod === "credit"
      ? sale.grandTotal
      : sale.paymentMethod === "split"
        ? Math.max(sale.grandTotal - (sale.paidAmount ?? 0), 0)
        : 0;
  const collected = Math.max(sale.grandTotal - creditDue, 0);

  await postAccountingEntry({
    shopId,
    userId,
    book: "income",
    type: "credit",
    amount: sale.grandTotal,
    description: `Sale revenue ${sale.invoiceNumber}`,
    reference: sale.invoiceNumber,
    sourceType: "sale",
    sourceId: sale.id,
    eventKey: sale.id ? `sale:${sale.id}:income` : undefined,
  });

  if (collected <= 0) return;

  const method = sale.paymentMethod === "split" ? "cash" : sale.paymentMethod;
  const book = resolveMoneyBook(method) ?? "cash";
  await postMoneyIn(shopId, userId, book, collected, `Sale ${sale.invoiceNumber}`, "sale", sale.id, `sale:${sale.id ?? sale.invoiceNumber}:inflow`, {
    paymentMethod: method,
    bankName: book === "bank" ? sale.bankName : undefined,
    reference: sale.chequeNumber || sale.invoiceNumber,
    chequeNumber: sale.chequeNumber,
    chequeDate: sale.chequeDate,
  });
}

export async function syncExpenseAccounting(
  shopId: string,
  userId: string,
  expenseId: string,
  title: string,
  amount: number,
  paymentMethod = "cash",
  reference = "",
  bankName = "",
) {
  const book = resolveMoneyBook(paymentMethod) ?? "cash";
  await postAccountingEntry({
    shopId,
    userId,
    book: "expense",
    type: "debit",
    amount,
    description: title,
    sourceType: "expense",
    sourceId: expenseId,
    eventKey: `expense:${expenseId}:expense`,
  });
  await postMoneyOut(shopId, userId, book, amount, `Expense paid: ${title}`, "expense", expenseId, `expense:${expenseId}:outflow`, {
    paymentMethod,
    bankName: book === "bank" ? bankName : undefined,
    reference,
  });
}

type PurchaseSyncInput = {
  id: string;
  grandTotal: number;
  paidAmount?: number;
  paymentMethod?: string;
  bankName?: string;
  chequeNumber?: string;
  chequeDate?: Date | null;
};

async function syncPurchasePaymentOutflow(
  shopId: string,
  userId: string,
  purchase: PurchaseSyncInput,
  amount: number,
  description: string,
  eventKey: string,
) {
  if (amount <= 0) return;
  const method = purchase.paymentMethod ?? "cash";
  const book = resolveMoneyBook(method) ?? "cash";
  await postMoneyOut(shopId, userId, book, amount, description, "purchase", purchase.id, eventKey, {
    paymentMethod: method,
    bankName: book === "bank" ? purchase.bankName : undefined,
    reference: purchase.chequeNumber || purchase.id,
    chequeNumber: purchase.chequeNumber,
    chequeDate: purchase.chequeDate,
  });
}

export async function syncPurchaseAccounting(shopId: string, userId: string, purchase: PurchaseSyncInput) {
  if (purchase.grandTotal <= 0) return;
  await postAccountingEntry({
    shopId,
    userId,
    book: "expense",
    type: "debit",
    amount: purchase.grandTotal,
    description: `Purchase ${purchase.id}`,
    reference: purchase.id,
    sourceType: "purchase",
    sourceId: purchase.id,
    eventKey: `purchase:${purchase.id}:expense`,
  });

  const paid = Math.max(purchase.paidAmount ?? 0, 0);
  await syncPurchasePaymentOutflow(
    shopId,
    userId,
    purchase,
    paid,
    `Purchase payment ${purchase.id}`,
    `purchase:${purchase.id}:outflow`,
  );
}

export async function syncPurchaseAdvancePayment(shopId: string, userId: string, purchase: PurchaseSyncInput) {
  const paid = Math.max(purchase.paidAmount ?? 0, 0);
  await syncPurchasePaymentOutflow(
    shopId,
    userId,
    purchase,
    paid,
    `Purchase advance ${purchase.id}`,
    `purchase:${purchase.id}:outflow:advance`,
  );
}

export async function syncPurchaseReceiveAccounting(
  shopId: string,
  userId: string,
  purchase: PurchaseSyncInput,
  previousPaidAmount = 0,
) {
  if (purchase.grandTotal <= 0) return;
  await postAccountingEntry({
    shopId,
    userId,
    book: "expense",
    type: "debit",
    amount: purchase.grandTotal,
    description: `Purchase ${purchase.id}`,
    reference: purchase.id,
    sourceType: "purchase",
    sourceId: purchase.id,
    eventKey: `purchase:${purchase.id}:expense`,
  });

  const totalPaid = Math.max(purchase.paidAmount ?? 0, 0);
  const incrementalPaid = Math.max(totalPaid - Math.max(previousPaidAmount, 0), 0);
  const outflowKey =
    previousPaidAmount > 0 ? `purchase:${purchase.id}:outflow:receive` : `purchase:${purchase.id}:outflow`;
  await syncPurchasePaymentOutflow(
    shopId,
    userId,
    purchase,
    incrementalPaid,
    previousPaidAmount > 0 ? `Purchase payment on receive ${purchase.id}` : `Purchase payment ${purchase.id}`,
    outflowKey,
  );
}

export async function syncVendorPaymentAccounting(
  shopId: string,
  userId: string,
  entryId: string,
  supplierName: string,
  amount: number,
  paymentMethod: string,
  reference = "",
  bankName = "",
  chequeDate?: Date | null,
  entryDate?: Date,
) {
  const book = resolveMoneyBook(paymentMethod) ?? "cash";
  await postMoneyOut(
    shopId,
    userId,
    book,
    amount,
    `Vendor payment to ${supplierName}`,
    "vendor_payment",
    entryId,
    `vendor_payment:${entryId}`,
    {
      paymentMethod,
      bankName: book === "bank" ? bankName : undefined,
      reference,
      chequeNumber: paymentMethod === "cheque" ? reference : undefined,
      chequeDate,
      counterpartyName: supplierName,
      entryDate,
    },
  );
}

export async function syncCustomerPaymentAccounting(
  shopId: string,
  userId: string,
  entryId: string,
  customerName: string,
  amount: number,
  paymentMethod = "cash",
  reference = "",
  bankName = "",
  chequeDate?: Date | null,
  entryDate?: Date,
) {
  const book = resolveMoneyBook(paymentMethod) ?? "cash";
  await postMoneyIn(
    shopId,
    userId,
    book,
    amount,
    `Customer payment from ${customerName}`,
    "customer_payment",
    entryId,
    `customer_payment:${entryId}`,
    {
      paymentMethod,
      bankName: book === "bank" ? bankName : undefined,
      reference,
      chequeNumber: paymentMethod === "cheque" ? reference : undefined,
      chequeDate,
      counterpartyName: customerName,
      entryDate,
    },
  );
}

export async function syncChequeBounceRepayAccounting(
  shopId: string,
  userId: string,
  entryId: string,
  amount: number,
  paymentMethod: string,
  description: string,
  reference = "",
  bankName = "",
  chequeDate?: Date | null,
  entryDate?: Date,
) {
  const book = resolveMoneyBook(paymentMethod) ?? "cash";
  await postMoneyIn(shopId, userId, book, amount, description, "cheque_bounce_repay", entryId, `cheque_bounce_repay:${entryId}`, {
    paymentMethod,
    bankName: book === "bank" ? bankName : undefined,
    reference,
    chequeNumber: paymentMethod === "cheque" ? reference : undefined,
    chequeDate,
    entryDate,
  });
}

export async function syncSalaryPaymentAccounting(
  shopId: string,
  userId: string,
  salaryId: string,
  employeeName: string,
  amount: number,
  paymentMethod = "cash",
  bankName = "",
  entryDate?: Date,
) {
  const book = resolveMoneyBook(paymentMethod) ?? "cash";
  await postMoneyOut(shopId, userId, book, amount, `Salary paid: ${employeeName}`, "salary", salaryId, `salary:${salaryId}:paid`, {
    paymentMethod,
    bankName: book === "bank" ? bankName : undefined,
    counterpartyName: employeeName,
    entryDate,
  });
}

export async function syncBankDeposit(
  shopId: string,
  userId: string,
  depositId: string,
  depositType: "cash" | "cheque",
  amount: number,
  bankName: string,
  reference = "",
  description = "",
  chequeDate?: Date | null,
  entryDate?: Date,
) {
  const resolvedDate = entryDate ?? new Date();
  const label = description.trim() || `${depositType === "cash" ? "Cash" : "Cheque"} deposit to ${bankName}`;
  await postMoneyIn(shopId, userId, "bank", amount, label, "deposit", depositId, `deposit:${depositId}:bank`, {
    paymentMethod: depositType === "cheque" ? "cheque" : "cash",
    bankName,
    reference,
    chequeNumber: depositType === "cheque" ? reference : undefined,
    chequeDate,
    entryDate: resolvedDate,
  });
  if (depositType === "cash") {
    await postMoneyOut(shopId, userId, "cash", amount, `Cash deposited to ${bankName}`, "deposit", depositId, `deposit:${depositId}:cash`, {
      paymentMethod: "cash",
      bankName,
      reference,
      entryDate: resolvedDate,
    });
  }
}

export async function recordBankDeposit(
  shopId: string,
  userId: string,
  input: {
    depositType: "cash" | "cheque";
    amount: number;
    bankName: string;
    reference?: string;
    description?: string;
    chequeDate?: Date | null;
    entryDate?: Date;
  },
) {
  const depositId = new Types.ObjectId().toString();
  const entryDate = input.entryDate ? resolvePakistanEntryDate(formatPakistanDateInput(input.entryDate)) : new Date();
  await syncBankDeposit(
    shopId,
    userId,
    depositId,
    input.depositType,
    input.amount,
    input.bankName,
    input.reference,
    input.description,
    input.chequeDate,
    entryDate,
  );
  return depositId;
}
