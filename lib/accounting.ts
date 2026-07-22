import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { AccountingEntry } from "@/models";

export type AccountingBook = "cash" | "bank" | "income" | "expense";

export type AccountingSummary = Record<AccountingBook, number>;

const EMPTY_SUMMARY: AccountingSummary = {
  cash: 0,
  bank: 0,
  income: 0,
  expense: 0,
};

export async function getAccountingSummary(shopId: string): Promise<AccountingSummary> {
  await connectDb();
  const results = await AccountingEntry.aggregate([
    { $match: withShopFilter(shopId, { deletedAt: { $exists: false } }) },
    {
      $group: {
        _id: "$book",
        debits: { $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] } },
        credits: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] } },
      },
    },
  ]);

  const summary = { ...EMPTY_SUMMARY };
  for (const row of results) {
    const book = row._id as AccountingBook;
    if (!book || !(book in summary)) continue;
    const debits = row.debits ?? 0;
    const credits = row.credits ?? 0;
    if (book === "income") {
      summary.income = credits - debits;
    } else if (book === "expense") {
      summary.expense = debits - credits;
    } else {
      summary[book] = debits - credits;
    }
  }
  return summary;
}
