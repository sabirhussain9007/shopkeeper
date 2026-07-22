"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CreditCard,
  DollarSign,
  Download,
  Package,
  PackageX,
  Printer,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react";
import { Invoice } from "@/components/printing/invoice";
import { Card, Surface } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadInvoicePdf } from "@/lib/download-invoice-pdf";
import { currency, formatPakistanDate, formatPakistanDateTime } from "@/lib/utils";

type Summary = {
  todaySales: number;
  monthlySales: number;
  totalRevenue: number;
  grossProfit: number;
  netProfit: number;
  outstandingCredit: number;
  customerCount: number;
  productCount: number;
  lowStockCount: number;
  employeeCount?: number;
  presentToday?: number;
  absentToday?: number;
  monthlySalary?: number;
  monthlyExpenses?: number;
  todayProfit?: number;
  weeklyProfit?: number;
  monthlyProfit?: number;
  yearlyProfit?: number;
  profitMargin?: number;
  expenseByCategory?: Array<{ category: string; total: number }>;
  remainingDays?: number;
  packageExpired?: boolean;
  packageStatus?: string;
  expiringPackages?: number;
  expiredPackages?: number;
  recentActivity?: Array<{
    _id: string;
    action: string;
    description: string;
    userName?: string;
    createdAt?: string;
  }>;
  lowStock?: Array<{ _id: string; productName: string; quantity: number; reorderLevel: number }>;
  recentSales?: Array<{ _id: string; invoiceNumber: string; paymentMethod: string; grandTotal: number; status: string; createdAt: string }>;
  topProducts?: Array<{ productName: string; quantity: number; revenue: number }>;
  settings?: BusinessSettings;
};

type SaleItem = { _id: string; name: string; sku?: string; quantity: number; unitPrice: number; lineTotal: number };
type BusinessSettings = {
  businessName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstVatNumber?: string;
  ntn?: string;
  logo?: string;
};
type SaleDetail = {
  sale: {
    invoiceNumber: string;
    paymentMethod: string;
    status: string;
    subtotal?: number;
    discountValue?: number;
    taxTotal?: number;
    grandTotal: number;
    paidAmount?: number;
    changeDue?: number;
    createdAt?: string;
    customer?: { name: string };
    cashier?: { name: string };
  };
  items: SaleItem[];
};

export function SummaryDashboard({ summary }: { summary: Summary }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SaleDetail | null>(null);
  const [pendingAction, setPendingAction] = useState<{ saleId: string; action: "print" | "download" } | null>(null);

  const netProfitValue = summary.monthlyProfit ?? summary.netProfit;
  const remainingDays = summary.remainingDays;
  const packageExpired = summary.packageExpired ?? (typeof remainingDays === "number" && remainingDays < 0);
  const expiringLabel =
    typeof remainingDays === "number"
      ? packageExpired
        ? "Expired"
        : remainingDays <= 3
          ? `${remainingDays} day${remainingDays === 1 ? "" : "s"} left`
          : "No"
      : "—";

  const cards = [
    ["Today's Sales", summary.todaySales, DollarSign],
    ["Monthly Sales", summary.monthlySales, DollarSign],
    ["Gross Profit", summary.grossProfit, Package],
    ["Net Profit", netProfitValue, Package],
    ["Outstanding Credit", summary.outstandingCredit, CreditCard],
    ["Customers", summary.customerCount, Users],
    ["Products", summary.productCount, Boxes],
    ["Low Stock", summary.lowStockCount, AlertTriangle],
    ["Total Employees", summary.employeeCount ?? 0, Users],
    ["Present Today", summary.presentToday ?? 0, UserCheck],
    ["Absent Today", summary.absentToday ?? 0, UserMinus],
    ["Monthly Salary", summary.monthlySalary ?? 0, Wallet],
    ["Monthly Expenses", summary.monthlyExpenses ?? 0, Wallet],
    ["Today's Profit", summary.todayProfit ?? 0, TrendingUp],
    ["Weekly Profit", summary.weeklyProfit ?? 0, TrendingUp],
    ["Monthly Profit", summary.monthlyProfit ?? netProfitValue, TrendingUp],
    ["Yearly Profit", summary.yearlyProfit ?? 0, TrendingUp],
    ["Profit Margin %", summary.profitMargin ?? 0, TrendingUp],
    ["Expiring Package", expiringLabel, CalendarClock],
    ["Expired Package", packageExpired ? "Yes" : "No", PackageX],
  ] as const;

  const moneyCardLabels = new Set([
    "Today's Sales",
    "Monthly Sales",
    "Gross Profit",
    "Net Profit",
    "Outstanding Credit",
    "Monthly Salary",
    "Monthly Expenses",
    "Today's Profit",
    "Weekly Profit",
    "Monthly Profit",
    "Yearly Profit",
  ]);
  const percentCardLabels = new Set(["Profit Margin %"]);
  const business = summary.settings ?? { businessName: "Shopkeeper" };

  const printInvoice = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: selectedInvoice?.sale.invoiceNumber ?? "invoice",
  });

  const loadSaleDetail = async (saleId: string, action: "print" | "download") => {
    setPendingAction({ saleId, action });
    try {
      const response = await fetch(`/api/sales/${saleId}/detail`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load invoice");
      return data as SaleDetail;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load invoice.");
      return null;
    } finally {
      setPendingAction(null);
    }
  };

  const onPrintInvoice = async (saleId: string) => {
    const detail = await loadSaleDetail(saleId, "print");
    if (!detail) return;
    flushSync(() => {
      setSelectedInvoice(detail);
    });
    printInvoice();
  };

  const onDownloadInvoice = async (saleId: string) => {
    const detail = await loadSaleDetail(saleId, "download");
    if (!detail) return;
    await downloadInvoicePdf(detail, business);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <Surface key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{label}</p>
              <Icon className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-4 text-2xl font-semibold text-zinc-950">
              {moneyCardLabels.has(label)
                ? currency(value as number)
                : percentCardLabels.has(label)
                  ? `${Number(value).toFixed(1)}%`
                  : value}
            </div>
          </Surface>
        ))}
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Surface>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Recent Sales</h2>
              <p className="text-sm text-zinc-500">Latest invoices recorded in the system.</p>
            </div>
            <div className="responsive-table-shell">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-100 bg-[var(--panel)] text-left text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.recentSales ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                        No sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    summary.recentSales!.map((sale) => (
                      <tr key={sale._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                        <td className="px-4 py-3 font-medium">{sale.invoiceNumber}</td>
                        <td className="px-4 py-3 text-zinc-500">{formatPakistanDate(sale.createdAt, "-")}</td>
                        <td className="px-4 py-3 capitalize">{sale.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <Badge variant={sale.status === "completed" ? "success" : sale.status === "refunded" ? "warning" : "default"}>{sale.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{currency(sale.grandTotal)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              aria-label={`Print invoice ${sale.invoiceNumber}`}
                              title="Print invoice"
                              size="sm"
                              variant="ghost"
                              disabled={pendingAction?.saleId === sale._id}
                              onClick={() => void onPrintInvoice(sale._id)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={`Download invoice ${sale.invoiceNumber}`}
                              title="Download invoice"
                              size="sm"
                              variant="ghost"
                              disabled={pendingAction?.saleId === sale._id}
                              onClick={() => void onDownloadInvoice(sale._id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Top Products</h2>
              <p className="text-sm text-zinc-500">Best sellers by revenue.</p>
            </div>
            <div className="responsive-table-shell">
              <table className="min-w-full text-sm">
                <thead className="border-b border-zinc-100 bg-[var(--panel)] text-left text-zinc-600">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty Sold</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.topProducts ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                        No product sales yet.
                      </td>
                    </tr>
                  ) : (
                    summary.topProducts!.map((item) => (
                      <tr key={item.productName} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                        <td className="px-4 py-3 font-medium">{item.productName}</td>
                        <td className="px-4 py-3 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-medium">{currency(item.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Surface>

          {(summary.recentActivity?.length ?? 0) > 0 ? (
            <Surface>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Recent Activity</h2>
                <p className="text-sm text-zinc-500">Latest actions across the shop.</p>
              </div>
              <ul className="space-y-3">
                {summary.recentActivity!.map((item) => (
                  <li key={item._id} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.description || item.action}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {[item.userName, item.action].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {formatPakistanDateTime(item.createdAt, "")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Surface>
          ) : null}
        </div>
        <Card>
          <h2 className="text-xl font-semibold">Low Stock Alerts</h2>
          <div className="mt-4 space-y-3">
            {(summary.lowStock ?? []).length === 0 ? (
              <p className="text-sm text-zinc-400">All products are above reorder level.</p>
            ) : (
              summary.lowStock!.map((item) => (
                <div key={item._id} className="flex items-center justify-between rounded-xl bg-zinc-800 p-3 text-sm">
                  <span>{item.productName}</span>
                  <span className="text-amber-400">
                    {item.quantity} / {item.reorderLevel}
                  </span>
                </div>
              ))
            )}
          </div>
          <h2 className="mt-6 text-xl font-semibold">Restocking Checklist</h2>
          <div className="mt-4 space-y-3">
            {["Review low stock alerts", "Confirm supplier pricing", "Create purchase order", "Receive and count goods"].map((item) => (
              <label key={item} className="flex items-center gap-3 rounded-xl bg-zinc-800 p-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-emerald-500" />
                {item}
              </label>
            ))}
          </div>
        </Card>
      </div>
      {selectedInvoice ? (
        <div className="hidden">
          <Invoice
            ref={invoiceRef}
            invoiceNumber={selectedInvoice.sale.invoiceNumber}
            businessName={business.businessName}
            businessAddress={business.address}
            businessPhone={business.phone}
            businessEmail={business.email}
            gstVatNumber={business.gstVatNumber}
            ntn={business.ntn}
            logo={business.logo}
            date={formatPakistanDateTime(selectedInvoice.sale.createdAt ?? new Date())}
            cashierName={selectedInvoice.sale.cashier?.name}
            customerName={selectedInvoice.sale.customer?.name}
            items={selectedInvoice.items}
            subtotal={selectedInvoice.sale.subtotal ?? 0}
            discount={selectedInvoice.sale.discountValue ?? 0}
            tax={selectedInvoice.sale.taxTotal ?? 0}
            grandTotal={selectedInvoice.sale.grandTotal}
            paidAmount={selectedInvoice.sale.paidAmount ?? 0}
            changeDue={selectedInvoice.sale.changeDue ?? 0}
            paymentMethod={selectedInvoice.sale.paymentMethod}
            status={selectedInvoice.sale.status}
          />
        </div>
      ) : null}
    </div>
  );
}
