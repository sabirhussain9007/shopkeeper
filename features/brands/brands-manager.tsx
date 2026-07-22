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
import { useCrud } from "@/hooks/use-crud";
import { brandSchema } from "@/schemas/domain";
import type { BrandInput } from "@/types";

type Brand = BrandInput & { _id: string; createdAt?: string };

const formSchema = brandSchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = { name: "", logo: "", description: "", status: "active" };

export function BrandsManager() {
  const { list, create, update, remove, params, setParams } = useCrud<BrandInput, Brand>("brands");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Brand) => {
    setEditing(item);
    form.reset({
      name: item.name,
      logo: item.logo ?? "",
      description: item.description ?? "",
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
        toast.success("Brand updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Brand created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save brand.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Brand deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete brand.");
    }
  };

  const items = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-950">Brands</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Manage product brands with logos and status.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Brand
        </Button>
      </div>

      <Surface>
        <DataToolbar placeholder="Search brands" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Logo</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white text-zinc-950">
              {list.isLoading ? (
                <TableLoader colSpan={5} label="Loading brands..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                    No brands found. Create your first brand.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      {item.logo ? (
                        <a href={item.logo} target="_blank" rel="noreferrer" className="text-emerald-700 underline">
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{item.description || "—"}</td>
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
        <DialogContent title={editing ? "Edit Brand" : "New Brand"} description="Brands help organize inventory and product listings.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" className="mt-1.5" {...form.register("name")} />
              {form.formState.errors.name ? <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p> : null}
            </div>
            <div>
              <Label htmlFor="logo">Logo URL</Label>
              <Input id="logo" type="url" className="mt-1.5" placeholder="https://example.com/logo.png" {...form.register("logo")} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" className="mt-1.5" {...form.register("description")} />
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
        title="Delete Brand"
        description={`Delete brand "${deleteTarget?.name ?? ""}"? This action cannot be undone.`}
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
