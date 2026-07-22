import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { getAttendanceDashboard } from "@/lib/attendance";
import { getExpenseDashboard } from "@/lib/expenses";
import { calculateProfit, periodBounds } from "@/lib/profit";
import { getSalaryDashboard } from "@/lib/salaries";
import { listActivityLogs } from "@/lib/activity";
import { getRemainingDays } from "@/lib/saas";
import { withShopFilter } from "@/lib/tenant";
import { Customer, Employee, Product, Sale, SaleItem, Setting, Shop, Supplier } from "@/models";

type RecentSaleRow = {
  _id: unknown;
  invoiceNumber: string;
  paymentMethod: string;
  grandTotal: number;
  status: string;
  createdAt?: Date;
};

export async function getDashboardSummary(shopId: string) {
  await connectDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shopOid = new Types.ObjectId(shopId);
  const baseMatch = { shopId: shopOid, deletedAt: { $exists: false } };

  const todayBounds = periodBounds("today", now);
  const weekBounds = periodBounds("week", now);
  const monthBounds = periodBounds("month", now);
  const yearBounds = periodBounds("year", now);

  const [
    salesAgg,
    monthAgg,
    productCount,
    customerCount,
    lowStockCount,
    outstandingAgg,
    lowStock,
    recentSales,
    topProducts,
    settings,
    shop,
    todayProfit,
    weekProfit,
    monthProfit,
    yearProfit,
    attendance,
    salaryDash,
    expenseDash,
    employeeCount,
    recentActivity,
    outOfStockCount,
    inventoryValueAgg,
    supplierCount,
  ] = await Promise.all([
    Sale.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: dayStart, $lte: now }, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Sale.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: monthStart, $lte: now }, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Product.countDocuments(baseMatch),
    Customer.countDocuments(baseMatch),
    Product.countDocuments({ ...baseMatch, $expr: { $lte: ["$quantity", "$reorderLevel"] } }),
    Customer.aggregate([{ $match: baseMatch }, { $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
    Product.find({ ...baseMatch, $expr: { $lte: ["$quantity", "$reorderLevel"] } })
      .sort({ quantity: 1 })
      .limit(8)
      .lean(),
    Sale.find(baseMatch)
      .select("invoiceNumber paymentMethod grandTotal status createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    SaleItem.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$name", quantity: { $sum: "$quantity" }, revenue: { $sum: "$lineTotal" } } },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    Setting.findOne(withShopFilter(shopId, { deletedAt: { $exists: false } })).sort({ updatedAt: -1 }).lean(),
    Shop.findById(shopId).select("expiresAt status").lean(),
    calculateProfit(shopId, todayBounds.from, todayBounds.to),
    calculateProfit(shopId, weekBounds.from, weekBounds.to),
    calculateProfit(shopId, monthBounds.from, monthBounds.to),
    calculateProfit(shopId, yearBounds.from, yearBounds.to),
    getAttendanceDashboard(shopId, now),
    getSalaryDashboard(shopId, now),
    getExpenseDashboard(shopId, now),
    Employee.countDocuments({ ...baseMatch, status: "active" }),
    listActivityLogs(shopId, { page: 1, limit: 8 }),
    Product.countDocuments({ ...baseMatch, quantity: 0 }),
    Product.aggregate([{ $match: baseMatch }, { $group: { _id: null, value: { $sum: { $multiply: ["$quantity", "$purchasePrice"] } } } }]),
    Supplier.countDocuments(baseMatch),
  ]);

  const remainingDays = getRemainingDays(shop?.expiresAt);
  const packageExpired = !Number.isFinite(remainingDays) || remainingDays < 0;
  const expiringPackages = !packageExpired && remainingDays <= 3 ? 1 : 0;
  const expiredPackages = packageExpired ? 1 : 0;

  return {
    todaySales: salesAgg[0]?.total ?? 0,
    monthlySales: monthAgg[0]?.total ?? 0,
    totalRevenue: monthAgg[0]?.total ?? 0,
    grossProfit: monthProfit.sales - monthProfit.productCost,
    netProfit: monthProfit.profit,
    outstandingCredit: outstandingAgg[0]?.total ?? 0,
    productCount,
    customerCount,
    lowStockCount,
    outOfStockCount,
    inventoryValue: inventoryValueAgg[0]?.value ?? 0,
    supplierCount,
    employeeCount,
    presentToday: attendance.today.present,
    absentToday: attendance.today.absent,
    monthlySalary: salaryDash.monthlyExpense,
    monthlyExpenses: expenseDash.month,
    todayProfit: todayProfit.profit,
    weeklyProfit: weekProfit.profit,
    monthlyProfit: monthProfit.profit,
    yearlyProfit: yearProfit.profit,
    profitMargin: monthProfit.margin,
    profitBreakdown: monthProfit,
    expenseByCategory: expenseDash.byCategory,
    remainingDays: Number.isFinite(remainingDays) ? remainingDays : -1,
    packageExpired,
    packageStatus: packageExpired ? "expired" : remainingDays <= 3 ? "expiring" : "active",
    expiringPackages,
    expiredPackages,
    recentActivity: recentActivity.items.map((item) => ({
      _id: String(item._id),
      action: item.action,
      description: item.description,
      userName: item.userName ?? "",
      createdAt: (item as { createdAt?: Date }).createdAt?.toISOString?.() ?? "",
    })),
    lowStock: lowStock.map((p) => ({
      _id: String(p._id),
      productName: p.productName,
      quantity: p.quantity,
      reorderLevel: p.reorderLevel,
    })),
    recentSales: (recentSales as RecentSaleRow[]).map((sale) => ({
      _id: String(sale._id),
      invoiceNumber: sale.invoiceNumber,
      paymentMethod: sale.paymentMethod,
      grandTotal: sale.grandTotal,
      status: sale.status,
      createdAt: sale.createdAt?.toISOString() ?? "",
    })),
    topProducts: topProducts.map((item) => ({
      productName: item._id as string,
      quantity: item.quantity as number,
      revenue: item.revenue as number,
    })),
    settings: {
      businessName: settings?.businessName ?? "Shopkeeper",
      address: settings?.address ?? "",
      phone: settings?.phone ?? "",
      email: settings?.email ?? "",
      gstVatNumber: settings?.gstVatNumber ?? "",
      ntn: settings?.ntn ?? "",
      logo: settings?.logo ?? "",
    },
  };
}
