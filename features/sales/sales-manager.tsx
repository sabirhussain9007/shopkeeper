"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, Printer, RefreshCcw, RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { Invoice } from "@/components/printing/invoice";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { BlockLoader, TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Surface } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCrud } from "@/hooks/use-crud";
import { currency, formatPakistanDate, formatPakistanDateInput, formatPakistanDateTime, parsePakistanDateInput, resolvePakistanEntryDate } from "@/lib/utils";
import { saleChequeBounceSchema } from "@/schemas/domain";
import type { SaleInput } from "@/types";
import { PaymentAccountSelect, PaymentMethodAccountSelect } from "@/components/payment/payment-method-account-select";
import { useShopPaymentAccounts } from "@/hooks/use-shop-payment-accounts";
import { paymentSelectionLabel, resolvePaymentSelection, STANDARD_BASE_PAYMENT_METHODS } from "@/lib/payment-accounts";

type Sale = SaleInput & { _id: string; createdAt?: string };
type SaleItem = { _id: string; name: string; sku?: string; quantity: number; unitPrice: number; lineTotal: number };
type BusinessSettings = { businessName: string; logo: string; address: string; phone: string; email: string; gstVatNumber: string; ntn: string };
type RepayPaymentMethod = "cash" | "cheque" | "bank" | "card";
type SaleDetail = {
  sale: Sale & {
    customer?: { name: string; phone?: string };
    cashier?: { name: string };
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
  };
  items: SaleItem[];
  chequeBounced?: boolean;
};

function toDateInput(value?: Date | string | null) {
  return formatPakistanDateInput(value);
}

function repayReferenceLabel(method: RepayPaymentMethod) {
  if (method === "cheque") return "Cheque number";
  if (method === "bank") return "Reference / transaction no.";
  if (method === "card") return "Card reference";
  return "Reference / transaction ID";
}

function statusVariant(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "completed") return "success";
  if (status === "refunded") return "danger";
  if (status === "void") return "warning";
  return "default";
}

export function SalesManager() {
  const queryClient = useQueryClient();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { list, setParams } = useCrud<SaleInput, Sale>("sales");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refundPending, setRefundPending] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [bounceModalOpen, setBounceModalOpen] = useState(false);
  const [bounceDate, setBounceDate] = useState(() => toDateInput(new Date()));
  const [bounceDescription, setBounceDescription] = useState("");
  const [bounceRecordRepay, setBounceRecordRepay] = useState(true);
  const [bounceRepayDate, setBounceRepayDate] = useState(() => toDateInput(new Date()));
  const [bounceRepaySelection, setBounceRepaySelection] = useState("cash");
  const [bounceRepayReference, setBounceRepayReference] = useState("");
  const [bounceRepayChequeBankAccountId, setBounceRepayChequeBankAccountId] = useState("");
  const [bounceRepayChequeDate, setBounceRepayChequeDate] = useState("");
  const [bounceRepayDescription, setBounceRepayDescription] = useState("");
  const [bounceSubmitting, setBounceSubmitting] = useState(false);
  const [bounceConfirmOpen, setBounceConfirmOpen] = useState(false);
  const [pendingBouncePayload, setPendingBouncePayload] = useState<ReturnType<typeof saleChequeBounceSchema.parse> | null>(null);
  const settings = useQuery({
    queryKey: ["pos-settings"],
    queryFn: async () => {
      const response = await fetch("/api/pos/settings");
      if (!response.ok) return { businessName: "Shopkeeper", logo: "", address: "", phone: "", email: "", gstVatNumber: "", ntn: "" };
      return response.json() as Promise<BusinessSettings>;
    },
    staleTime: 60_000,
  });

  const dailySummary = useQuery({
    queryKey: ["sales-daily-summary"],
    queryFn: async () => {
      const response = await fetch("/api/sales/daily-summary");
      if (!response.ok) throw new Error("Unable to load daily summary");
      return response.json() as Promise<{ count: number; total: number; cash: number; credit: number; split: number; refunded: number }>;
    },
  });

  const saleDetail = useQuery({
    queryKey: ["sale-detail", selectedId],
    enabled: !!selectedId && detailOpen,
    queryFn: async () => {
      const response = await fetch(`/api/sales/${selectedId}/detail`);
      if (!response.ok) throw new Error("Unable to load sale");
      return response.json() as Promise<SaleDetail>;
    },
  });

  const printInvoice = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: saleDetail.data?.sale.invoiceNumber ?? "invoice",
  });

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q, page: 1 })), [setParams]);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const onRefund = async () => {
    if (!selectedId) return;
    setRefundPending(true);
    try {
      const response = await fetch(`/api/sales/${selectedId}/refund`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Refund failed");
      toast.success("Sale refunded successfully.");
      setDetailOpen(false);
      setRefundConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sale-detail", selectedId] });
      dailySummary.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refund failed.");
    } finally {
      setRefundPending(false);
    }
  };

  const onEmailInvoice = () => {
    if (!selectedId || !detail?.sale.customer) {
      toast.error("Customer email required. Add a customer with contact on file.");
      return;
    }
    setEmailTo(business.email || "");
    setEmailDialogOpen(true);
  };

  const sendEmailInvoice = async () => {
    if (!selectedId) return;
    const email = emailTo.trim();
    if (!email) {
      toast.error("Enter an email address.");
      return;
    }
    setEmailPending(true);
    try {
      const response = await fetch("/api/sales/email-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: selectedId, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Email failed");
      toast.success(data.message ?? "Invoice emailed.");
      setEmailDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email failed.");
    } finally {
      setEmailPending(false);
    }
  };

  const resetBounceForm = () => {
    setBounceDate(toDateInput(new Date()));
    setBounceDescription("");
    setBounceRecordRepay(true);
    setBounceRepayDate(toDateInput(new Date()));
    setBounceRepaySelection("cash");
    setBounceRepayReference("");
    setBounceRepayChequeBankAccountId("");
    setBounceRepayChequeDate("");
    setBounceRepayDescription("");
  };

  const openBounceModal = () => {
    if (!detail?.sale) return;
    const chequeRef = detail.sale.chequeNumber?.trim();
    setBounceDate(toDateInput(new Date()));
    setBounceDescription(`Cheque bounced${chequeRef ? ` (#${chequeRef})` : ""}`);
    setBounceRecordRepay(true);
    setBounceRepayDate(toDateInput(new Date()));
    setBounceRepaySelection("cash");
    setBounceRepayReference("");
    setBounceRepayChequeBankAccountId("");
    setBounceRepayChequeDate("");
    setBounceRepayDescription(`Repayment after cheque bounce${chequeRef ? ` (#${chequeRef})` : ""}`);
    setBounceModalOpen(true);
  };

  const closeBounceModal = () => {
    setBounceModalOpen(false);
    setBounceConfirmOpen(false);
    setPendingBouncePayload(null);
    resetBounceForm();
  };

  const paymentAccountsQuery = useShopPaymentAccounts({ enabled: bounceModalOpen });
  const bankAccountsQuery = useShopPaymentAccounts({ accountType: "bank", enabled: bounceModalOpen });
  const paymentAccounts = paymentAccountsQuery.data?.items ?? [];
  const bankAccounts = bankAccountsQuery.data?.items ?? [];
  const resolvedBounceRepaySelection = resolvePaymentSelection(bounceRepaySelection, paymentAccounts);
  const bounceRepayChequeBankName = bankAccounts.find((account) => account._id === bounceRepayChequeBankAccountId)?.name ?? "";

  const buildBouncePayload = () => ({
    saleId: selectedId ?? "",
    entryDate: bounceDate ? resolvePakistanEntryDate(bounceDate) : new Date(),
    description: bounceDescription.trim(),
    recordRepayment: bounceRecordRepay,
    repay: bounceRecordRepay
      ? {
          paymentMethod: resolvedBounceRepaySelection.paymentMethod as RepayPaymentMethod,
          reference: bounceRepayReference.trim(),
          bankName:
            resolvedBounceRepaySelection.paymentMethod === "cheque"
              ? bounceRepayChequeBankName
              : resolvedBounceRepaySelection.bankName,
          chequeDate:
            resolvedBounceRepaySelection.paymentMethod === "cheque" && bounceRepayChequeDate
              ? parsePakistanDateInput(bounceRepayChequeDate)
              : null,
          entryDate: bounceRepayDate ? resolvePakistanEntryDate(bounceRepayDate) : new Date(),
          description: bounceRepayDescription.trim(),
        }
      : undefined,
  });

  const requestBounceSubmit = () => {
    if (!selectedId || !detail?.sale.customer) {
      toast.error("This sale needs a customer on file to bounce a cheque.");
      return;
    }
    const parsed = saleChequeBounceSchema.safeParse(buildBouncePayload());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid cheque bounce details.");
      return;
    }
    setPendingBouncePayload(parsed.data);
    setBounceModalOpen(false);
    setBounceConfirmOpen(true);
  };

  const submitBounce = async () => {
    if (!pendingBouncePayload) {
      toast.error("Cheque bounce details are missing. Please try again.");
      setBounceConfirmOpen(false);
      return;
    }
    setBounceSubmitting(true);
    try {
      const res = await fetch("/api/sales/cheque-bounce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingBouncePayload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Cheque bounce failed");
        setBounceModalOpen(true);
        return;
      }
      toast.success(pendingBouncePayload.recordRepayment ? "Cheque bounced and repayment recorded." : "Cheque marked as bounced.");
      closeBounceModal();
      queryClient.invalidateQueries({ queryKey: ["sale-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch {
      toast.error("Cheque bounce failed");
      setBounceModalOpen(true);
    } finally {
      setBounceSubmitting(false);
      setBounceConfirmOpen(false);
      setPendingBouncePayload(null);
    }
  };

  const items = list.data?.items ?? [];
  const detail = saleDetail.data;
  const business = settings.data ?? { businessName: "Shopkeeper", logo: "", address: "", phone: "", email: "", gstVatNumber: "", ntn: "" };
  const canBounceCheque =
    detail?.sale.paymentMethod === "cheque" &&
    detail.sale.status === "completed" &&
    !!detail.sale.customer &&
    !detail.chequeBounced;
  const bounceNeedsPaymentReference = resolvedBounceRepaySelection.paymentMethod !== "cash";
  const bounceNeedsChequeBank = resolvedBounceRepaySelection.paymentMethod === "cheque";
  const bounceNeedsChequeDate = resolvedBounceRepaySelection.paymentMethod === "cheque";

  useEffect(() => {
    if (!bounceRepayChequeBankAccountId && bankAccounts.length > 0) {
      setBounceRepayChequeBankAccountId(bankAccounts[0]._id);
    }
  }, [bankAccounts, bounceRepayChequeBankAccountId]);

  const bounceConfirmDescription = detail
    ? bounceRecordRepay
      ? `Mark cheque ${detail.sale.chequeNumber ? `#${detail.sale.chequeNumber}` : "payment"} as bounced (${currency(detail.sale.grandTotal)}) and record repayment via ${paymentSelectionLabel(bounceRepaySelection, paymentAccounts)}?`
      : `Mark cheque ${detail.sale.chequeNumber ? `#${detail.sale.chequeNumber}` : "payment"} as bounced (${currency(detail.sale.grandTotal)})?`
    : "Mark this cheque as bounced?";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Sales</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Sales history, invoices, refunds, and daily register summary.</p>
        </div>
        <Button variant="secondary" onClick={() => dailySummary.refetch()}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["Today's Sales", dailySummary.data?.count ?? 0, false],
          ["Revenue", dailySummary.data?.total ?? 0, true],
          ["Cash", dailySummary.data?.cash ?? 0, true],
          ["Credit", dailySummary.data?.credit ?? 0, true],
          ["Refunded", dailySummary.data?.refunded ?? 0, false],
        ].map(([label, value, isMoney]) => (
          <Card key={String(label)}>
            <p className="text-sm text-zinc-400">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{isMoney ? currency(value as number) : value}</p>
          </Card>
        ))}
      </div>

      <Surface>
        <DataToolbar placeholder="Search by invoice number" onSearch={onSearch} />
        <div className="responsive-table-shell responsive-table-shell--md">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={6} label="Loading sales..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No sales yet. Complete a POS checkout to create sales.
                  </td>
                </tr>
              ) : (
                items.map((sale) => (
                  <tr key={sale._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 font-medium">{sale.invoiceNumber}</td>
                    <td className="px-4 py-3 text-zinc-500">{formatPakistanDateTime(sale.createdAt)}</td>
                    <td className="px-4 py-3 capitalize">{sale.paymentMethod}</td>
                    <td className="px-4 py-3">{currency(sale.grandTotal)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(sale.status)}>{sale.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(sale._id)}>
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={list.data?.page ?? 1}
          pages={list.data?.pages ?? 1}
          total={list.data?.total ?? 0}
          onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        />
      </Surface>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent title="Invoice Details" description={detail?.sale.invoiceNumber} className="max-w-3xl">
          {saleDetail.isLoading ? (
            <BlockLoader label="Loading invoice..." />
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>Customer: {detail.sale.customer?.name ?? "Walk-in"}</div>
                <div>Cashier: {detail.sale.cashier?.name ?? "—"}</div>
                <div>Payment: {detail.sale.paymentMethod}</div>
                <div>Status: {detail.sale.status}</div>
                {detail.sale.paymentMethod === "cheque" ? (
                  <>
                    <div>Cheque #: {detail.sale.chequeNumber || "—"}</div>
                    <div>Cheque date: {detail.sale.chequeDate ? formatPakistanDate(detail.sale.chequeDate) : "—"}</div>
                    <div>Bank: {detail.sale.bankName || "—"}</div>
                    {detail.chequeBounced ? (
                      <div className="text-red-700">
                        <Badge variant="danger">Cheque bounced</Badge>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div>Paid: {currency(detail.sale.paidAmount ?? 0)}</div>
                <div>Change: {currency(detail.sale.changeDue ?? 0)}</div>
              </div>
              <div className="responsive-table-shell">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{currency(item.unitPrice)}</td>
                        <td className="px-4 py-2 text-right">{currency(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Grand Total</span>
                <span>{currency(detail.sale.grandTotal)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => printInvoice()}>
                  <Printer className="h-4 w-4" />
                  Print Invoice
                </Button>
                <Button variant="ghost" onClick={onEmailInvoice}>
                  <Mail className="h-4 w-4" />
                  Email Invoice
                </Button>
                {detail.sale.status === "completed" ? (
                  <Button variant="danger" disabled={refundPending} onClick={() => setRefundConfirmOpen(true)}>
                    <RotateCcw className="h-4 w-4" />
                    {refundPending ? "Processing..." : "Refund Sale"}
                  </Button>
                ) : null}
                {canBounceCheque ? (
                  <Button variant="secondary" onClick={openBounceModal}>
                    <Undo2 className="h-4 w-4" />
                    Cheque bounced
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {detail ? (
        <div className="hidden">
          <Invoice
            ref={invoiceRef}
            invoiceNumber={detail.sale.invoiceNumber}
            businessName={business.businessName}
            businessAddress={business.address}
            businessPhone={business.phone}
            businessEmail={business.email}
            gstVatNumber={business.gstVatNumber}
            ntn={business.ntn}
            logo={business.logo}
            date={formatPakistanDateTime(detail.sale.createdAt ?? new Date())}
            cashierName={detail.sale.cashier?.name}
            customerName={detail.sale.customer?.name}
            items={detail.items}
            subtotal={detail.sale.subtotal ?? 0}
            discount={detail.sale.discountValue ?? 0}
            tax={detail.sale.taxTotal ?? 0}
            grandTotal={detail.sale.grandTotal}
            paymentMethod={detail.sale.paymentMethod}
            status={detail.sale.status}
          />
        </div>
      ) : null}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent title="Email invoice" description="Send this invoice to a customer email address.">
          <div className="space-y-4">
            <div>
              <Label htmlFor="invoice-email">Email address</Label>
              <Input
                id="invoice-email"
                type="email"
                className="mt-1.5"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setEmailDialogOpen(false)} disabled={emailPending}>
                Cancel
              </Button>
              <Button onClick={() => void sendEmailInvoice()} loading={emailPending} loadingLabel="Sending...">
                Send invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={refundConfirmOpen}
        title="Refund Sale"
        description="Refund this sale? Stock will be restored and credit reversed if applicable."
        confirmLabel="Refund"
        isPending={refundPending}
        onOpenChange={setRefundConfirmOpen}
        onConfirm={onRefund}
      />

      <Dialog open={bounceModalOpen} onOpenChange={(open) => !open && closeBounceModal()}>
        <DialogContent title="Cheque bounced" description="Reverse the bounced cheque on the customer ledger and optionally record a new repayment.">
          {detail ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <p className="font-medium">Bounced cheque: {currency(detail.sale.grandTotal)}</p>
                {detail.sale.chequeNumber ? <p className="mt-1">Cheque #{detail.sale.chequeNumber}</p> : null}
                {detail.sale.bankName ? <p className="mt-1">Bank: {detail.sale.bankName}</p> : null}
                {detail.sale.chequeDate ? <p className="mt-1">Cheque date: {formatPakistanDate(detail.sale.chequeDate)}</p> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Bounce date</Label>
                  <Input type="date" className="mt-1.5" value={bounceDate} onChange={(e) => setBounceDate(e.target.value)} />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input className="mt-1.5" value={currency(detail.sale.grandTotal)} disabled />
                </div>
              </div>
              <div>
                <Label>Bounce note</Label>
                <Input className="mt-1.5" value={bounceDescription} onChange={(e) => setBounceDescription(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300"
                  checked={bounceRecordRepay}
                  onChange={(e) => setBounceRecordRepay(e.target.checked)}
                />
                Record repayment now
              </label>
              {bounceRecordRepay ? (
                <div className="space-y-4 rounded-xl border border-zinc-200 p-4">
                  <p className="text-sm font-medium text-zinc-800">Repayment details</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Repayment date</Label>
                      <Input type="date" className="mt-1.5" value={bounceRepayDate} onChange={(e) => setBounceRepayDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>Repayment method</Label>
                      <PaymentMethodAccountSelect
                        className="mt-1.5"
                        value={bounceRepaySelection}
                        onChange={setBounceRepaySelection}
                        accounts={paymentAccounts}
                        accountsLoading={paymentAccountsQuery.isLoading}
                        baseMethods={[...STANDARD_BASE_PAYMENT_METHODS]}
                        emptyAccountsHint="Add bank accounts under Finance → Bank."
                      />
                    </div>
                  </div>
                  {bounceNeedsChequeBank ? (
                    <div>
                      <Label>Bank</Label>
                      <PaymentAccountSelect
                        className="mt-1.5"
                        value={bounceRepayChequeBankAccountId}
                        onChange={setBounceRepayChequeBankAccountId}
                        accounts={bankAccounts}
                        emptyAccountsHint="Add bank accounts under Finance → Bank."
                      />
                    </div>
                  ) : null}
                  {bounceNeedsChequeDate ? (
                    <div>
                      <Label>Cheque date</Label>
                      <Input type="date" className="mt-1.5" value={bounceRepayChequeDate} onChange={(e) => setBounceRepayChequeDate(e.target.value)} />
                    </div>
                  ) : null}
                  {bounceNeedsPaymentReference ? (
                    <div>
                      <Label>{repayReferenceLabel(resolvedBounceRepaySelection.paymentMethod as RepayPaymentMethod)}</Label>
                      <Input className="mt-1.5" value={bounceRepayReference} onChange={(e) => setBounceRepayReference(e.target.value)} />
                    </div>
                  ) : null}
                  <div>
                    <Label>Repayment note</Label>
                    <Input className="mt-1.5" value={bounceRepayDescription} onChange={(e) => setBounceRepayDescription(e.target.value)} />
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={closeBounceModal}>
                  Cancel
                </Button>
                <Button onClick={requestBounceSubmit} disabled={bounceSubmitting}>
                  {bounceSubmitting ? "Saving..." : "Continue"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bounceConfirmOpen}
        title="Confirm cheque bounce"
        description={bounceConfirmDescription}
        confirmLabel="Mark bounced"
        confirmVariant="danger"
        isPending={bounceSubmitting}
        onOpenChange={setBounceConfirmOpen}
        onConfirm={submitBounce}
      />
    </div>
  );
}
