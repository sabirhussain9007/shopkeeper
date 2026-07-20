import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { getAttendanceDashboard } from "@/lib/attendance";
import { getExpenseDashboard } from "@/lib/expenses";
import { calculateProfit, periodBounds } from "@/lib/profit";
import { getSalaryDashboard } from "@/lib/salaries";
import { listActivityLogs } from "@/lib/activity";
import { getRemainingDays } from "@/lib/saas";
import { withShopFilter } from "@/lib/tenant";
import { Customer, Employee, Product, Sale, SaleItem, Setting, Shop } from "@/models";

type RecentSaleRow = {
  _id: unknown;
  invoiceNumber: string;
  paymentMethod: string;
  grandTotal: number;
  status: string;
  createdAt?: Date;
};

function monthLabel(year: number, month: number) {
  return `${month}/${year}`;
}

export async function getDashboardSummary(shopId: string) {
  await connectDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shopOid = new Types.ObjectId(shopId);
  const baseMatch = { shopId: shopOid, deletedAt: { $exists: false } };
  const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

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
    salesByMonth,
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
    Sale.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: sixMonthsStart, $lte: now }, status: "completed" } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          total: { $sum: "$grandTotal" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  const monthSlots = Array.from({ length: 6 }, (_, idx) => {
    const i = 5 - idx;
    const cursor = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const from = new Date(year, month - 1, 1);
    const to = i === 0 ? now : new Date(year, month, 0, 23, 59, 59, 999);
    return { year, month, label: monthLabel(year, month), from, to };
  });

  const monthProfits = await Promise.all(monthSlots.map((slot) => calculateProfit(shopId, slot.from, slot.to)));

  const chartSales = monthSlots.map((slot) => {
    const salesRow = salesByMonth.find((row) => row._id.year === slot.year && row._id.month === slot.month);
    return { label: slot.label, total: (salesRow?.total as number | undefined) ?? 0 };
  });
  const chartProfit = monthSlots.map((slot, index) => ({
    label: slot.label,
    total: monthProfits[index]?.profit ?? 0,
  }));

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
    expenseTrend: expenseDash.trend,
    chartSales,
    chartProfit,
    chartAttendance: [
      { label: "Present", total: attendance.today.present },
      { label: "Absent", total: attendance.today.absent },
      { label: "Leave", total: attendance.today.leave },
      { label: "Late", total: attendance.today.late },
    ],
    chartSalary: [
      { label: "Paid", total: salaryDash.totalPaid },
      { label: "Pending", total: salaryDash.totalPending },
    ],
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
