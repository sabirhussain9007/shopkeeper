import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { pakistanStartOfDay, pakistanWeekStart, pakistanMonthStart, pakistanYearStart } from "@/lib/datetime";
import { Expense, Salary, Sale, SaleItem } from "@/models";

function rangeBounds(from: Date, to: Date) {
  return { $gte: from, $lte: to };
}

async function salesTotals(shopOid: Types.ObjectId, from: Date, to: Date) {
  const [agg] = await Sale.aggregate([
    {
      $match: {
        shopId: shopOid,
        deletedAt: { $exists: false },
        status: { $in: ["completed", "refunded"] },
        createdAt: rangeBounds(from, to),
      },
    },
    {
      $group: {
        _id: null,
        sales: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$grandTotal", 0] } },
        discounts: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$discountValue", 0] } },
        refunds: { $sum: { $cond: [{ $eq: ["$status", "refunded"] }, "$grandTotal", 0] } },
      },
    },
  ]);
  return {
    sales: agg?.sales ?? 0,
    discounts: agg?.discounts ?? 0,
    refunds: agg?.refunds ?? 0,
  };
}

async function productCost(shopOid: Types.ObjectId, from: Date, to: Date) {
  const saleIds = await Sale.find({
    shopId: shopOid,
    deletedAt: { $exists: false },
    status: "completed",
    createdAt: rangeBounds(from, to),
  }).distinct("_id");

  if (saleIds.length === 0) return 0;

  const [agg] = await SaleItem.aggregate([
    { $match: { shopId: shopOid, sale: { $in: saleIds }, deletedAt: { $exists: false } } },
    { $group: { _id: null, cost: { $sum: { $multiply: ["$quantity", "$purchasePrice"] } } } },
  ]);
  return agg?.cost ?? 0;
}

async function expenseTotal(shopOid: Types.ObjectId, from: Date, to: Date) {
  const [agg] = await Expense.aggregate([
    {
      $match: {
        shopId: shopOid,
        deletedAt: { $exists: false },
        status: "active",
        expenseDate: rangeBounds(from, to),
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return agg?.total ?? 0;
}

async function salaryTotal(shopOid: Types.ObjectId, from: Date, to: Date) {
  const fromMonth = from.getMonth() + 1;
  const fromYear = from.getFullYear();
  const toMonth = to.getMonth() + 1;
  const toYear = to.getFullYear();
  const fromKey = fromYear * 12 + fromMonth;
  const toKey = toYear * 12 + toMonth;

  const salaries = await Salary.find({
    shopId: shopOid,
    deletedAt: { $exists: false },
    year: { $gte: fromYear, $lte: toYear },
  }).lean();

  return salaries
    .filter((row) => {
      const key = row.year * 12 + row.month;
      return key >= fromKey && key <= toKey;
    })
    .reduce((sum, row) => sum + (row.netSalary ?? 0), 0);
}

export type ProfitBreakdown = {
  sales: number;
  productCost: number;
  expenses: number;
  salaries: number;
  discounts: number;
  refunds: number;
  profit: number;
  margin: number;
};

export async function calculateProfit(shopId: string, from: Date, to: Date): Promise<ProfitBreakdown> {
  await connectDb();
  const shopOid = new Types.ObjectId(shopId);
  const [sales, cost, expenses, salaries] = await Promise.all([
    salesTotals(shopOid, from, to),
    productCost(shopOid, from, to),
    expenseTotal(shopOid, from, to),
    salaryTotal(shopOid, from, to),
  ]);

  const profit = sales.sales - cost - expenses - salaries - sales.discounts - sales.refunds;
  const margin = sales.sales > 0 ? (profit / sales.sales) * 100 : 0;

  return {
    sales: sales.sales,
    productCost: cost,
    expenses,
    salaries,
    discounts: sales.discounts,
    refunds: sales.refunds,
    profit,
    margin,
  };
}

export function periodBounds(period: "today" | "week" | "month" | "year", now = new Date()) {
  const end = new Date(now);
  if (period === "today") {
    return { from: pakistanStartOfDay(now), to: end };
  }
  if (period === "week") {
    return { from: pakistanWeekStart(now), to: end };
  }
  if (period === "month") {
    return { from: pakistanMonthStart(now), to: end };
  }
  return { from: pakistanYearStart(now), to: end };
}
