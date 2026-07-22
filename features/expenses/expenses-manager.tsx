"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrud } from "@/hooks/use-crud";
import { currency, formatPakistanDateInput } from "@/lib/utils";
import { expenseCategories, expenseSchema } from "@/schemas/domain";
import { exportRowsToExcel, exportRowsToPdf } from "@/services/report-export";
import type { ExpenseInput } from "@/types";
import { PaymentMethodAccountSelect } from "@/components/payment/payment-method-account-select";
import { useShopPaymentAccounts } from "@/hooks/use-shop-payment-accounts";
import { findAccountPaymentValue, resolvePaymentSelection } from "@/lib/payment-accounts";

type Expense = ExpenseInput & { _id: string; expenseDate?: string | Date };

type ExpenseDashboard = {
  today: number;
  month: number;
  year: number;
  byCategory: Array<{ category: string; total: number }>;
};

const formSchema = expenseSchema;
type FormValues = z.input<typeof formSchema>;

function toDateInput(value?: Date | string | null) {
  return formatPakistanDateInput(value);
}

const emptyValues: FormValues = {
  category: "miscellaneous",
  title: "",
  amount: 0,
  expenseDate: new Date(),
  paymentMethod: "cash",
  bankName: "",
  reference: "",
  notes: "",
  status: "active",
};

export function ExpensesManager() {
  const { list, create, update, remove, params, setParams } = useCrud<ExpenseInput, Expense>("expenses");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [expensePaymentSelection, setExpensePaymentSelection] = useState("cash");

  const paymentAccountsQuery = useShopPaymentAccounts({ enabled: dialogOpen });
  const paymentAccounts = paymentAccountsQuery.data?.items ?? [];

  const dashboard = useQuery({
    queryKey: ["expenses", "dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/expenses?dashboard=1");
      if (!response.ok) throw new Error("Unable to load expense dashboard");
      return response.json() as Promise<ExpenseDashboard>;
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    setExpensePaymentSelection("cash");
    form.reset({ ...emptyValues, expenseDate: new Date() });
    setDialogOpen(true);
  };

  const openEdit = (item: Expense) => {
    setEditing(item);
    const accountMatch = findAccountPaymentValue(paymentAccounts, item.paymentMethod, item.bankName);
    setExpensePaymentSelection(accountMatch ?? item.paymentMethod);
    form.reset({
      category: item.category,
      title: item.title,
      amount: item.amount,
      expenseDate: item.expenseDate ? new Date(item.expenseDate) : new Date(),
      paymentMethod: item.paymentMethod,
      bankName: item.bankName ?? "",
      reference: item.reference ?? "",
      notes: item.notes ?? "",
      status: item.status,
    });
    setDialogOpen(true);
  };

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q, page: 1 })), [setParams]);
  const onStatusChange = useCallback((status: string) => setParams((p) => ({ ...p, status: status || undefined, page: 1 })), [setParams]);
  const onCategoryChange = useCallback(
    (category: string) => setParams((p) => ({ ...p, category: category || undefined, page: 1 })),
    [setParams],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const resolved = resolvePaymentSelection(expensePaymentSelection, paymentAccounts);
      const payload = formSchema.parse({
        ...values,
        paymentMethod: resolved.paymentMethod as FormValues["paymentMethod"],
        bankName: resolved.bankName,
      });
      if (editing) {
        await update.mutateAsync({ id: editing._id, input: payload });
        toast.success("Expense updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Expense created.");
      }
      setDialogOpen(false);
      void dashboard.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save expense.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Expense deleted.");
      setDeleteTarget(null);
      void dashboard.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete expense.");
    }
  };

  const items = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;
  const d = dashboard.data;

  const onExportPdf = () => {
    exportRowsToPdf(
      "Expenses Report",
      ["Title", "Category", "Amount", "Date", "Payment", "Status"],
      items.map((item) => [item.title, item.category, item.amount, toDateInput(item.expenseDate), item.paymentMethod, item.status]),
    );
  };

  const onExportExcel = () => {
    exportRowsToExcel(
      "Expenses Report",
      ["Title", "Category", "Amount", "Date", "Payment", "Status"],
      items.map((item) => [item.title, item.category, item.amount, toDateInput(item.expenseDate), item.paymentMethod, item.status]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Expenses</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Track operating costs by category with daily and monthly totals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onExportPdf}>
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="secondary" onClick={onExportExcel}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Expense
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Surface>
          <p className="text-sm text-zinc-500">Today</p>
          <p className="mt-3 text-2xl font-semibold">{currency(d?.today ?? 0)}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">This Month</p>
          <p className="mt-3 text-2xl font-semibold">{currency(d?.month ?? 0)}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">This Year</p>
          <p className="mt-3 text-2xl font-semibold">{currency(d?.year ?? 0)}</p>
        </Surface>
      </div>

      {(d?.byCategory?.length ?? 0) > 0 ? (
        <Surface>
          <h3 className="mb-4 text-lg font-semibold">By Category (This Month)</h3>
          <div className="responsive-table-shell">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {d!.byCategory.map((row) => (
                  <tr key={row.category} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 capitalize">{row.category.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 text-right font-medium">{currency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      ) : null}

      <Surface>
        <DataToolbar placeholder="Search expenses" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="mb-4 max-w-xs">
          <Label htmlFor="expenseCategoryFilter">Category</Label>
          <Select
            id="expenseCategoryFilter"
            className="mt-1.5"
            value={params.category ?? ""}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">All categories</option>
            {expenseCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={7} label="Loading expenses..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No expenses found. Add your first expense.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3 capitalize">{item.category.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">{currency(item.amount)}</td>
                    <td className="px-4 py-3 text-zinc-500">{toDateInput(item.expenseDate)}</td>
                    <td className="px-4 py-3 capitalize">{item.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title={editing ? "Edit Expense" : "New Expense"} description="Record shop operating costs.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" className="mt-1.5" {...form.register("title")} />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select id="category" className="mt-1.5" {...form.register("category")}>
                  {expenseCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" min={0} className="mt-1.5" {...form.register("amount", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="expenseDate">Expense Date</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  className="mt-1.5"
                  value={toDateInput(form.watch("expenseDate") as Date | string)}
                  onChange={(e) => form.setValue("expenseDate", e.target.value ? new Date(e.target.value) : new Date(), { shouldValidate: true })}
                />
              </div>
              <div>
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <PaymentMethodAccountSelect
                  id="paymentMethod"
                  className="mt-1.5"
                  value={expensePaymentSelection}
                  onChange={setExpensePaymentSelection}
                  accounts={paymentAccounts}
                  accountsLoading={paymentAccountsQuery.isLoading}
                  baseMethods={[
                    { value: "cash", label: "Cash" },
                    { value: "other", label: "Other" },
                  ]}
                  emptyAccountsHint="Add bank accounts under Finance → Bank."
                />
              </div>
              <div>
                <Label htmlFor="reference">Reference</Label>
                <Input id="reference" className="mt-1.5" {...form.register("reference")} />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" className="mt-1.5" {...form.register("status")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" className="mt-1.5" {...form.register("notes")} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Expense"
        description={`Delete expense "${deleteTarget?.title ?? ""}"? This action cannot be undone.`}
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
