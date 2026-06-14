import { connectDb } from "@/lib/db";
import { Customer, Product, Sale, SaleItem, Setting } from "@/models";

type RecentSaleRow = {
  _id: unknown;
  invoiceNumber: string;
  paymentMethod: string;
  grandTotal: number;
  status: string;
  createdAt?: Date;
};

export async function getDashboardSummary() {
  await connectDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [salesAgg, monthAgg, productCount, customerCount, lowStockCount, outstandingAgg, lowStock, recentSales, topProducts, settings] = await Promise.all([
    Sale.aggregate([
      { $match: { createdAt: { $gte: dayStart, $lte: now }, status: "completed", deletedAt: { $exists: false } } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Sale.aggregate([
      { $match: { createdAt: { $gte: monthStart, $lte: now }, status: "completed", deletedAt: { $exists: false } } },
      { $group: { _id: null, total: { $sum: "$grandTotal" }, profit: { $sum: { $subtract: ["$grandTotal", "$subtotal"] } } } },
    ]),
    Product.countDocuments({ deletedAt: { $exists: false } }),
    Customer.countDocuments({ deletedAt: { $exists: false } }),
    Product.countDocuments({ $expr: { $lte: ["$quantity", "$reorderLevel"] }, deletedAt: { $exists: false } }),
    Customer.aggregate([{ $match: { deletedAt: { $exists: false } } }, { $group: { _id: null, total: { $sum: "$currentBalance" } } }]),
    Product.find({ $expr: { $lte: ["$quantity", "$reorderLevel"] }, deletedAt: { $exists: false } })
      .sort({ quantity: 1 })
      .limit(8)
      .lean(),
    Sale.find({ deletedAt: { $exists: false } })
      .select("invoiceNumber paymentMethod grandTotal status createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    SaleItem.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: "$name", quantity: { $sum: "$quantity" }, revenue: { $sum: "$lineTotal" } } },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]),
    Setting.findOne({ deletedAt: { $exists: false } }).sort({ updatedAt: -1 }).lean(),
  ]);

  return {
    todaySales: salesAgg[0]?.total ?? 0,
    monthlySales: monthAgg[0]?.total ?? 0,
    totalRevenue: monthAgg[0]?.total ?? 0,
    grossProfit: monthAgg[0]?.profit ?? 0,
    netProfit: monthAgg[0]?.profit ?? 0,
    outstandingCredit: outstandingAgg[0]?.total ?? 0,
    productCount,
    customerCount,
    lowStockCount,
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
