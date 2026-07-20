"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
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
import { FieldError } from "@/components/ui/field-error";
import { useCrud } from "@/hooks/use-crud";
import { MobileInput, bindMobileField } from "@/components/ui/pakistan-fields";
import { formatMobileInput } from "@/lib/pakistan-validators";
import { currency } from "@/lib/utils";
import { customerSchema } from "@/schemas/domain";
import type { CustomerInput } from "@/types";

type Customer = CustomerInput & { _id: string; currentBalance?: number };

const formSchema = customerSchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = {
  name: "",
  phone: "",
  address: "",
  creditLimit: 0,
  openingBalance: 0,
  notes: "",
  status: "active",
};

export function CustomersManager() {
  const { list, create, update, remove, params, setParams } = useCrud<CustomerInput, Customer>("customers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Customer) => {
    setEditing(item);
    form.reset({
      name: item.name,
      phone: formatMobileInput(item.phone),
      address: item.address ?? "",
      creditLimit: item.creditLimit,
      openingBalance: item.openingBalance,
      notes: item.notes ?? "",
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
        toast.success("Customer updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Customer created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save customer.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Customer deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete customer.");
    }
  };

  const items = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Customers</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Manage customer profiles, credit limits, and outstanding balances.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Customer
        </Button>
      </div>

      <Surface>
        <DataToolbar placeholder="Search customers" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Credit Limit</th>
                <th className="px-4 py-3 font-medium">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={6} label="Loading customers..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    No customers found. Add your first customer.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const balance = item.currentBalance ?? item.openingBalance ?? 0;
                  const overLimit = balance > item.creditLimit && item.creditLimit > 0;
                  return (
                    <tr key={item._id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.phone}</td>
                      <td className="px-4 py-3">{currency(item.creditLimit)}</td>
                      <td className="px-4 py-3">
                        <div>{currency(balance)}</div>
                        {overLimit ? <Badge variant="danger" className="mt-1">Over limit</Badge> : null}
                      </td>
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
        <DialogContent title={editing ? "Edit Customer" : "New Customer"} description="Credit limits control POS credit checkout.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" className="mt-1.5" {...form.register("name")} />
            </div>
            <div>
              <Label htmlFor="phone">Mobile</Label>
              <MobileInput id="phone" className="mt-1.5" {...bindMobileField(form.register, "phone")} />
              <FieldError message={form.formState.errors.phone?.message} />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" className="mt-1.5" {...form.register("address")} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="creditLimit">Credit Limit</Label>
                <Input id="creditLimit" type="number" min={0} className="mt-1.5" {...form.register("creditLimit", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="openingBalance">Opening Balance</Label>
                <Input id="openingBalance" type="number" className="mt-1.5" {...form.register("openingBalance", { valueAsNumber: true })} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" className="mt-1.5" {...form.register("notes")} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" className="mt-1.5" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
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
        title="Delete Customer"
        description={`Delete customer "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
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
