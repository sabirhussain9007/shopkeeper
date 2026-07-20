"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Printer, RefreshCcw, RotateCcw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
import { useCrud } from "@/hooks/use-crud";
import { currency } from "@/lib/utils";
import type { SaleInput } from "@/types";

type Sale = SaleInput & { _id: string; createdAt?: string };
type SaleItem = { _id: string; name: string; sku?: string; quantity: number; unitPrice: number; lineTotal: number };
type BusinessSettings = { businessName: string; logo: string; address: string; phone: string; email: string; gstVatNumber: string; ntn: string };
type SaleDetail = {
  sale: Sale & { customer?: { name: string; phone?: string }; cashier?: { name: string } };
  items: SaleItem[];
};

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

  const items = list.data?.items ?? [];
  const detail = saleDetail.data;
  const business = settings.data ?? { businessName: "Shopkeeper", logo: "", address: "", phone: "", email: "", gstVatNumber: "", ntn: "" };

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
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
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
                  <tr key={sale._id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium">{sale.invoiceNumber}</td>
                    <td className="px-4 py-3 text-zinc-500">{sale.createdAt ? new Date(sale.createdAt).toLocaleString() : "—"}</td>
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
                <div>Paid: {currency(detail.sale.paidAmount ?? 0)}</div>
                <div>Change: {currency(detail.sale.changeDue ?? 0)}</div>
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-2 text-left">Item</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item._id} className="border-t border-zinc-100 dark:border-zinc-800">
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
                {detail.sale.status === "completed" ? (
                  <Button variant="danger" disabled={refundPending} onClick={() => setRefundConfirmOpen(true)}>
                    <RotateCcw className="h-4 w-4" />
                    {refundPending ? "Processing..." : "Refund Sale"}
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
            date={detail.sale.createdAt ? new Date(detail.sale.createdAt).toLocaleString() : new Date().toLocaleString()}
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
      <ConfirmDialog
        open={refundConfirmOpen}
        title="Refund Sale"
        description="Refund this sale? Stock will be restored and credit reversed if applicable."
        confirmLabel="Refund"
        isPending={refundPending}
        onOpenChange={setRefundConfirmOpen}
        onConfirm={onRefund}
      />
    </div>
  );
}
