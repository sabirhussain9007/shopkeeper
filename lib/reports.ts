import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Customer, Product, Sale, SaleItem } from "@/models";

type DateRange = { start: Date; end: Date; shopId: string };

type Timestamped = { createdAt?: Date | string };

function formatDate(doc: Timestamped) {
  return doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "-";
}

export async function getSalesReport({ start, end, shopId }: DateRange) {
  await connectDb();
  const sales = await Sale.find(
    withShopFilter(shopId, {
      createdAt: { $gte: start, $lte: end },
      status: "completed",
      deletedAt: { $exists: false },
    }),
  ).lean();

  return {
    title: "Sales Report",
    summary: {
      count: sales.length,
      revenue: sales.reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
      cash: sales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
      credit: sales.filter((s) => s.paymentMethod === "credit").reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
      split: sales.filter((s) => s.paymentMethod === "split").reduce((sum, s) => sum + (s.grandTotal ?? 0), 0),
    },
    rows: sales.map((s) => [s.invoiceNumber, formatDate(s as Timestamped), s.paymentMethod, s.grandTotal ?? 0]),
    headers: ["Invoice", "Date", "Payment", "Total"],
  };
}

export async function getInventoryReport(shopId: string) {
  await connectDb();
  const products = await Product.find(withShopFilter(shopId, { deletedAt: { $exists: false } })).sort({ productName: 1 }).lean();
  const lowStock = products.filter((p) => p.quantity <= p.reorderLevel);

  return {
    title: "Inventory Report",
    summary: {
      totalProducts: products.length,
      totalUnits: products.reduce((sum, p) => sum + p.quantity, 0),
      stockValue: products.reduce((sum, p) => sum + p.quantity * p.purchasePrice, 0),
      lowStockCount: lowStock.length,
    },
    rows: products.map((p) => [p.productName, p.sku, p.quantity, p.purchasePrice, p.sellingPrice, p.quantity <= p.reorderLevel ? "Low" : "OK"]),
    headers: ["Product", "SKU", "Qty", "Cost", "Price", "Status"],
  };
}

export async function getProfitReport({ start, end, shopId }: DateRange) {
  await connectDb();
  const sales = await Sale.find(
    withShopFilter(shopId, {
      createdAt: { $gte: start, $lte: end },
      status: "completed",
      deletedAt: { $exists: false },
    }),
  ).lean();

  const saleIds = sales.map((s) => s._id);
  const items = await SaleItem.find(withShopFilter(shopId, { sale: { $in: saleIds } })).lean();

  let revenue = 0;
  let cost = 0;
  for (const item of items) {
    revenue += item.lineTotal ?? item.quantity * item.unitPrice;
    cost += item.quantity * (item.purchasePrice ?? 0);
  }

  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return {
    title: "Profit Report",
    summary: { revenue, cost, profit, margin: margin.toFixed(2) },
    rows: items.slice(0, 100).map((i) => [i.name, i.quantity, i.unitPrice, i.purchasePrice, (i.lineTotal ?? 0) - i.quantity * (i.purchasePrice ?? 0)]),
    headers: ["Product", "Qty", "Sold At", "Cost", "Profit"],
  };
}

export async function getCreditReport(shopId: string) {
  await connectDb();
  const customers = await Customer.find(withShopFilter(shopId, { deletedAt: { $exists: false }, currentBalance: { $gt: 0 } }))
    .sort({ currentBalance: -1 })
    .lean();

  return {
    title: "Credit Report",
    summary: {
      debtors: customers.length,
      totalOutstanding: customers.reduce((sum, c) => sum + (c.currentBalance ?? 0), 0),
    },
    rows: customers.map((c) => [c.name, c.phone, c.creditLimit, c.currentBalance ?? 0]),
    headers: ["Customer", "Phone", "Credit Limit", "Balance"],
  };
}

export async function getTaxReport({ start, end, shopId }: DateRange) {
  await connectDb();
  const sales = await Sale.find(
    withShopFilter(shopId, {
      createdAt: { $gte: start, $lte: end },
      status: "completed",
      deletedAt: { $exists: false },
    }),
  ).lean();

  const totalTax = sales.reduce((sum, s) => sum + (s.taxTotal ?? 0), 0);

  return {
    title: "Tax Report",
    summary: { salesCount: sales.length, totalTax },
    rows: sales.map((s) => [s.invoiceNumber, formatDate(s as Timestamped), s.subtotal ?? 0, s.taxTotal ?? 0, s.grandTotal ?? 0]),
    headers: ["Invoice", "Date", "Subtotal", "Tax", "Total"],
  };
}

export async function generateReport(type: string, start: Date, end: Date, shopId: string) {
  switch (type) {
    case "sales":
      return getSalesReport({ start, end, shopId });
    case "inventory":
      return getInventoryReport(shopId);
    case "profit":
      return getProfitReport({ start, end, shopId });
    case "credit":
      return getCreditReport(shopId);
    case "tax":
      return getTaxReport({ start, end, shopId });
    default:
      return null;
  }
}
