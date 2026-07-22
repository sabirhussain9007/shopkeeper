"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";
import { useCrud } from "@/hooks/use-crud";
import { MobileInput, bindMobileField } from "@/components/ui/pakistan-fields";
import { formatMobileInput } from "@/lib/pakistan-validators";
import { supplierSchema, supplierLedgerPaymentSchema, supplierLedgerChequeBounceSchema, vendorPaymentMethods } from "@/schemas/domain";
import { currency, formatPakistanDate, formatPakistanDateInput, parsePakistanDateInput, resolvePakistanEntryDate } from "@/lib/utils";
import type { SupplierInput } from "@/types";
import {
  VendorTransactionTable,
  type LedgerFilter,
  type VendorLedgerEntry,
} from "@/features/vendors/vendor-transaction-table";
import { PaymentAccountSelect, PaymentMethodAccountSelect } from "@/components/payment/payment-method-account-select";
import { useShopPaymentAccounts } from "@/hooks/use-shop-payment-accounts";
import {
  paymentSelectionLabel,
  resolvePaymentSelection,
  STANDARD_BASE_PAYMENT_METHODS,
} from "@/lib/payment-accounts";

type Vendor = SupplierInput & { _id: string; currentBalance?: number };

type VendorPaymentMethod = (typeof vendorPaymentMethods)[number];

function toDateInput(value?: Date | string | null) {
  return formatPakistanDateInput(value);
}

function referenceLabel(method: VendorPaymentMethod) {
  if (method === "cheque") return "Cheque number";
  if (method === "bank") return "Reference / transaction no.";
  if (method === "card") return "Card reference";
  return "Reference / transaction ID";
}

function formatVendorPickerLabel(vendor: Vendor) {
  return vendor.phone ? `${vendor.supplierName} (${vendor.phone})` : vendor.supplierName;
}

const formSchema = supplierSchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = {
  supplierName: "",
  contactPerson: "",
  phone: "",
  address: "",
  notes: "",
  openingBalance: 0,
  status: "active",
};

export function VendorsManager() {
  const queryClient = useQueryClient();
  const payVendorPickerRef = useRef<HTMLDivElement>(null);
  const { list, create, update, remove, params, setParams } = useCrud<SupplierInput, Vendor>("suppliers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payVendorId, setPayVendorId] = useState("");
  const [payVendorSearch, setPayVendorSearch] = useState("");
  const [payVendorPickerOpen, setPayVendorPickerOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDescription, setPayDescription] = useState("Vendor payment");
  const [payDate, setPayDate] = useState(() => toDateInput(new Date()));
  const [paySelection, setPaySelection] = useState("cash");
  const [payReference, setPayReference] = useState("");
  const [payChequeBankAccountId, setPayChequeBankAccountId] = useState("");
  const [payChequeDate, setPayChequeDate] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [bounceModalOpen, setBounceModalOpen] = useState(false);
  const [bounceTarget, setBounceTarget] = useState<VendorLedgerEntry | null>(null);
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
  const [pendingBouncePayload, setPendingBouncePayload] = useState<z.infer<typeof supplierLedgerChequeBounceSchema> | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all");

  const resetPayForm = () => {
    setPayVendorId("");
    setPayVendorSearch("");
    setPayVendorPickerOpen(false);
    setPayAmount("");
    setPayDescription("Vendor payment");
    setPayDate(toDateInput(new Date()));
    setPaySelection("cash");
    setPayReference("");
    setPayChequeBankAccountId("");
    setPayChequeDate("");
  };

  const selectPayVendor = (vendor: Vendor) => {
    setPayVendorId(vendor._id);
    setPayVendorSearch(formatVendorPickerLabel(vendor));
    setPayVendorPickerOpen(false);
  };

  const openPayModal = (item?: Vendor) => {
    resetPayForm();
    if (item) {
      setPayVendorId(item._id);
      setPayVendorSearch(formatVendorPickerLabel(item));
    }
    setPayModalOpen(true);
  };

  const closePayModal = () => {
    setPayModalOpen(false);
    setPayConfirmOpen(false);
    resetPayForm();
  };

  const resetBounceForm = () => {
    setBounceTarget(null);
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

  const openBounceModal = (entry: VendorLedgerEntry) => {
    const chequeRef = entry.reference?.trim();
    setBounceTarget(entry);
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

  const paymentAccountsQuery = useShopPaymentAccounts({ enabled: payModalOpen || bounceModalOpen });
  const bankAccountsQuery = useShopPaymentAccounts({ accountType: "bank", enabled: payModalOpen || bounceModalOpen });
  const paymentAccounts = paymentAccountsQuery.data?.items ?? [];
  const bankAccounts = bankAccountsQuery.data?.items ?? [];
  const resolvedPaySelection = resolvePaymentSelection(paySelection, paymentAccounts);
  const resolvedBounceRepaySelection = resolvePaymentSelection(bounceRepaySelection, paymentAccounts);
  const payChequeBankName = bankAccounts.find((account) => account._id === payChequeBankAccountId)?.name ?? "";
  const bounceRepayChequeBankName = bankAccounts.find((account) => account._id === bounceRepayChequeBankAccountId)?.name ?? "";

  const buildBouncePayload = () => ({
    supplierId: selectedVendor?._id ?? "",
    originalEntryId: bounceTarget?._id ?? "",
    entryDate: bounceDate ? resolvePakistanEntryDate(bounceDate) : new Date(),
    description: bounceDescription.trim(),
    recordRepayment: bounceRecordRepay,
    repay: bounceRecordRepay
      ? {
          paymentMethod: resolvedBounceRepaySelection.paymentMethod as VendorPaymentMethod,
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
    if (!bounceTarget || !selectedVendor) {
      toast.error("Select a vendor cheque payment to bounce.");
      return;
    }
    const parsed = supplierLedgerChequeBounceSchema.safeParse(buildBouncePayload());
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
      const res = await fetch("/api/suppliers/ledger/cheque-bounce", {
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
      list.refetch();
      if (selectedVendor) {
        queryClient.invalidateQueries({ queryKey: ["supplier-ledger", selectedVendor._id] });
        queryClient.invalidateQueries({ queryKey: ["supplier-detail", selectedVendor._id] });
      }
    } catch {
      toast.error("Cheque bounce failed");
      setBounceModalOpen(true);
    } finally {
      setBounceSubmitting(false);
      setBounceConfirmOpen(false);
      setPendingBouncePayload(null);
    }
  };

  const buildPaymentPayload = () => ({
    supplierId: payVendorId,
    amount: Number(payAmount),
    description: payDescription.trim(),
    type: "payment" as const,
    entryDate: payDate ? resolvePakistanEntryDate(payDate) : new Date(),
    paymentMethod: resolvedPaySelection.paymentMethod as VendorPaymentMethod,
    reference: payReference.trim(),
    bankName: resolvedPaySelection.paymentMethod === "cheque" ? payChequeBankName : resolvedPaySelection.bankName,
    chequeDate: resolvedPaySelection.paymentMethod === "cheque" && payChequeDate ? parsePakistanDateInput(payChequeDate) : null,
  });

  const requestPaymentSubmit = () => {
    if (!payVendorId) {
      toast.error("Please select a vendor.");
      return;
    }
    const parsed = supplierLedgerPaymentSchema.safeParse(buildPaymentPayload());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid payment details.");
      return;
    }
    setPayConfirmOpen(true);
  };

  const submitPayment = async () => {
    const parsed = supplierLedgerPaymentSchema.safeParse(buildPaymentPayload());
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid payment details.");
      setPayConfirmOpen(false);
      return;
    }
    setPaySubmitting(true);
    try {
      const res = await fetch("/api/suppliers/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Payment failed");
        return;
      }
      toast.success("Payment recorded.");
      closePayModal();
      list.refetch();
      queryClient.invalidateQueries({ queryKey: ["pay-vendor-picker"] });
      if (selectedVendor?._id === payVendorId) {
        queryClient.invalidateQueries({ queryKey: ["supplier-ledger", payVendorId] });
        queryClient.invalidateQueries({ queryKey: ["supplier-detail", payVendorId] });
      }
    } catch {
      toast.error("Payment failed");
    } finally {
      setPaySubmitting(false);
      setPayConfirmOpen(false);
    }
  };

  const payVendorOptionsQuery = useQuery({
    queryKey: ["pay-vendor-picker", payVendorSearch],
    enabled: payModalOpen,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", status: "active" });
      if (payVendorSearch.trim()) params.set("q", payVendorSearch.trim());
      const res = await fetch(`/api/suppliers?${params.toString()}`);
      if (!res.ok) return { items: [] as Vendor[] };
      return res.json() as Promise<{ items: Vendor[] }>;
    },
  });

  useEffect(() => {
    if (!payModalOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!payVendorPickerRef.current?.contains(event.target as Node)) {
        setPayVendorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [payModalOpen]);

  useEffect(() => {
    setLedgerFilter("all");
  }, [selectedVendor?._id]);

  const ledgerQuery = useQuery({
    queryKey: ["supplier-ledger", selectedVendor?._id],
    enabled: !!selectedVendor,
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/ledger?supplierId=${selectedVendor!._id}`);
      if (!res.ok) throw new Error("Unable to load vendor ledger");
      return res.json() as Promise<{ items: VendorLedgerEntry[] }>;
    },
  });

  const vendorDetailQuery = useQuery({
    queryKey: ["supplier-detail", selectedVendor?._id],
    enabled: !!selectedVendor,
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${selectedVendor!._id}`);
      if (!res.ok) throw new Error("Unable to load vendor details");
      return (await res.json()) as Vendor;
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Vendor) => {
    setEditing(item);
    form.reset({
      supplierName: item.supplierName,
      contactPerson: item.contactPerson ?? "",
      phone: formatMobileInput(item.phone),
      address: item.address ?? "",
      notes: item.notes ?? "",
      openingBalance: item.openingBalance,
      status: item.status,
    });
    setDialogOpen(true);
  };

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q, page: 1 })), [setParams]);
  const onStatusChange = useCallback((status: string) => setParams((p) => ({ ...p, status: status || undefined, page: 1 })), [setParams]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = formSchema.parse(values);
      if (editing) {
        await update.mutateAsync({ id: editing._id, input: payload });
        toast.success("Vendor updated.");
        if (selectedVendor?._id === editing._id) {
          queryClient.invalidateQueries({ queryKey: ["supplier-detail", editing._id] });
        }
      } else {
        await create.mutateAsync(payload);
        toast.success("Vendor created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save vendor.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Vendor deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete vendor.");
    }
  };

  const items = list.data?.items ?? [];
  const payPickerVendors = payVendorOptionsQuery.data?.items ?? [];
  const payVendor =
    payPickerVendors.find((item) => item._id === payVendorId) ?? items.find((item) => item._id === payVendorId) ?? null;
  const detailVendor = vendorDetailQuery.data ?? selectedVendor;
  const ledgerEntries = ledgerQuery.data?.items ?? [];
  const ledgerSummary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of ledgerEntries) {
      totalDebit += entry.debit ?? 0;
      totalCredit += entry.credit ?? 0;
    }
    return { totalDebit, totalCredit, count: ledgerEntries.length };
  }, [ledgerEntries]);
  const selectedBalance = detailVendor
    ? (items.find((item) => item._id === detailVendor._id)?.currentBalance ??
      detailVendor.currentBalance ??
      detailVendor.openingBalance ??
      0)
    : 0;

  useEffect(() => {
    if (!payChequeBankAccountId && bankAccounts.length > 0) {
      setPayChequeBankAccountId(bankAccounts[0]._id);
    }
    if (!bounceRepayChequeBankAccountId && bankAccounts.length > 0) {
      setBounceRepayChequeBankAccountId(bankAccounts[0]._id);
    }
  }, [bankAccounts, payChequeBankAccountId, bounceRepayChequeBankAccountId]);

  const toggleVendorDetail = (item: Vendor) => {
    setSelectedVendor((current) => (current?._id === item._id ? null : item));
  };

  const paymentConfirmDescription = payVendor
    ? `Record ${currency(Number(payAmount) || 0)} payment to ${payVendor.supplierName} via ${paymentSelectionLabel(paySelection, paymentAccounts)} on ${payDate ? formatPakistanDate(payDate) : "today"}?`
    : "Record this vendor payment?";

  const needsPaymentReference = resolvedPaySelection.paymentMethod !== "cash";
  const needsChequeBank = resolvedPaySelection.paymentMethod === "cheque";
  const needsChequeDate = resolvedPaySelection.paymentMethod === "cheque";
  const bounceNeedsPaymentReference = resolvedBounceRepaySelection.paymentMethod !== "cash";
  const bounceNeedsChequeBank = resolvedBounceRepaySelection.paymentMethod === "cheque";
  const bounceNeedsChequeDate = resolvedBounceRepaySelection.paymentMethod === "cheque";
  const bounceConfirmDescription = bounceTarget
    ? bounceRecordRepay
      ? `Mark cheque ${bounceTarget.reference ? `#${bounceTarget.reference}` : "payment"} as bounced (${currency(bounceTarget.credit)}) and record repayment via ${paymentSelectionLabel(bounceRepaySelection, paymentAccounts)}?`
      : `Mark cheque ${bounceTarget.reference ? `#${bounceTarget.reference}` : "payment"} as bounced (${currency(bounceTarget.credit)})?`
    : "Mark this cheque as bounced?";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Vendors</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Manage wholesalers and distributors you buy stock from. Link vendors to products and purchase orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => openPayModal()}>
            <Wallet className="h-4 w-4" />
            Record payment
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Vendor
          </Button>
        </div>
      </div>

      <Surface>
        <DataToolbar placeholder="Search vendors" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={6} label="Loading vendors..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No vendors yet. Add the businesses you purchase inventory from.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isSelected = selectedVendor?._id === item._id;
                  return (
                    <tr
                      key={item._id}
                      className={`cursor-pointer border-t border-zinc-100 transition hover:bg-emerald-50/60 ${isSelected ? "bg-emerald-50/80 dark:bg-emerald-500/10" : ""}`}
                      onClick={() => toggleVendorDetail(item)}
                    >
                      <td className="px-4 py-3 font-medium">{item.supplierName}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.contactPerson || "—"}</td>
                      <td className="px-4 py-3">{item.phone}</td>
                      <td className="px-4 py-3">{currency(item.currentBalance ?? item.openingBalance ?? 0)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Record payment"
                            onClick={() => openPayModal(item)}
                          >
                            <Wallet className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={list.data?.page ?? 1} pages={list.data?.pages ?? 1} total={list.data?.total ?? 0} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
      </Surface>

      {detailVendor ? (
        <Surface>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">{detailVendor.supplierName}</h3>
                <Badge variant={detailVendor.status === "active" ? "success" : "default"}>{detailVendor.status}</Badge>
              </div>
              <div className="grid gap-2 text-sm text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
                {detailVendor.contactPerson ? (
                  <p>
                    <span className="text-zinc-500">Contact:</span> {detailVendor.contactPerson}
                  </p>
                ) : null}
                <p>
                  <span className="text-zinc-500">Phone:</span> {detailVendor.phone}
                </p>
                {detailVendor.address ? (
                  <p className="sm:col-span-2">
                    <span className="text-zinc-500">Address:</span> {detailVendor.address}
                  </p>
                ) : null}
                {detailVendor.notes ? (
                  <p className="sm:col-span-2">
                    <span className="text-zinc-500">Notes:</span> {detailVendor.notes}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => openPayModal(detailVendor)}>
                <Wallet className="h-4 w-4" />
                Record payment
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openEdit(detailVendor)}>
                <Pencil className="h-4 w-4" />
                Edit vendor
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedVendor(null)}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Outstanding</p>
              <p className="mt-1 text-lg font-semibold">{currency(selectedBalance)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Opening balance</p>
              <p className="mt-1 text-lg font-semibold">{currency(detailVendor.openingBalance ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Total purchased</p>
              <p className="mt-1 text-lg font-semibold">{currency(ledgerSummary.totalDebit)}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Total paid</p>
              <p className="mt-1 text-lg font-semibold">{currency(ledgerSummary.totalCredit)}</p>
            </div>
          </div>

          <VendorTransactionTable
            entries={ledgerEntries}
            openingBalance={detailVendor.openingBalance ?? 0}
            closingBalance={selectedBalance}
            ledgerFilter={ledgerFilter}
            onFilterChange={setLedgerFilter}
            onBounceCheque={openBounceModal}
            isLoading={ledgerQuery.isLoading || vendorDetailQuery.isLoading}
            isError={ledgerQuery.isError}
          />
        </Surface>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title={editing ? "Edit Vendor" : "New Vendor"}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Vendor Name</Label>
              <Input className="mt-1.5" {...form.register("supplierName")} />
            </div>
            <div>
              <Label>Contact Person</Label>
              <Input className="mt-1.5" {...form.register("contactPerson")} />
            </div>
            <div>
              <Label>Mobile</Label>
              <MobileInput className="mt-1.5" {...bindMobileField(form.register, "phone")} />
              <FieldError message={form.formState.errors.phone?.message} />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea className="mt-1.5" {...form.register("address")} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea className="mt-1.5" {...form.register("notes")} />
            </div>
            <div>
              <Label>Status</Label>
              <Select className="mt-1.5" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payModalOpen} onOpenChange={(open) => !open && closePayModal()}>
        <DialogContent title="Vendor payment" description="Record a payment to a vendor and update their balance.">
          <div className="space-y-4">
            <div>
              <Label>Vendor</Label>
              <div ref={payVendorPickerRef} className="relative mt-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input
                    className="pl-9"
                    placeholder="Type vendor name or phone to search..."
                    value={payVendorSearch}
                    onChange={(e) => {
                      setPayVendorSearch(e.target.value);
                      setPayVendorId("");
                      setPayVendorPickerOpen(true);
                    }}
                    onFocus={() => setPayVendorPickerOpen(true)}
                  />
                </div>
                {payVendorPickerOpen ? (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-lg">
                    {payVendorOptionsQuery.isLoading ? (
                      <p className="px-3 py-2 text-sm text-zinc-500">Searching vendors...</p>
                    ) : payPickerVendors.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-zinc-500">No vendors match your search.</p>
                    ) : (
                      payPickerVendors.map((vendor) => (
                        <button
                          key={vendor._id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-emerald-50"
                          onClick={() => selectPayVendor(vendor)}
                        >
                          <div>
                            <div className="font-medium">{vendor.supplierName}</div>
                            {vendor.phone ? <div className="text-xs text-zinc-500">{vendor.phone}</div> : null}
                          </div>
                          <span className="shrink-0 text-xs text-zinc-500">
                            {currency(vendor.currentBalance ?? vendor.openingBalance ?? 0)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {payVendor ? (
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                  Selected: {payVendor.supplierName} · Outstanding {currency(payVendor.currentBalance ?? payVendor.openingBalance ?? 0)}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Payment date</Label>
                <Input type="date" className="mt-1.5" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" min={0} step="0.01" className="mt-1.5" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Payment method</Label>
              <PaymentMethodAccountSelect
                className="mt-1.5"
                value={paySelection}
                onChange={setPaySelection}
                accounts={paymentAccounts}
                accountsLoading={paymentAccountsQuery.isLoading}
                baseMethods={[...STANDARD_BASE_PAYMENT_METHODS]}
                emptyAccountsHint="Add bank accounts under Finance → Bank."
              />
            </div>
            {needsChequeBank ? (
              <div>
                <Label>Bank</Label>
                <PaymentAccountSelect
                  className="mt-1.5"
                  value={payChequeBankAccountId}
                  onChange={setPayChequeBankAccountId}
                  accounts={bankAccounts}
                  emptyAccountsHint="Add bank accounts under Finance → Bank."
                />
              </div>
            ) : null}
            {needsChequeDate ? (
              <div>
                <Label>Cheque date</Label>
                <Input type="date" className="mt-1.5" value={payChequeDate} onChange={(e) => setPayChequeDate(e.target.value)} />
              </div>
            ) : null}
            {needsPaymentReference ? (
              <div>
                <Label>{referenceLabel(resolvedPaySelection.paymentMethod as VendorPaymentMethod)}</Label>
                <Input
                  className="mt-1.5"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder={resolvedPaySelection.paymentMethod === "cheque" ? "Cheque number" : "Transaction or reference number"}
                />
              </div>
            ) : null}
            <div>
              <Label>Description</Label>
              <Input className="mt-1.5" value={payDescription} onChange={(e) => setPayDescription(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={closePayModal}>
                Cancel
              </Button>
              <Button onClick={requestPaymentSubmit} disabled={paySubmitting}>
                {paySubmitting ? "Saving..." : "Record payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={payConfirmOpen}
        title="Confirm vendor payment"
        description={paymentConfirmDescription}
        confirmLabel="Record payment"
        confirmVariant="primary"
        isPending={paySubmitting}
        onOpenChange={setPayConfirmOpen}
        onConfirm={submitPayment}
      />

      <Dialog open={bounceModalOpen} onOpenChange={(open) => !open && closeBounceModal()}>
        <DialogContent
          title="Cheque bounced"
          description="Reverse the bounced cheque on the vendor ledger and optionally record a new repayment."
        >
          {bounceTarget ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <p className="font-medium">Bounced cheque: {currency(bounceTarget.credit)}</p>
                {bounceTarget.reference ? <p className="mt-1">Cheque #{bounceTarget.reference}</p> : null}
                {bounceTarget.bankName ? <p className="mt-1">Bank: {bounceTarget.bankName}</p> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Bounce date</Label>
                  <Input type="date" className="mt-1.5" value={bounceDate} onChange={(e) => setBounceDate(e.target.value)} />
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input className="mt-1.5" value={currency(bounceTarget.credit)} disabled />
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
                      <Label>{referenceLabel(resolvedBounceRepaySelection.paymentMethod as VendorPaymentMethod)}</Label>
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
                <Button variant="danger" onClick={requestBounceSubmit} disabled={bounceSubmitting}>
                  {bounceSubmitting ? "Saving..." : bounceRecordRepay ? "Bounce & repay" : "Mark bounced"}
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
        confirmLabel={pendingBouncePayload?.recordRepayment ? "Bounce & repay" : "Mark bounced"}
        confirmVariant="danger"
        isPending={bounceSubmitting}
        onOpenChange={(open) => {
          if (!open && !bounceSubmitting) {
            setBounceConfirmOpen(false);
            if (pendingBouncePayload) {
              setBounceModalOpen(true);
              setPendingBouncePayload(null);
            }
          }
        }}
        onConfirm={submitBounce}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Vendor"
        description={`Delete vendor "${deleteTarget?.supplierName ?? ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isPending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={onDelete}
      />
    </div>
  );
}
