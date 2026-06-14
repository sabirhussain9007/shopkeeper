"use client";

import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertTriangle, Boxes, CreditCard, DollarSign, Download, Package, Printer, Users } from "lucide-react";
import { Invoice } from "@/components/printing/invoice";
import { Card, Surface } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/utils";

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

function downloadInvoicePdf(detail: SaleDetail, business: BusinessSettings) {
  const doc = new jsPDF();
  const invoiceDate = detail.sale.createdAt ? new Date(detail.sale.createdAt).toLocaleString() : "";
  const subtotal = detail.sale.subtotal ?? 0;
  const discount = detail.sale.discountValue ?? 0;
  const tax = detail.sale.taxTotal ?? 0;

  doc.setFontSize(18);
  doc.text(business.businessName, 14, 18);
  doc.setFontSize(11);
  doc.text("Tax Invoice", 14, 26);
  let businessY = 34;
  if (business.address) {
    doc.text(business.address, 14, businessY);
    businessY += 7;
  }
  if (business.phone) {
    doc.text(`Phone: ${business.phone}`, 14, businessY);
    businessY += 7;
  }
  if (business.email) {
    doc.text(`Email: ${business.email}`, 14, businessY);
    businessY += 7;
  }
  if (business.gstVatNumber) {
    doc.text(`GST/VAT: ${business.gstVatNumber}`, 14, businessY);
    businessY += 7;
  }
  if (business.ntn) {
    doc.text(`NTN: ${business.ntn}`, 14, businessY);
  }

  doc.text(`Invoice: ${detail.sale.invoiceNumber}`, 140, 18);
  doc.text(`Date: ${invoiceDate}`, 140, 26);
  doc.text(`Customer: ${detail.sale.customer?.name ?? "Walk-in"}`, 140, 38);
  doc.text(`Cashier: ${detail.sale.cashier?.name ?? "-"}`, 140, 46);
  doc.text(`Payment: ${detail.sale.paymentMethod.toUpperCase()}`, 140, 54);
  doc.text(`Status: ${detail.sale.status.toUpperCase()}`, 140, 62);

  autoTable(doc, {
    startY: Math.max(74, businessY + 8),
    head: [["Item", "SKU", "Qty", "Price", "Total"]],
    body: detail.items.map((item) => [
      item.name,
      item.sku ?? "",
      item.quantity,
      currency(item.unitPrice),
      currency(item.lineTotal),
    ]),
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 58;
  autoTable(doc, {
    startY: finalY + 8,
    theme: "plain",
    styles: { halign: "right" },
    margin: { left: 120 },
    body: [
      ["Subtotal", currency(subtotal)],
      ["Discount", currency(discount)],
      ["Tax", currency(tax)],
      ["Grand Total", currency(detail.sale.grandTotal)],
      ["Paid", currency(detail.sale.paidAmount ?? 0)],
      ["Change", currency(detail.sale.changeDue ?? 0)],
    ],
  });

  doc.save(`${detail.sale.invoiceNumber}.pdf`);
}

export function SummaryDashboard({ summary }: { summary: Summary }) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<SaleDetail | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ saleId: string; action: "print" | "download" } | null>(null);

  const cards = [
    ["Today's Sales", summary.todaySales, DollarSign],
    ["Monthly Sales", summary.monthlySales, DollarSign],
    ["Gross Profit", summary.grossProfit, Package],
    ["Net Profit", summary.netProfit, Package],
    ["Outstanding Credit", summary.outstandingCredit, CreditCard],
    ["Customers", summary.customerCount, Users],
    ["Products", summary.productCount, Boxes],
    ["Low Stock", summary.lowStockCount, AlertTriangle],
  ] as const;

  const moneyCardLabels = new Set(["Today's Sales", "Monthly Sales", "Gross Profit", "Net Profit", "Outstanding Credit"]);
  const business = summary.settings ?? { businessName: "Shopkeeper" };

  const printInvoice = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: selectedInvoice?.sale.invoiceNumber ?? "invoice",
  });

  useEffect(() => {
    if (!pendingPrint || !selectedInvoice) return;
    setPendingPrint(false);
    printInvoice();
  }, [pendingPrint, printInvoice, selectedInvoice]);

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
    setSelectedInvoice(detail);
    setPendingPrint(true);
  };

  const onDownloadInvoice = async (saleId: string) => {
    const detail = await loadSaleDetail(saleId, "download");
    if (!detail) return;
    downloadInvoicePdf(detail, business);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">{label}</p>
              <Icon className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="mt-4 text-2xl font-semibold">{moneyCardLabels.has(label) ? currency(value as number) : value}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Surface>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Recent Sales</h2>
              <p className="text-sm text-zinc-500">Latest invoices recorded in the system.</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
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
                      <tr key={sale._id} className="border-t border-zinc-200 dark:border-zinc-800">
                        <td className="px-4 py-3 font-medium">{sale.invoiceNumber}</td>
                        <td className="px-4 py-3 text-zinc-500">{sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "-"}</td>
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
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
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
                      <tr key={item.productName} className="border-t border-zinc-200 dark:border-zinc-800">
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
            date={selectedInvoice.sale.createdAt ? new Date(selectedInvoice.sale.createdAt).toLocaleString() : new Date().toLocaleString()}
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
