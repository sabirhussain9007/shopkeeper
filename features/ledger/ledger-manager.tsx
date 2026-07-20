"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, FileDown, MessageCircle, Phone, Plus, Printer, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { Invoice } from "@/components/printing/invoice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currency } from "@/lib/utils";

type Customer = { _id: string; name: string; phone: string; creditLimit: number; currentBalance?: number };
type BusinessSettings = { businessName: string; logo: string; address: string; phone: string; email: string; gstVatNumber: string; ntn: string };
type LedgerEntry = {
  _id: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  entryDate: string;
  customer?: { name: string; phone?: string };
  sale?: {
    _id: string;
    invoiceNumber?: string;
    status?: string;
    paymentMethod?: string;
    subtotal?: number;
    discountValue?: number;
    taxTotal?: number;
    grandTotal?: number;
    paidAmount?: number;
  };
};
type SaleItem = { _id: string; name: string; sku?: string; quantity: number; unitPrice: number; lineTotal: number };
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
    createdAt?: string;
    customer?: { name: string; phone?: string };
    cashier?: { name: string };
  };
  items: SaleItem[];
};
type InvoiceLedgerSummary = { previousBalance: number; cashPortion: number; nowClosingBalance: number };

function entryLabel(type: string) {
  if (type === "credit_sale") return "Credit Sale";
  if (type === "payment_received") return "Payment";
  return "Adjustment";
}

function statementTemplate(name: string, amount: number) {
  return `Dear ${name}, your outstanding balance is ${currency(amount)}. Kindly visit the shop to settle your account.`;
}

function downloadInvoicePdf(detail: SaleDetail, business: BusinessSettings, ledgerSummary?: InvoiceLedgerSummary) {
  const doc = new jsPDF();
  const invoiceDate = detail.sale.createdAt ? new Date(detail.sale.createdAt).toLocaleString() : "";

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
  if (ledgerSummary) {
    autoTable(doc, {
      startY: finalY + 8,
      theme: "plain",
      margin: { left: 14 },
      tableWidth: 82,
      body: [
        ["Previous Balance", currency(ledgerSummary.previousBalance)],
        ["Invoice Subtotal", currency(detail.sale.subtotal ?? 0)],
        ["Discount", currency(detail.sale.discountValue ?? 0)],
        ["Tax", currency(detail.sale.taxTotal ?? 0)],
        ["Cash Paid", currency(ledgerSummary.cashPortion)],
        ["Now Closing Balance", currency(ledgerSummary.nowClosingBalance)],
      ],
    });
  }

  autoTable(doc, {
    startY: finalY + 8,
    theme: "plain",
    styles: { halign: "right" },
    margin: { left: 120 },
    body: [
      ["Subtotal", currency(detail.sale.subtotal ?? 0)],
      ["Discount", currency(detail.sale.discountValue ?? 0)],
      ["Tax", currency(detail.sale.taxTotal ?? 0)],
      ["Grand Total", currency(detail.sale.grandTotal)],
    ],
  });

  doc.save(`${detail.sale.invoiceNumber}.pdf`);
}

export function LedgerManager() {
  const queryClient = useQueryClient();
  const statementRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [invoiceToPrint, setInvoiceToPrint] = useState<SaleDetail | null>(null);
  const [invoiceLedgerSummary, setInvoiceLedgerSummary] = useState<InvoiceLedgerSummary | undefined>();
  const [invoiceActionId, setInvoiceActionId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [action, setAction] = useState<"payment" | "adjustment">("payment");
  const [direction, setDirection] = useState<"increase" | "decrease">("decrease");
  const settings = useQuery({
    queryKey: ["pos-settings"],
    queryFn: async () => {
      const response = await fetch("/api/pos/settings");
      if (!response.ok) return { businessName: "Shopkeeper", logo: "", address: "", phone: "", email: "", gstVatNumber: "", ntn: "" };
      return response.json() as Promise<BusinessSettings>;
    },
    staleTime: 60_000,
  });

  const overview = useQuery({
    queryKey: ["ledger-overview"],
    queryFn: async () => {
      const response = await fetch("/api/ledger/overview");
      if (!response.ok) throw new Error("Unable to load ledger");
      return response.json() as Promise<{ customers: Customer[]; entries: LedgerEntry[]; totalOutstanding: number }>;
    },
  });

  const customerLedger = useQuery({
    queryKey: ["ledger-customer", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const response = await fetch(`/api/ledger/customer/${selectedId}`);
      if (!response.ok) throw new Error("Unable to load customer ledger");
      return response.json() as Promise<{ customer: Customer; entries: LedgerEntry[] }>;
    },
  });

  const customers = useMemo(() => {
    const list = overview.data?.customers ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [overview.data?.customers, search]);

  const selectedCustomer = customerLedger.data?.customer ?? customers.find((c) => c._id === selectedId);
  const business = settings.data ?? { businessName: "Shopkeeper", logo: "", address: "", phone: "", email: "", gstVatNumber: "", ntn: "" };

  const printStatement = useReactToPrint({
    contentRef: statementRef,
    documentTitle: `statement-${selectedCustomer?.name ?? "customer"}`,
  });

  const printInvoice = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: invoiceToPrint?.sale.invoiceNumber ?? "invoice",
  });

  const loadInvoiceDetail = async (saleId: string) => {
    setInvoiceActionId(saleId);
    try {
      const response = await fetch(`/api/sales/${saleId}/detail`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load invoice.");
      return data as SaleDetail;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load invoice.");
      return null;
    } finally {
      setInvoiceActionId(null);
    }
  };

  const ledgerSummaryForEntry = (entry: LedgerEntry, detail: SaleDetail): InvoiceLedgerSummary => ({
    previousBalance: entry.balance - entry.debit + entry.credit,
    cashPortion: detail.sale.paymentMethod.toLowerCase() === "split" ? detail.sale.paidAmount ?? 0 : 0,
    nowClosingBalance: entry.balance,
  });

  const previousBalanceForEntry = (entry: LedgerEntry) => entry.balance - entry.debit + entry.credit;

  const cashPaidForEntry = (entry: LedgerEntry) => {
    if (entry.sale?.paymentMethod?.toLowerCase() === "split") return entry.sale.paidAmount ?? 0;
    if (entry.type === "payment_received" || entry.credit > 0) return entry.credit;
    return 0;
  };

  const statementRowForEntry = (entry: LedgerEntry) => [
    new Date(entry.entryDate).toLocaleDateString(),
    entryLabel(entry.type),
    currency(previousBalanceForEntry(entry)),
    entry.sale ? currency(entry.sale.subtotal ?? 0) : "-",
    entry.sale ? currency(entry.sale.discountValue ?? 0) : "-",
    entry.sale ? currency(entry.sale.taxTotal ?? 0) : "-",
    cashPaidForEntry(entry) > 0 ? currency(cashPaidForEntry(entry)) : "-",
    currency(entry.balance),
    entry.description,
  ];

  const onPrintInvoice = async (entry: LedgerEntry) => {
    if (!entry.sale?._id) return;
    const detail = await loadInvoiceDetail(entry.sale._id);
    if (!detail) return;
    flushSync(() => {
      setInvoiceToPrint(detail);
      setInvoiceLedgerSummary(ledgerSummaryForEntry(entry, detail));
    });
    printInvoice();
  };

  const onDownloadInvoice = async (entry: LedgerEntry) => {
    if (!entry.sale?._id) return;
    const detail = await loadInvoiceDetail(entry.sale._id);
    if (!detail) return;
    downloadInvoicePdf(detail, business, ledgerSummaryForEntry(entry, detail));
  };

  const submitEntry = async () => {
    if (!selectedId || amount <= 0) {
      toast.error("Select a customer and enter a valid amount.");
      return;
    }
    const response = await fetch("/api/ledger/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: selectedId, amount, description, action, direction }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? "Unable to record entry.");
      return;
    }
    toast.success(action === "payment" ? "Payment recorded." : "Adjustment recorded.");
    setPaymentOpen(false);
    setAmount(0);
    setDescription("");
    queryClient.invalidateQueries({ queryKey: ["ledger-overview"] });
    queryClient.invalidateQueries({ queryKey: ["ledger-customer", selectedId] });
  };

  const copyTemplate = (channel: "sms" | "whatsapp") => {
    if (!selectedCustomer) return;
    const text = statementTemplate(selectedCustomer.name, selectedCustomer.currentBalance ?? 0);
    void navigator.clipboard.writeText(text);
    toast.success(`${channel === "sms" ? "SMS" : "WhatsApp"} template copied.`);
  };

  const exportStatementPdf = () => {
    const entries = customerLedger.data?.entries ?? [];
    if (!selectedCustomer) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`Customer Ledger - ${selectedCustomer.name}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Phone: ${selectedCustomer.phone}`, 14, 24);
    doc.text(`Outstanding: ${currency(selectedCustomer.currentBalance ?? 0)}`, 14, 31);
    autoTable(doc, {
      startY: 38,
      head: [["Date", "Type", "Previous Balance", "Invoice Subtotal", "Discount", "Tax", "Cash Paid", "Closing Balance", "Description"]],
      body: entries.map(statementRowForEntry),
      styles: { fontSize: 8 },
      columnStyles: {
        8: { cellWidth: 58 },
      },
    });
    doc.save(`statement-${selectedCustomer.name.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Ledger</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Multi-debtor ledger with payments, adjustments, and statements.</p>
        </div>
        <Card className="px-5 py-3">
          <p className="text-sm text-zinc-400">Total Outstanding</p>
          <p className="text-2xl font-semibold text-emerald-400">{currency(overview.data?.totalOutstanding ?? 0)}</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Surface>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
            <Input className="pl-9" placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="max-h-[32rem] space-y-2 overflow-y-auto">
            {customers.map((customer) => (
              <button
                key={customer._id}
                type="button"
                onClick={() => setSelectedId(customer._id)}
                className={`w-full rounded-xl border p-4 text-left transition ${selectedId === customer._id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "border-zinc-200 dark:border-zinc-800"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-zinc-500">{customer.phone}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{currency(customer.currentBalance ?? 0)}</div>
                    <div className="text-xs text-zinc-500">Limit {currency(customer.creditLimit)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Surface>

        <Surface>
          {!selectedCustomer ? (
            <div className="py-16 text-center text-zinc-500">Select a customer to view ledger entries.</div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">{selectedCustomer.name}</h3>
                  <p className="text-sm text-zinc-500">Balance: {currency(selectedCustomer.currentBalance ?? 0)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setPaymentOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Record Entry
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => copyTemplate("sms")}>
                    <Phone className="h-4 w-4" />
                    SMS
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => copyTemplate("whatsapp")}>
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button size="sm" variant="ghost" onClick={exportStatementPdf}>
                    <FileDown className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => printStatement()}>
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-zinc-100 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Previous Balance</th>
                      <th className="px-4 py-3">Invoice Subtotal</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Tax</th>
                      <th className="px-4 py-3">Cash Paid</th>
                      <th className="px-4 py-3">Closing Balance</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(customerLedger.data?.entries ?? []).map((entry) => (
                      <tr key={entry._id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-4 py-3">{new Date(entry.entryDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Badge variant={entry.type === "payment_received" ? "success" : entry.type === "credit_sale" ? "warning" : "default"}>
                            {entryLabel(entry.type)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{currency(previousBalanceForEntry(entry))}</td>
                        <td className="px-4 py-3">{entry.sale ? currency(entry.sale.subtotal ?? 0) : "—"}</td>
                        <td className="px-4 py-3">{entry.sale ? currency(entry.sale.discountValue ?? 0) : "—"}</td>
                        <td className="px-4 py-3">{entry.sale ? currency(entry.sale.taxTotal ?? 0) : "—"}</td>
                        <td className="px-4 py-3">{cashPaidForEntry(entry) > 0 ? currency(cashPaidForEntry(entry)) : "—"}</td>
                        <td className="px-4 py-3 font-medium">{currency(entry.balance)}</td>
                        <td className="px-4 py-3 text-zinc-500">{entry.description}</td>
                        <td className="px-4 py-3">
                          {entry.type === "credit_sale" && entry.sale?._id ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                aria-label={`Print invoice ${entry.sale.invoiceNumber ?? ""}`}
                                title="Print invoice"
                                size="sm"
                                variant="ghost"
                                disabled={invoiceActionId === entry.sale._id}
                                onClick={() => void onPrintInvoice(entry)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                aria-label={`Download invoice ${entry.sale.invoiceNumber ?? ""}`}
                                title="Download invoice PDF"
                                size="sm"
                                variant="ghost"
                                disabled={invoiceActionId === entry.sale._id}
                                onClick={() => void onDownloadInvoice(entry)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div ref={statementRef} className="ledger-statement-print fixed top-0 -left-[10000px] bg-white p-8 text-black">
                <style>{`
                  @media print {
                    body * { visibility: hidden; }
                    .ledger-statement-print, .ledger-statement-print * { visibility: visible; }
                    .ledger-statement-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100%; }
                  }
                `}</style>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold">Customer Ledger</h1>
                  <p className="mt-2">{selectedCustomer.name} · {selectedCustomer.phone}</p>
                  <p className="mt-1 font-semibold">Outstanding: {currency(selectedCustomer.currentBalance ?? 0)}</p>
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-black">
                      <th className="py-2 pr-2 text-left">Date</th>
                      <th className="py-2 pr-2 text-left">Type</th>
                      <th className="py-2 pr-2 text-right">Previous Balance</th>
                      <th className="py-2 pr-2 text-right">Invoice Subtotal</th>
                      <th className="py-2 pr-2 text-right">Discount</th>
                      <th className="py-2 pr-2 text-right">Tax</th>
                      <th className="py-2 pr-2 text-right">Cash Paid</th>
                      <th className="py-2 pr-2 text-right">Closing Balance</th>
                      <th className="py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(customerLedger.data?.entries ?? []).map((entry) => (
                      <tr key={entry._id} className="border-b border-zinc-300">
                        <td className="py-2 pr-2">{new Date(entry.entryDate).toLocaleDateString()}</td>
                        <td className="py-2 pr-2">{entryLabel(entry.type)}</td>
                        <td className="py-2 pr-2 text-right">{currency(previousBalanceForEntry(entry))}</td>
                        <td className="py-2 pr-2 text-right">{entry.sale ? currency(entry.sale.subtotal ?? 0) : "-"}</td>
                        <td className="py-2 pr-2 text-right">{entry.sale ? currency(entry.sale.discountValue ?? 0) : "-"}</td>
                        <td className="py-2 pr-2 text-right">{entry.sale ? currency(entry.sale.taxTotal ?? 0) : "-"}</td>
                        <td className="py-2 pr-2 text-right">{cashPaidForEntry(entry) > 0 ? currency(cashPaidForEntry(entry)) : "-"}</td>
                        <td className="py-2 pr-2 text-right font-semibold">{currency(entry.balance)}</td>
                        <td className="py-2">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invoiceToPrint ? (
                <div className="hidden">
                  <Invoice
                    ref={invoiceRef}
                    invoiceNumber={invoiceToPrint.sale.invoiceNumber}
                    businessName={business.businessName}
                    businessAddress={business.address}
                    businessPhone={business.phone}
                    businessEmail={business.email}
                    gstVatNumber={business.gstVatNumber}
                    ntn={business.ntn}
                    logo={business.logo}
                    date={invoiceToPrint.sale.createdAt ? new Date(invoiceToPrint.sale.createdAt).toLocaleString() : new Date().toLocaleString()}
                    cashierName={invoiceToPrint.sale.cashier?.name}
                    customerName={invoiceToPrint.sale.customer?.name}
                    items={invoiceToPrint.items}
                    subtotal={invoiceToPrint.sale.subtotal ?? 0}
                    discount={invoiceToPrint.sale.discountValue ?? 0}
                    tax={invoiceToPrint.sale.taxTotal ?? 0}
                    grandTotal={invoiceToPrint.sale.grandTotal}
                    paymentMethod={invoiceToPrint.sale.paymentMethod}
                    status={invoiceToPrint.sale.status}
                    ledgerSummary={invoiceLedgerSummary}
                  />
                </div>
              ) : null}
            </>
          )}
        </Surface>
      </div>

      <Surface>
        <h3 className="mb-4 text-lg font-semibold">Recent Ledger Activity</h3>
        <div className="space-y-2">
          {(overview.data?.entries ?? []).slice(0, 10).map((entry) => (
            <div key={entry._id} className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div>
                <div className="font-medium">{entry.customer?.name ?? "Customer"}</div>
                <div className="text-zinc-500">{entry.description}</div>
              </div>
              <div className="text-right">
                <Badge>{entryLabel(entry.type)}</Badge>
                <div className="mt-1">{currency(entry.balance)}</div>
              </div>
            </div>
          ))}
        </div>
      </Surface>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent title="Record Ledger Entry" description="Record a payment or balance adjustment.">
          <div className="space-y-4">
            <div>
              <Label>Entry Type</Label>
              <Select className="mt-1.5" value={action} onChange={(e) => setAction(e.target.value as "payment" | "adjustment")}>
                <option value="payment">Payment Received</option>
                <option value="adjustment">Adjustment</option>
              </Select>
            </div>
            {action === "adjustment" ? (
              <div>
                <Label>Direction</Label>
                <Select className="mt-1.5" value={direction} onChange={(e) => setDirection(e.target.value as "increase" | "decrease")}>
                  <option value="decrease">Decrease balance (credit)</option>
                  <option value="increase">Increase balance (debit)</option>
                </Select>
              </div>
            ) : null}
            <div>
              <Label>Amount</Label>
              <Input className="mt-1.5" type="number" min={1} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1.5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Payment received at counter" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPaymentOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submitEntry()}>Save Entry</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
