"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Pencil, Plus, Trash2, Users } from "lucide-react";
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
import { currency } from "@/lib/utils";
import { employeeSchema } from "@/schemas/domain";
import type { EmployeeInput } from "@/types";

type Employee = EmployeeInput & {
  _id: string;
  employeeId?: string;
  dateOfBirth?: string | Date | null;
  joiningDate?: string | Date;
};

type EmployeeStats = {
  total: number;
  active: number;
  inactive: number;
  monthlySalaryCommitment: number;
};

const formSchema = employeeSchema;
type FormValues = z.input<typeof formSchema>;

function toDateInput(value?: Date | string | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const emptyValues: FormValues = {
  fullName: "",
  profileImage: "",
  cnic: "",
  phone: "",
  email: "",
  address: "",
  dateOfBirth: null,
  joiningDate: new Date(),
  department: "",
  designation: "",
  salary: 0,
  employmentType: "full_time",
  shift: "morning",
  emergencyContact: "",
  status: "active",
  notes: "",
};

export function EmployeesManager() {
  const { list, create, update, remove, params, setParams } = useCrud<EmployeeInput, Employee>("employees");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  const stats = useQuery({
    queryKey: ["employees", "stats"],
    queryFn: async () => {
      const response = await fetch("/api/employees?stats=1");
      if (!response.ok) throw new Error("Unable to load employee stats");
      return response.json() as Promise<EmployeeStats>;
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    form.reset({ ...emptyValues, joiningDate: new Date() });
    setDialogOpen(true);
  };

  const openEdit = (item: Employee) => {
    setEditing(item);
    form.reset({
      fullName: item.fullName,
      profileImage: item.profileImage ?? "",
      cnic: item.cnic,
      phone: item.phone,
      email: item.email ?? "",
      address: item.address ?? "",
      dateOfBirth: item.dateOfBirth ? new Date(item.dateOfBirth) : null,
      joiningDate: item.joiningDate ? new Date(item.joiningDate) : new Date(),
      department: item.department,
      designation: item.designation,
      salary: item.salary,
      employmentType: item.employmentType,
      shift: item.shift,
      emergencyContact: item.emergencyContact ?? "",
      status: item.status,
      notes: item.notes ?? "",
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
        toast.success("Employee updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Employee created.");
      }
      setDialogOpen(false);
      void stats.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save employee.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Employee deleted.");
      setDeleteTarget(null);
      void stats.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete employee.");
    }
  };

  const items = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;
  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Employees</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Manage staff profiles, departments, and salary commitments.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Employee
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Surface>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">Total Employees</p>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{s?.total ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Active</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-600">{s?.active ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Inactive</p>
          <p className="mt-3 text-2xl font-semibold">{s?.inactive ?? "—"}</p>
        </Surface>
        <Surface>
          <p className="text-sm text-zinc-500">Monthly Salary</p>
          <p className="mt-3 text-2xl font-semibold">{currency(s?.monthlySalaryCommitment ?? 0)}</p>
        </Surface>
      </div>

      <Surface>
        <DataToolbar placeholder="Search employees" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Salary</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={8} label="Loading employees..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    No employees found. Add your first employee.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium">{item.fullName}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.employeeId ?? "—"}</td>
                    <td className="px-4 py-3">{item.department}</td>
                    <td className="px-4 py-3">{item.designation}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.phone}</td>
                    <td className="px-4 py-3">{currency(item.salary)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="ghost" title="View profile">
                          <Link href={`/employees/${item._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
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
        <DialogContent title={editing ? "Edit Employee" : "New Employee"} description="Staff details used for attendance and payroll.">
          <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" className="mt-1.5" {...form.register("fullName")} />
              </div>
              <div>
                <Label htmlFor="cnic">CNIC</Label>
                <Input id="cnic" className="mt-1.5" {...form.register("cnic")} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" className="mt-1.5" {...form.register("phone")} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className="mt-1.5" {...form.register("email")} />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input id="department" className="mt-1.5" {...form.register("department")} />
              </div>
              <div>
                <Label htmlFor="designation">Designation</Label>
                <Input id="designation" className="mt-1.5" {...form.register("designation")} />
              </div>
              <div>
                <Label htmlFor="salary">Salary</Label>
                <Input id="salary" type="number" min={0} className="mt-1.5" {...form.register("salary", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="profileImage">Profile Image URL</Label>
                <Input id="profileImage" className="mt-1.5" {...form.register("profileImage")} />
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  className="mt-1.5"
                  value={toDateInput(form.watch("dateOfBirth") as Date | string | null)}
                  onChange={(e) => form.setValue("dateOfBirth", e.target.value ? new Date(e.target.value) : null)}
                />
              </div>
              <div>
                <Label htmlFor="joiningDate">Joining Date</Label>
                <Input
                  id="joiningDate"
                  type="date"
                  className="mt-1.5"
                  value={toDateInput(form.watch("joiningDate") as Date | string)}
                  onChange={(e) => form.setValue("joiningDate", e.target.value ? new Date(e.target.value) : new Date(), { shouldValidate: true })}
                />
              </div>
              <div>
                <Label htmlFor="employmentType">Employment Type</Label>
                <Select id="employmentType" className="mt-1.5" {...form.register("employmentType")}>
                  <option value="full_time">Full time</option>
                  <option value="part_time">Part time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="shift">Shift</Label>
                <Select id="shift" className="mt-1.5" {...form.register("shift")}>
                  <option value="morning">Morning</option>
                  <option value="evening">Evening</option>
                  <option value="night">Night</option>
                  <option value="flexible">Flexible</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input id="emergencyContact" className="mt-1.5" {...form.register("emergencyContact")} />
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
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" className="mt-1.5" {...form.register("address")} />
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
        title="Delete Employee"
        description={`Delete employee "${deleteTarget?.fullName ?? ""}"? This action cannot be undone.`}
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
