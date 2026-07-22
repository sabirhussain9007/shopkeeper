"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Download, Landmark, Plus, RefreshCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BankAccountsPanel } from "@/features/bank/bank-accounts-panel";
import { sourceTypeLabel, shopAccountTypeLabel } from "@/lib/bank-labels";
import { currency, formatPakistanDate, pakistanTodayKey } from "@/lib/utils";
import type { BankAccountInput } from "@/types";

type RegisteredBankAccount = BankAccountInput & { _id: string };

type BankTransaction = {
  _id: string;
  entryDate: string;
  sourceType?: string;
  paymentMethod?: string;
  bankName?: string;
  description: string;
  reference?: string;
  chequeNumber?: string;
  counterpartyName?: string;
  moneyIn: number;
  moneyOut: number;
};

type BankResponse = {
  summary: {
    totalBalance: number;
    banks: Array<{ bankName: string; balance: number }>;
    totals?: { moneyIn: number; moneyOut: number };
  };
  items: BankTransaction[];
  total: number;
  page: number;
  pages: number;
};

const SOURCE_FILTERS = [
  { value: "", label: "All sources" },
  { value: "sale", label: "POS Sales" },
  { value: "customer_payment", label: "Customer Payments" },
  { value: "vendor_payment", label: "Vendor Payments" },
  { value: "purchase", label: "Purchases" },
  { value: "expense", label: "Expenses" },
  { value: "salary", label: "Salaries" },
  { value: "deposit", label: "Deposits" },
  { value: "cheque_bounce_repay", label: "Cheque Repayments" },
  { value: "manual", label: "Manual" },
];

export function BankManager() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [params, setParams] = useState<{ page: number; limit: number; bankName?: string; sourceType?: string }>({
    page: 1,
    limit: 50,
  });
  const [backfillPending, setBackfillPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositType, setDepositType] = useState<"cash" | "cheque">("cash");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositBankName, setDepositBankName] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositChequeDate, setDepositChequeDate] = useState("");
  const [depositDate, setDepositDate] = useState(() => pakistanTodayKey());
  const [depositDescription, setDepositDescription] = useState("");

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    search.set("page", String(params.page));
    search.set("limit", String(params.limit));
    if (params.bankName) search.set("bankName", params.bankName);
    if (params.sourceType) search.set("sourceType", params.sourceType);
    return search.toString();
  }, [params]);

  const list = useQuery({
    queryKey: ["bank-transactions", params],
    queryFn: async () => {
      const response = await fetch(`/api/bank/transactions?${queryString}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Unable to load bank transactions");
      }
      return response.json() as Promise<BankResponse>;
    },
  });

  const bankAccounts = useQuery({
    queryKey: ["bank-accounts", "active"],
    queryFn: async () => {
      const response = await fetch("/api/bank-accounts?status=active&limit=100");
      if (!response.ok) throw new Error("Unable to load bank accounts");
      return response.json() as Promise<{ items: RegisteredBankAccount[] }>;
    },
  });

  const activeAccounts = bankAccounts.data?.items ?? [];

  const deposit = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch("/api/bank/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to record deposit");
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });

  const resetDepositForm = () => {
    setDepositType("cash");
    setDepositAmount("");
    setDepositBankName("");
    setDepositReference("");
    setDepositChequeDate("");
    setDepositDate(pakistanTodayKey());
    setDepositDescription("");
  };

  const openDeposit = () => {
    resetDepositForm();
    if (activeAccounts.length > 0) {
      setDepositBankName(activeAccounts[0].name);
    }
    setDepositOpen(true);
  };

  const submitDeposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid deposit amount.");
      return;
    }
    if (!depositBankName.trim()) {
      toast.error("Select a bank account.");
      return;
    }
    if (depositType === "cheque" && !depositReference.trim()) {
      toast.error("Enter cheque number.");
      return;
    }
    if (depositType === "cheque" && !depositChequeDate) {
      toast.error("Select cheque date.");
      return;
    }
    try {
      await deposit.mutateAsync({
        depositType,
        amount,
        bankName: depositBankName.trim(),
        reference: depositReference.trim(),
        description: depositDescription.trim(),
        entryDate: depositDate,
        chequeDate: depositType === "cheque" ? depositChequeDate : null,
      });
      toast.success(depositType === "cash" ? "Cash deposit recorded." : "Cheque deposit recorded.");
      setDepositOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deposit failed.");
    }
  };

  const syncAllTransactions = async () => {
    setBackfillPending(true);
    try {
      const response = await fetch("/api/bank/backfill", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Sync failed");
      const stats = data.stats as Record<string, number>;
      const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
      toast.success(`Synced ${total} records from sales, purchases, payments, expenses, and salaries.`);
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setBackfillPending(false);
    }
  };

  const onBankFilter = useCallback((bankName: string) => setParams((p) => ({ ...p, bankName: bankName || undefined, page: 1 })), []);
  const onSourceFilter = useCallback((sourceType: string) => setParams((p) => ({ ...p, sourceType: sourceType || undefined, page: 1 })), []);

  const refreshPage = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bank-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh bank data.");
    } finally {
      setRefreshing(false);
    }
  };

  const items = list.data?.items ?? [];
  const summary = list.data?.summary ?? { totalBalance: 0, banks: [], totals: { moneyIn: 0, moneyOut: 0 } };
  const bankOptions = summary.banks.map((b) => b.bankName);
  const filterTotals = summary.totals ?? { moneyIn: 0, moneyOut: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Bank</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            All bank movements from sales, purchases, vendor payments, customer collections, expenses, salaries, and deposits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void syncAllTransactions()} loading={backfillPending} loadingLabel="Syncing...">
            <Download className="h-4 w-4" />
            Sync all transactions
          </Button>
          <Button type="button" variant="secondary" loading={refreshing} loadingLabel="Refreshing..." onClick={() => void refreshPage()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openDeposit}>
            <Plus className="h-4 w-4" />
            Record Deposit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Landmark className="h-4 w-4" />
            Total bank balance
          </div>
          <p className="mt-2 text-2xl font-semibold">{currency(summary.totalBalance)}</p>
        </Card>
        {summary.banks.map((bank) => (
          <Card
            key={bank.bankName}
            className={params.bankName === bank.bankName ? "ring-2 ring-emerald-500" : "cursor-pointer"}
            onClick={() => onBankFilter(params.bankName === bank.bankName ? "" : bank.bankName)}
          >
            <p className="text-sm text-zinc-500">{bank.bankName}</p>
            <p className="mt-2 text-2xl font-semibold">{currency(bank.balance)}</p>
          </Card>
        ))}
      </div>

      {isAdmin ? <BankAccountsPanel /> : null}

      <Surface className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-56">
            <Label htmlFor="bank-filter">Bank account</Label>
            <Select id="bank-filter" className="mt-1.5" value={params.bankName ?? ""} onChange={(e) => onBankFilter(e.target.value)}>
              <option value="">All banks</option>
              {bankOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__unassigned__">Unassigned</option>
            </Select>
          </div>
          <div className="sm:w-56">
            <Label htmlFor="source-filter">Source</Label>
            <Select id="source-filter" className="mt-1.5" value={params.sourceType ?? ""} onChange={(e) => onSourceFilter(e.target.value)}>
              {SOURCE_FILTERS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="text-sm text-zinc-500 sm:ml-auto">
            {list.data?.total ?? 0} transaction{(list.data?.total ?? 0) === 1 ? "" : "s"}
            {params.bankName ? ` · ${params.bankName === "__unassigned__" ? "Unassigned" : params.bankName}` : " · all banks"}
          </div>
        </div>

        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Bank</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 text-right font-medium">In</th>
                <th className="px-4 py-3 text-right font-medium">Out</th>
              </tr>
            </thead>
            <tbody className="bg-white text-zinc-950">
              {list.isLoading ? (
                <TableLoader colSpan={8} label="Loading bank transactions..." />
              ) : list.isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    {list.error instanceof Error ? list.error.message : "Unable to load bank transactions."}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    No bank transactions yet. Click &quot;Sync all transactions&quot; to import from sales, payments, and expenses.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{formatPakistanDate(item.entryDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{sourceTypeLabel(item.sourceType)}</Badge>
                    </td>
                    <td className="px-4 py-3">{item.bankName || "Unassigned"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="truncate" title={item.description}>
                        {item.description}
                      </div>
                      {item.counterpartyName ? <div className="text-xs text-zinc-500">{item.counterpartyName}</div> : null}
                    </td>
                    <td className="px-4 py-3 capitalize">{item.paymentMethod || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.chequeNumber || item.reference || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">{item.moneyIn > 0 ? currency(item.moneyIn) : "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-700">{item.moneyOut > 0 ? currency(item.moneyOut) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 ? (
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right text-zinc-600">
                    Filtered totals
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700">{currency(filterTotals.moneyIn)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{currency(filterTotals.moneyOut)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <PaginationBar
          page={list.data?.page ?? 1}
          pages={list.data?.pages ?? 1}
          total={list.data?.total ?? 0}
          onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        />
      </Surface>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent title="Record bank deposit" description="Deposit cash from the till or lodge a cheque into your bank account.">
          <div className="space-y-4">
            <div>
              <Label>Deposit type</Label>
              <Select
                className="mt-1.5"
                value={depositType}
                onChange={(e) => {
                  const type = e.target.value as "cash" | "cheque";
                  setDepositType(type);
                  if (type === "cash") {
                    setDepositReference("");
                    setDepositChequeDate("");
                  }
                }}
              >
                <option value="cash">Cash deposit</option>
                <option value="cheque">Cheque deposit</option>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Deposit date</Label>
                <Input type="date" className="mt-1.5" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" min={0} step="0.01" className="mt-1.5" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Account</Label>
              {activeAccounts.length > 0 ? (
                <Select className="mt-1.5" value={depositBankName} onChange={(e) => setDepositBankName(e.target.value)}>
                  <option value="">Select account</option>
                  {activeAccounts.map((account) => (
                    <option key={account._id} value={account.name}>
                      {shopAccountTypeLabel(account.accountType)} · {account.name} · {account.accountNumber}
                    </option>
                  ))}
                </Select>
              ) : (
                <>
                  <Input
                    className="mt-1.5"
                    placeholder="e.g. HBL, EasyPaisa, JazzCash"
                    value={depositBankName}
                    onChange={(e) => setDepositBankName(e.target.value)}
                  />
                  {isAdmin ? (
                    <p className="mt-1 text-xs text-amber-700">Add an account above first for easier selection.</p>
                  ) : (
                    <p className="mt-1 text-xs text-amber-700">Ask your admin to register bank and digital accounts.</p>
                  )}
                </>
              )}
            </div>
            {depositType === "cheque" ? (
              <>
                <div>
                  <Label>Cheque number</Label>
                  <Input className="mt-1.5" value={depositReference} onChange={(e) => setDepositReference(e.target.value)} />
                </div>
                <div>
                  <Label>Cheque date</Label>
                  <Input type="date" className="mt-1.5" value={depositChequeDate} onChange={(e) => setDepositChequeDate(e.target.value)} />
                </div>
              </>
            ) : null}
            <div>
              <Label>Description</Label>
              <Input
                className="mt-1.5"
                placeholder={depositType === "cash" ? "Cash deposited to bank" : "Cheque deposited to bank"}
                value={depositDescription}
                onChange={(e) => setDepositDescription(e.target.value)}
              />
            </div>
            {depositType === "cash" ? (
              <p className="text-xs text-zinc-500">Cash deposits reduce your cash book and increase the selected bank balance.</p>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDepositOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submitDeposit()} loading={deposit.isPending} loadingLabel="Saving...">
                Record deposit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
