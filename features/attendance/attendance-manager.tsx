"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { attendanceSchema } from "@/schemas/domain";
import { exportRowsToExcel, exportRowsToPdf } from "@/services/report-export";
import type { AttendanceInput, EmployeeInput } from "@/types";

type ReportPeriod = "today" | "week" | "month" | "custom";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function periodRange(period: ReportPeriod): { from?: string; to?: string } {
  const now = new Date();
  const today = toDateKey(now);
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return { from: toDateKey(start), to: today };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateKey(start), to: today };
  }
  return {};
}

type Employee = EmployeeInput & { _id: string; employeeId?: string };

type AttendanceRow = Omit<AttendanceInput, "employee" | "date"> & {
  _id: string;
  employee:
    | string
    | {
        _id: string;
        fullName?: string;
        employeeId?: string;
        department?: string;
        designation?: string;
      };
  date: string | Date;
  checkIn?: string;
  checkOut?: string;
  notes?: string;
};

type AttendanceDashboard = {
  activeEmployees: number;
  today: { present: number; absent: number; leave: number; late: number; marked: number };
  month: { present: number; leave: number; late: number; percentage: number };
};

const formSchema = attendanceSchema;
type FormValues = z.input<typeof formSchema>;

function toDateInput(value?: Date | string | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function employeeLabel(row: AttendanceRow) {
  if (typeof row.employee === "object" && row.employee) {
    return row.employee.fullName ?? row.employee.employeeId ?? "Employee";
  }
  return "Employee";
}

function statusVariant(status: string): "success" | "danger" | "warning" | "default" {
  if (status === "present") return "success";
  if (status === "absent") return "danger";
  if (status === "late" || status === "early_leave" || status === "half_day") return "warning";
  return "default";
}

const emptyValues: FormValues = {
  employee: "",
  date: new Date(),
  checkIn: "",
  checkOut: "",
  status: "present",
  notes: "",
};

export function AttendanceManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("custom");
  const [params, setParams] = useState<{ q?: string; page: number; limit: number; status?: string; from?: string; to?: string }>({
    page: 1,
    limit: 20,
  });

  const applyPeriod = (period: ReportPeriod) => {
    setReportPeriod(period);
    if (period === "custom") return;
    const range = periodRange(period);
    setParams((p) => ({ ...p, from: range.from, to: range.to, page: 1 }));
  };

  const dashboard = useQuery({
    queryKey: ["attendance", "dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/attendance?dashboard=1");
      if (!response.ok) throw new Error("Unable to load attendance dashboard");
      return response.json() as Promise<AttendanceDashboard>;
    },
  });

  const employees = useQuery({
    queryKey: ["employees", "active-options"],
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
    if (params.status) search.set("status", params.status);
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    return search.toString();
  }, [params]);

  const list = useQuery({
    queryKey: ["attendance", params],
    queryFn: async () => {
      const response = await fetch(`/api/attendance?${listQuery}`);
      if (!response.ok) throw new Error("Unable to load attendance");
      return response.json() as Promise<{ items: AttendanceRow[]; total: number; page: number; pages: number }>;
    },
  });

  const create = useMutation({
    mutationFn: async (input: AttendanceInput) => {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to mark attendance");
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openMark = () => {
    form.reset({ ...emptyValues, date: new Date() });
    setDialogOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = formSchema.parse(values);
      await create.mutateAsync(payload);
      toast.success("Attendance marked.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to mark attendance.");
    }
  });

  const items = list.data?.items ?? [];
  const d = dashboard.data;

  const onExportPdf = () => {
    exportRowsToPdf(
      "Attendance Report",
      ["Date", "Employee", "Check In", "Check Out", "Status", "Notes"],
      items.map((row) => [
        toDateInput(row.date),
        employeeLabel(row),
        row.checkIn || "—",
        row.checkOut || "—",
        row.status,
        row.notes || "",
      ]),
    );
  };

  const onExportExcel = () => {
    exportRowsToExcel(
      "Attendance Report",
      ["Date", "Employee", "Check In", "Check Out", "Status", "Notes"],
      items.map((row) => [
        toDateInput(row.date),
        employeeLabel(row),
        row.checkIn || "—",
        row.checkOut || "—",
        row.status,
        row.notes || "",
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Attendance</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Track daily presence, leave, and monthly attendance rates.</p>
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
          <Button onClick={openMark}>
            <Plus className="h-4 w-4" />
            Mark Attendance
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Surface>
          <p className="text-sm text-zinc-500">Present Today</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-600">{d?.today.present ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Absent Today</p>
          <p className="mt-3 text-2xl font-semibold">{d?.today.absent ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">On Leave Today</p>
          <p className="mt-3 text-2xl font-semibold">{d?.today.leave ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Late Today</p>
          <p className="mt-3 text-2xl font-semibold text-amber-600">{d?.today.late ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Monthly Late</p>
          <p className="mt-3 text-2xl font-semibold text-amber-600">{d?.month.late ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Monthly Leave</p>
          <p className="mt-3 text-2xl font-semibold">{d?.month.leave ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Monthly %</p>
          <p className="mt-3 text-2xl font-semibold">{d ? `${d.month.percentage}%` : "—"}</p>
        </Surface>
      </div>

      <Surface>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={reportPeriod === key ? "primary" : "secondary"}
              className={cn(reportPeriod === key && "ring-2 ring-emerald-500/40")}
              onClick={() => applyPeriod(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="attendanceStatusFilter">Status</Label>
            <Select
              id="attendanceStatusFilter"
              className="mt-1.5"
              value={params.status ?? ""}
              onChange={(e) => setParams((p) => ({ ...p, status: e.target.value || undefined, page: 1 }))}
            >
              <option value="">All statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half day</option>
              <option value="leave">Leave</option>
              <option value="late">Late</option>
              <option value="early_leave">Early leave</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="fromDate">From</Label>
            <Input
              id="fromDate"
              type="date"
              className="mt-1.5"
              value={params.from ?? ""}
              onChange={(e) => {
                setReportPeriod("custom");
                setParams((p) => ({ ...p, from: e.target.value || undefined, page: 1 }));
              }}
            />
          </div>
          <div>
            <Label htmlFor="toDate">To</Label>
            <Input
              id="toDate"
              type="date"
              className="mt-1.5"
              value={params.to ?? ""}
              onChange={(e) => {
                setReportPeriod("custom");
                setParams((p) => ({ ...p, to: e.target.value || undefined, page: 1 }));
              }}
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Check In</th>
                <th className="px-4 py-3 font-medium">Check Out</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={6} label="Loading attendance..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3">{toDateInput(item.date)}</td>
                    <td className="px-4 py-3 font-medium">{employeeLabel(item)}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.checkIn || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.checkOut || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(item.status)}>{item.status.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{item.notes || "—"}</td>
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
        <DialogContent title="Mark Attendance" description="Record check-in and status for an employee.">
          <form onSubmit={onSubmit} className="space-y-4">
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
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                className="mt-1.5"
                value={toDateInput(form.watch("date") as Date | string)}
                onChange={(e) => form.setValue("date", e.target.value ? new Date(e.target.value) : new Date(), { shouldValidate: true })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="checkIn">Check In</Label>
                <Input id="checkIn" type="time" className="mt-1.5" {...form.register("checkIn")} />
              </div>
              <div>
                <Label htmlFor="checkOut">Check Out</Label>
                <Input id="checkOut" type="time" className="mt-1.5" {...form.register("checkOut")} />
              </div>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" className="mt-1.5" {...form.register("status")}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half day</option>
                <option value="leave">Leave</option>
                <option value="late">Late</option>
                <option value="early_leave">Early leave</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" className="mt-1.5" {...form.register("notes")} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={create.isPending} loadingLabel="Saving...">
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
