"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Wallet, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currency, formatPakistanDate } from "@/lib/utils";
import { accountingEntrySchema } from "@/schemas/domain";
import type { AccountingEntryInput } from "@/types";

type AccountingEntry = AccountingEntryInput & {
  _id: string;
  entryDate?: string;
  createdAt?: string;
};

const formSchema = accountingEntrySchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = {
  book: "cash",
  type: "debit",
  amount: 0,
  reference: "",
  description: "",
  entryDate: new Date(),
};

const bookLabels: Record<AccountingEntryInput["book"], string> = {
  cash: "Cash",
  bank: "Bank",
  income: "Income",
  expense: "Expense",
};

const summaryCards: Array<{
  key: AccountingEntryInput["book"];
  label: string;
  hint: string;
  icon: typeof Wallet;
}> = [
  { key: "cash", label: "Cash", hint: "Cash on hand", icon: Wallet },
  { key: "bank", label: "Bank", hint: "Bank balance", icon: Landmark },
  { key: "income", label: "Income", hint: "Total revenue", icon: TrendingUp },
  { key: "expense", label: "Expense", hint: "Total expenses", icon: TrendingDown },
];

export function AccountingManager() {
  const queryClient = useQueryClient();
  const [params, setParams] = useState<{ page: number; limit: number; book?: string }>({ page: 1, limit: 20 });
  const [dialogOpen, setDialogOpen] = useState(false);

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    search.set("page", String(params.page));
    search.set("limit", String(params.limit));
    if (params.book) search.set("book", params.book);
    return search.toString();
  }, [params]);

  const list = useQuery({
    queryKey: ["accounting", params],
    queryFn: async () => {
      const response = await fetch(`/api/accounting?${queryString}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Unable to load accounting entries");
      }
      return response.json() as Promise<{
        items: AccountingEntry[];
        total: number;
        page: number;
        pages: number;
        summary: Record<AccountingEntryInput["book"], number>;
      }>;
    },
  });

  const create = useMutation({
    mutationFn: async (input: AccountingEntryInput) => {
      const response = await fetch("/api/accounting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save entry");
      return data as AccountingEntry;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    form.reset({ ...emptyValues, entryDate: new Date() });
    setDialogOpen(true);
  };

  const onBookFilter = useCallback((book: string) => setParams((p) => ({ ...p, book: book || undefined, page: 1 })), []);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = formSchema.parse(values);
      await create.mutateAsync(payload);
      toast.success("Accounting entry recorded.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save entry.");
    }
  });

  const items = list.data?.items ?? [];
  const summary = list.data?.summary ?? { cash: 0, bank: 0, income: 0, expense: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Accounting</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Cash, bank, income, and expense ledger entries.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ key, label, hint, icon: Icon }) => (
          <Card
            key={key}
            className={params.book === key ? "cursor-pointer ring-2 ring-emerald-500" : "cursor-pointer"}
            onClick={() => onBookFilter(params.book === key ? "" : key)}
          >
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <p className="mt-2 text-2xl font-semibold">{currency(summary[key])}</p>
            <p className="mt-1 text-xs text-zinc-500">{hint}</p>
          </Card>
        ))}
      </div>

      <Surface className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-48">
            <Label htmlFor="book-filter">Book</Label>
            <Select
              id="book-filter"
              className="mt-1.5"
              value={params.book ?? ""}
              onChange={(e) => onBookFilter(e.target.value)}
            >
              <option value="">All books</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </Select>
          </div>
        </div>

        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Book</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="bg-white text-zinc-950">
              {list.isLoading ? (
                <TableLoader colSpan={6} label="Loading entries..." />
              ) : list.isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    {list.error instanceof Error ? list.error.message : "Unable to load accounting entries."}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No accounting entries yet. Record your first entry.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                      {formatPakistanDate(item.entryDate)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{bookLabels[item.book]}</Badge>
                    </td>
                    <td className="px-4 py-3 capitalize">{item.type}</td>
                    <td className="px-4 py-3 font-medium">{currency(item.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.reference || "—"}</td>
                    <td className="px-4 py-3 max-w-xs truncate" title={item.description}>
                      {item.description}
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
        <DialogContent title="New Accounting Entry" description="Record a debit or credit in the selected book.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="book">Book</Label>
                <Select id="book" className="mt-1.5" {...form.register("book")}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" className="mt-1.5" {...form.register("type")}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" min={0} step="0.01" className="mt-1.5" {...form.register("amount")} />
              {form.formState.errors.amount ? <p className="mt-1 text-xs text-red-500">{form.formState.errors.amount.message}</p> : null}
            </div>
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" className="mt-1.5" placeholder="Invoice #, receipt #, etc." {...form.register("reference")} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" className="mt-1.5" {...form.register("description")} />
              {form.formState.errors.description ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.description.message}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Saving..." : "Record Entry"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
