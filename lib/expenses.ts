import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Expense } from "@/models";

export async function getExpenseDashboard(shopId: string, now = new Date()) {
  await connectDb();
  const shopOid = new Types.ObjectId(shopId);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const base = { shopId: shopOid, deletedAt: { $exists: false }, status: "active" };

  const [todayAgg, monthAgg, yearAgg, byCategory] = await Promise.all([
    Expense.aggregate([{ $match: { ...base, expenseDate: { $gte: dayStart, $lte: now } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: { ...base, expenseDate: { $gte: monthStart, $lte: now } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([{ $match: { ...base, expenseDate: { $gte: yearStart, $lte: now } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Expense.aggregate([
      { $match: { ...base, expenseDate: { $gte: monthStart, $lte: now } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]),
  ]);

  return {
    today: todayAgg[0]?.total ?? 0,
    month: monthAgg[0]?.total ?? 0,
    year: yearAgg[0]?.total ?? 0,
    byCategory: byCategory.map((row) => ({ category: row._id as string, total: row.total as number })),
  };
}
