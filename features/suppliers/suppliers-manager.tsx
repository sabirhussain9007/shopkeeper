"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrud } from "@/hooks/use-crud";
import { supplierSchema } from "@/schemas/domain";
import type { SupplierInput } from "@/types";

type Supplier = SupplierInput & { _id: string };

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

export function SuppliersManager() {
  const { list, create, update, remove, params, setParams } = useCrud<SupplierInput, Supplier>("suppliers");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Supplier) => {
    setEditing(item);
    form.reset({
      supplierName: item.supplierName,
      contactPerson: item.contactPerson ?? "",
      phone: item.phone,
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
        toast.success("Supplier updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Supplier created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save supplier.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Supplier deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete supplier.");
    }
  };

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Suppliers</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Manage supplier contacts for purchase orders and goods receiving.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Supplier
        </Button>
      </div>

      <Surface>
        <DataToolbar placeholder="Search suppliers" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-500">Loading suppliers...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-500">No suppliers found.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 font-medium">{item.supplierName}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.contactPerson || "—"}</td>
                    <td className="px-4 py-3">{item.phone}</td>
                    <td className="px-4 py-3"><Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={list.data?.page ?? 1} pages={list.data?.pages ?? 1} total={list.data?.total ?? 0} onPageChange={(page) => setParams((p) => ({ ...p, page }))} />
      </Surface>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent title={editing ? "Edit Supplier" : "New Supplier"}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><Label>Supplier Name</Label><Input className="mt-1.5" {...form.register("supplierName")} /></div>
            <div><Label>Contact Person</Label><Input className="mt-1.5" {...form.register("contactPerson")} /></div>
            <div><Label>Phone</Label><Input className="mt-1.5" {...form.register("phone")} /></div>
            <div><Label>Address</Label><Textarea className="mt-1.5" {...form.register("address")} /></div>
            <div><Label>Notes</Label><Textarea className="mt-1.5" {...form.register("notes")} /></div>
            <div><Label>Status</Label>
              <Select className="mt-1.5" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Supplier"
        description={`Delete supplier "${deleteTarget?.supplierName ?? ""}"? This action cannot be undone.`}
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
