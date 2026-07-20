"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Pencil, Plus, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { z } from "zod";
import { PaginationBar } from "@/components/crud/data-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { currency } from "@/lib/utils";
import { salarySchema } from "@/schemas/domain";
import type { EmployeeInput, SalaryInput } from "@/types";

type Employee = EmployeeInput & { _id: string; employeeId?: string };

type SalaryRow = Omit<SalaryInput, "employee"> & {
  _id: string;
  netSalary?: number;
  paidAt?: string | Date | null;
  employee:
    | string
    | {
        _id: string;
        fullName?: string;
        employeeId?: string;
        department?: string;
        designation?: string;
      };
};

type SalaryDashboard = {
  month: number;
  year: number;
  totalPaid: number;
  totalPending: number;
  monthlyExpense: number;
  count: number;
};

const formSchema = salarySchema;
type FormValues = z.input<typeof formSchema>;

function employeeName(row: SalaryRow) {
  if (typeof row.employee === "object" && row.employee) {
    return row.employee.fullName ?? row.employee.employeeId ?? "Employee";
  }
  return "Employee";
}

function employeeIdOf(row: SalaryRow) {
  if (typeof row.employee === "object" && row.employee) return row.employee._id;
  return typeof row.employee === "string" ? row.employee : "";
}

function computeNet(parts: {
  basicSalary: number;
  bonus: number;
  overtime: number;
  allowance: number;
  deductions: number;
  advanceSalary: number;
  tax: number;
}) {
  return Math.max(
    0,
    Number(parts.basicSalary || 0) +
      Number(parts.bonus || 0) +
      Number(parts.overtime || 0) +
      Number(parts.allowance || 0) -
      Number(parts.deductions || 0) -
      Number(parts.advanceSalary || 0) -
      Number(parts.tax || 0),
  );
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function downloadSalarySlip(row: SalaryRow) {
  const doc = new jsPDF();
  const name = employeeName(row);
  const net = row.netSalary ?? computeNet(row);
  doc.setFontSize(18);
  doc.text("Salary Slip", 14, 20);
  doc.setFontSize(12);
  doc.text(`Employee: ${name}`, 14, 34);
  doc.text(`Period: ${monthLabel(row.month, row.year)}`, 14, 42);
  doc.text(`Status: ${row.paymentStatus}`, 14, 50);
  let y = 64;
  const lines: Array<[string, number]> = [
    ["Basic Salary", row.basicSalary],
    ["Bonus", row.bonus],
    ["Overtime", row.overtime],
    ["Allowance", row.allowance],
    ["Deductions", -row.deductions],
    ["Advance", -row.advanceSalary],
    ["Tax", -row.tax],
  ];
  for (const [label, amount] of lines) {
    doc.text(`${label}: ${currency(Math.abs(amount))}${amount < 0 ? " (−)" : ""}`, 14, y);
    y += 8;
  }
  doc.setFontSize(14);
  doc.text(`Net Salary: ${currency(net)}`, 14, y + 8);
  if (row.notes) {
    doc.setFontSize(11);
    doc.text(`Notes: ${row.notes}`, 14, y + 20);
  }
  doc.save(`salary-slip-${name.replace(/\s+/g, "-").toLowerCase()}-${row.month}-${row.year}.pdf`);
}

const now = new Date();
const emptyValues: FormValues = {
  employee: "",
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  basicSalary: 0,
  bonus: 0,
  overtime: 0,
  allowance: 0,
  deductions: 0,
  advanceSalary: 0,
  tax: 0,
  paymentStatus: "pending",
  notes: "",
};

export function SalariesManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryRow | null>(null);
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);
  const [genYear, setGenYear] = useState(now.getFullYear());
  const [params, setParams] = useState<{ page: number; limit: number; paymentStatus?: string; month?: number; year?: number }>({
    page: 1,
    limit: 20,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const dashboard = useQuery({
    queryKey: ["salaries", "dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/salaries?dashboard=1");
      if (!response.ok) throw new Error("Unable to load salary dashboard");
      return response.json() as Promise<SalaryDashboard>;
    },
  });

  const employees = useQuery({
    queryKey: ["employees", "salary-options"],
    queryFn: async () => {
      const response = await fetch("/api/employees?limit=100&status=active");
      if (!response.ok) throw new Error("Unable to load employees");
      return response.json() as Promise<{ items: Employee[] }>;
    },
  });

  const listQuery = useMemo(() => {
    const search = new URLSearchParams();
    search.set("page", String(params.page));
    search.set("limit", String(params.limit));
    if (params.paymentStatus) search.set("paymentStatus", params.paymentStatus);
    if (params.month) search.set("month", String(params.month));
    if (params.year) search.set("year", String(params.year));
    return search.toString();
  }, [params]);

  const list = useQuery({
    queryKey: ["salaries", params],
    queryFn: async () => {
      const response = await fetch(`/api/salaries?${listQuery}`);
      if (!response.ok) throw new Error("Unable to load salaries");
      return response.json() as Promise<{ items: SalaryRow[]; total: number; page: number; pages: number }>;
    },
  });

  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SalaryInput }) => {
      if (id) {
        const response = await fetch(`/api/salaries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to update salary");
        return data;
      }
      const response = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to save salary");
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["salaries"] });
    },
  });

  const generate = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      const response = await fetch("/api/salaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, month, year }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to generate salaries");
      return data as { count: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["salaries"] });
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/salaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "paid" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to mark paid");
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["salaries"] });
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });
  const watched = form.watch();
  const netPreview = computeNet({
    basicSalary: Number(watched.basicSalary) || 0,
    bonus: Number(watched.bonus) || 0,
    overtime: Number(watched.overtime) || 0,
    allowance: Number(watched.allowance) || 0,
    deductions: Number(watched.deductions) || 0,
    advanceSalary: Number(watched.advanceSalary) || 0,
    tax: Number(watched.tax) || 0,
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ ...emptyValues, month: params.month ?? now.getMonth() + 1, year: params.year ?? now.getFullYear() });
    setDialogOpen(true);
  };

  const openEdit = (item: SalaryRow) => {
    setEditing(item);
    form.reset({
      employee: employeeIdOf(item),
      month: item.month,
      year: item.year,
      basicSalary: item.basicSalary,
      bonus: item.bonus,
      overtime: item.overtime,
      allowance: item.allowance,
      deductions: item.deductions,
      advanceSalary: item.advanceSalary,
      tax: item.tax,
      paymentStatus: item.paymentStatus,
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = formSchema.parse(values);
      await save.mutateAsync({ id: editing?._id, input: payload });
      toast.success(editing ? "Salary updated." : "Salary saved.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save salary.");
    }
  });

  const onGenerate = async () => {
    try {
      const result = await generate.mutateAsync({ month: genMonth, year: genYear });
      toast.success(`Generated ${result.count} salary record${result.count === 1 ? "" : "s"}.`);
      setGenerateOpen(false);
      setParams((p) => ({ ...p, month: genMonth, year: genYear, page: 1 }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate salaries.");
    }
  };

  const onMarkPaid = async (item: SalaryRow) => {
    try {
      await markPaid.mutateAsync(item._id);
      toast.success("Salary marked as paid.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark paid.");
    }
  };

  const items = list.data?.items ?? [];
  const d = dashboard.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Salaries</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Generate monthly payroll, track payments, and download salary slips.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setGenerateOpen(true)}>
            Generate Monthly
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Salary
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Surface>
          <p className="text-sm text-zinc-500">Paid ({d ? monthLabel(d.month, d.year) : "this month"})</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-600">{currency(d?.totalPaid ?? 0)}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Pending</p>
          <p className="mt-3 text-2xl font-semibold text-amber-600">{currency(d?.totalPending ?? 0)}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Monthly Expense</p>
          <p className="mt-3 text-2xl font-semibold">{currency(d?.monthlyExpense ?? 0)}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Records</p>
          <p className="mt-3 text-2xl font-semibold">{d?.count ?? "—"}</p>
        </Surface>
      </div>

      <Surface>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="filterMonth">Month</Label>
            <Select
              id="filterMonth"
              className="mt-1.5"
              value={String(params.month ?? "")}
              onChange={(e) => setParams((p) => ({ ...p, month: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
            >
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filterYear">Year</Label>
            <Input
              id="filterYear"
              type="number"
              className="mt-1.5"
              value={params.year ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, year: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
            />
          </div>
          <div>
            <Label htmlFor="filterPayment">Payment status</Label>
            <Select
              id="filterPayment"
              className="mt-1.5"
              value={params.paymentStatus ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, paymentStatus: e.target.value || undefined, page: 1 }))}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </Select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Basic</th>
                <th className="px-4 py-3 font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    Loading salaries...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No salary records found. Generate monthly salaries to get started.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const net = item.netSalary ?? computeNet(item);
                  return (
                    <tr key={item._id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-3 font-medium">{employeeName(item)}</td>
                      <td className="px-4 py-3">{monthLabel(item.month, item.year)}</td>
                      <td className="px-4 py-3">{currency(item.basicSalary)}</td>
                      <td className="px-4 py-3 font-medium">{currency(net)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.paymentStatus === "paid" ? "success" : "warning"}>{item.paymentStatus}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" title="Download slip" onClick={() => downloadSalarySlip(item)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Print slip" onClick={() => downloadSalarySlip(item)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {item.paymentStatus !== "paid" ? (
                            <Button size="sm" variant="secondary" disabled={markPaid.isPending} onClick={() => void onMarkPaid(item)}>
                              Mark paid
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
        <DialogContent title={editing ? "Edit Salary" : "New Salary"} description="Net pay is calculated from earnings and deductions.">
          <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <Label htmlFor="employee">Employee</Label>
              <Select id="employee" className="mt-1.5" {...form.register("employee")}>
                <option value="">Select employee</option>
                {(employees.data?.items ?? []).map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName}
                    {emp.employeeId ? ` (${emp.employeeId})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="month">Month</Label>
                <Select id="month" className="mt-1.5" {...form.register("month", { valueAsNumber: true })}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" className="mt-1.5" {...form.register("year", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="basicSalary">Basic Salary</Label>
                <Input id="basicSalary" type="number" min={0} className="mt-1.5" {...form.register("basicSalary", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="bonus">Bonus</Label>
                <Input id="bonus" type="number" min={0} className="mt-1.5" {...form.register("bonus", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="overtime">Overtime</Label>
                <Input id="overtime" type="number" min={0} className="mt-1.5" {...form.register("overtime", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="allowance">Allowance</Label>
                <Input id="allowance" type="number" min={0} className="mt-1.5" {...form.register("allowance", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="deductions">Deductions</Label>
                <Input id="deductions" type="number" min={0} className="mt-1.5" {...form.register("deductions", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="advanceSalary">Advance</Label>
                <Input id="advanceSalary" type="number" min={0} className="mt-1.5" {...form.register("advanceSalary", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="tax">Tax</Label>
                <Input id="tax" type="number" min={0} className="mt-1.5" {...form.register("tax", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="paymentStatus">Payment Status</Label>
                <Select id="paymentStatus" className="mt-1.5" {...form.register("paymentStatus")}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" className="mt-1.5" {...form.register("notes")} />
            </div>
            <Surface className="bg-zinc-50 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">Computed net salary</p>
              <p className="mt-1 text-2xl font-semibold">{currency(netPreview)}</p>
            </Surface>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent title="Generate Monthly Salaries" description="Creates pending salary rows for all active employees.">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="genMonth">Month</Label>
                <Select id="genMonth" className="mt-1.5" value={String(genMonth)} onChange={(e) => setGenMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: "long" })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="genYear">Year</Label>
                <Input id="genYear" type="number" className="mt-1.5" value={genYear} onChange={(e) => setGenYear(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setGenerateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void onGenerate()} disabled={generate.isPending}>
                {generate.isPending ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
