import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { AccountingEntry, BankAccount } from "@/models";

export type BankTransactionRow = {
  _id: string;
  entryDate: string;
  sourceType?: string;
  paymentMethod?: string;
  bankName?: string;
  description: string;
  reference?: string;
  chequeNumber?: string;
  chequeDate?: string;
  counterpartyName?: string;
  moneyIn: number;
  moneyOut: number;
};

export type BankSummary = {
  totalBalance: number;
  banks: Array<{ bankName: string; balance: number }>;
  totals?: { moneyIn: number; moneyOut: number };
};

export async function getBankSummary(shopId: string): Promise<BankSummary> {
  await connectDb();
  const entries = await AccountingEntry.find(
    withShopFilter(shopId, { book: "bank", deletedAt: { $exists: false } }),
  )
    .select("type amount bankName")
    .lean();

  const bankTotals = new Map<string, number>();
  let totalBalance = 0;

  for (const entry of entries) {
    const delta = entry.type === "debit" ? entry.amount : -entry.amount;
    totalBalance += delta;
    const key = entry.bankName?.trim() || "Unassigned";
    bankTotals.set(key, (bankTotals.get(key) ?? 0) + delta);
  }

  const registered = await BankAccount.find(
    withShopFilter(shopId, { deletedAt: { $exists: false }, status: "active" }),
  )
    .select("name")
    .lean();
  for (const account of registered) {
    const key = account.name.trim();
    if (key && !bankTotals.has(key)) bankTotals.set(key, 0);
  }

  const banks = Array.from(bankTotals.entries())
    .map(([bankName, balance]) => ({ bankName, balance }))
    .sort((a, b) => b.balance - a.balance);

  return { totalBalance, banks };
}

export async function getBankTransactions(
  shopId: string,
  options: { page: number; limit: number; bankName?: string; sourceType?: string },
) {
  await connectDb();
  const filter: Record<string, unknown> = withShopFilter(shopId, { book: "bank", deletedAt: { $exists: false } });
  if (options.bankName) {
    if (options.bankName === "__unassigned__") {
      filter.$or = [{ bankName: { $exists: false } }, { bankName: "" }, { bankName: null }];
    } else {
      filter.bankName = options.bankName;
    }
  }
  if (options.sourceType) filter.sourceType = options.sourceType;

  const skip = (options.page - 1) * options.limit;
  const [items, total, aggregate] = await Promise.all([
    AccountingEntry.find(filter).sort({ entryDate: -1, createdAt: -1 }).skip(skip).limit(options.limit).lean(),
    AccountingEntry.countDocuments(filter),
    AccountingEntry.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          moneyIn: { $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] } },
          moneyOut: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] } },
        },
      },
    ]),
  ]);

  const filterTotals = aggregate[0] as { moneyIn?: number; moneyOut?: number } | undefined;

  const rows: BankTransactionRow[] = items.map((entry) => ({
    _id: String(entry._id),
    entryDate: entry.entryDate ? new Date(entry.entryDate).toISOString() : new Date().toISOString(),
    sourceType: entry.sourceType ?? undefined,
    paymentMethod: entry.paymentMethod ?? undefined,
    bankName: entry.bankName ?? undefined,
    description: entry.description,
    reference: entry.reference ?? undefined,
    chequeNumber: entry.chequeNumber ?? undefined,
    chequeDate: entry.chequeDate ? new Date(entry.chequeDate).toISOString() : undefined,
    counterpartyName: entry.counterpartyName ?? undefined,
    moneyIn: entry.type === "debit" ? entry.amount : 0,
    moneyOut: entry.type === "credit" ? entry.amount : 0,
  }));

  const summary = await getBankSummary(shopId);

  return {
    summary: {
      ...summary,
      totals: {
        moneyIn: filterTotals?.moneyIn ?? 0,
        moneyOut: filterTotals?.moneyOut ?? 0,
      },
    },
    items: rows,
    total,
    page: options.page,
    pages: Math.ceil(total / options.limit) || 1,
  };
}

export async function listBankNames(shopId: string) {
  await connectDb();
  const names = await AccountingEntry.distinct("bankName", withShopFilter(shopId, { book: "bank", deletedAt: { $exists: false } }));
  return names.filter((name): name is string => typeof name === "string" && name.trim().length > 0).sort();
}
