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
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileInput, bindMobileField } from "@/components/ui/pakistan-fields";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrud } from "@/hooks/use-crud";
import { formatMobileInput } from "@/lib/pakistan-validators";
import { warehouseSchema } from "@/schemas/domain";
import type { ProductInput, WarehouseInput } from "@/types";

type Warehouse = WarehouseInput & { _id: string; createdAt?: string };

const formSchema = warehouseSchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = {
  name: "",
  code: "",
  address: "",
  phone: "",
  isDefault: false,
  status: "active",
};

export function WarehousesManager() {
  const { list, create, update, remove, params, setParams } = useCrud<WarehouseInput, Warehouse>("warehouses");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null);
  const productsCrud = useCrud<ProductInput, ProductInput & { _id: string }>("products", { limit: 100 });
  const [transferProduct, setTransferProduct] = useState("");
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferQty, setTransferQty] = useState("1");

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Warehouse) => {
    setEditing(item);
    form.reset({
      name: item.name,
      code: item.code,
      address: item.address ?? "",
      phone: formatMobileInput(item.phone ?? ""),
      isDefault: item.isDefault ?? false,
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
        toast.success("Warehouse updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Warehouse created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save warehouse.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Warehouse deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete warehouse.");
    }
  };

  const items = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Warehouses</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Manage storage locations and default warehouse settings.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Warehouse
        </Button>
      </div>

      <Surface>
        <DataToolbar placeholder="Search warehouses" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Default</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white text-zinc-950">
              {list.isLoading ? (
                <TableLoader colSpan={7} label="Loading warehouses..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No warehouses found. Create your first warehouse.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.code}</td>
                    <td className="px-4 py-3 text-zinc-500">{item.address || "—"}</td>
                    <td className="px-4 py-3">{item.phone || "—"}</td>
                    <td className="px-4 py-3">
                      {item.isDefault ? <Badge variant="success">Default</Badge> : "—"}
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
        <DialogContent title={editing ? "Edit Warehouse" : "New Warehouse"} description="Warehouses track where inventory is stored.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" className="mt-1.5" {...form.register("name")} />
              {form.formState.errors.name ? <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p> : null}
            </div>
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" className="mt-1.5 font-mono uppercase" {...form.register("code")} />
              {form.formState.errors.code ? <p className="mt-1 text-xs text-red-500">{form.formState.errors.code.message}</p> : null}
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" className="mt-1.5" {...form.register("address")} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <MobileInput id="phone" className="mt-1.5" {...bindMobileField(form.register, "phone")} />
              <FieldError message={form.formState.errors.phone?.message} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isDefault" className="h-4 w-4 accent-emerald-600" {...form.register("isDefault")} />
              <Label htmlFor="isDefault">Set as default warehouse</Label>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" className="mt-1.5" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
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
        title="Delete Warehouse"
        description={`Delete warehouse "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isPending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={onDelete}
      />

      <Surface className="mt-6">
        <h3 className="text-lg font-semibold text-zinc-950">Stock transfer</h3>
        <p className="mt-1 text-sm text-zinc-600">Move stock between warehouses.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label>Product</Label>
            <Select className="mt-1.5" value={transferProduct} onChange={(e) => setTransferProduct(e.target.value)}>
              <option value="">Select product</option>
              {(productsCrud.list.data?.items ?? []).map((p) => (
                <option key={p._id} value={p._id}>{p.productName}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input className="mt-1.5" type="number" min={1} value={transferQty} onChange={(e) => setTransferQty(e.target.value)} />
          </div>
          <div>
            <Label>From warehouse</Label>
            <Select className="mt-1.5" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
              <option value="">Select</option>
              {items.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>To warehouse</Label>
            <Select className="mt-1.5" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
              <option value="">Select</option>
              {items.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </Select>
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={async () => {
            const res = await fetch("/api/stock-transfers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                product: transferProduct,
                fromWarehouse: transferFrom,
                toWarehouse: transferTo,
                quantity: Number(transferQty),
              }),
            });
            const data = await res.json();
            if (!res.ok) return toast.error(data.error ?? "Transfer failed");
            toast.success("Stock transferred.");
          }}
        >
          Transfer stock
        </Button>
      </Surface>
    </div>
  );
}
