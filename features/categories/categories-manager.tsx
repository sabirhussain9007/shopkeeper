"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
import { applyFieldErrors, ApiRequestError } from "@/lib/api-errors";
import {
  buildCategoryNameMap,
  categoryParentName,
  categoryResourceId,
  parentCategoryOptions,
} from "@/lib/categories";
import { isRecordDeleted } from "@/lib/soft-delete";
import { categorySchema } from "@/schemas/domain";
import type { CategoryInput } from "@/types";

type Category = CategoryInput & {
  _id: string;
  createdAt?: string;
  parentId?: string | { _id: string };
  deletedAt?: string | null;
};

const formSchema = categorySchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = { name: "", description: "", parentId: "", icon: "", image: "", sortOrder: 0, status: "active" };

export function CategoriesManager() {
  const { list, create, update, remove, params, setParams } = useCrud<CategoryInput, Category>("categories", { limit: 100 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });

  const items = list.data?.items ?? [];
  const categoryNameById = useMemo(() => buildCategoryNameMap(items), [items]);
  const parentCategories = useMemo(
    () => parentCategoryOptions(items, editing ? categoryResourceId(editing._id) : undefined),
    [items, editing],
  );

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Category) => {
    setEditing(item);
    form.reset({
      name: item.name,
      description: item.description ?? "",
      parentId: categoryResourceId(item.parentId),
      icon: item.icon ?? "",
      image: item.image ?? "",
      sortOrder: item.sortOrder ?? 0,
      status: item.status,
    });
    setDialogOpen(true);
  };

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q: q || undefined, page: 1 })), [setParams]);
  const onStatusChange = useCallback((status: string) => setParams((p) => ({ ...p, status: status || undefined, page: 1 })), [setParams]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const trimmedName = values.name.trim();
      const duplicate = items.find(
        (category) =>
          category.name.toLowerCase() === trimmedName.toLowerCase() &&
          categoryResourceId(category._id) !== (editing ? categoryResourceId(editing._id) : ""),
      );
      if (duplicate) {
        form.setError("name", { message: `A category named "${duplicate.name}" already exists.` });
        toast.error(`A category named "${duplicate.name}" already exists.`);
        return;
      }

      const payload = formSchema.parse(values);
      if (editing) {
        await update.mutateAsync({ id: categoryResourceId(editing._id), input: payload });
        toast.success("Category updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Category created.");
      }
      setDialogOpen(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        applyFieldErrors<FormValues>(form.setError, error.fieldErrors);
      }
      toast.error(error instanceof Error ? error.message : "Unable to save category.");
    }
  });

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(categoryResourceId(deleteTarget._id));
      toast.success("Category permanently deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete category.");
    }
  };

  const onRestore = async (item: Category) => {
    try {
      const response = await fetch(`/api/categories/${categoryResourceId(item._id)}/restore`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to restore category.");
      toast.success(`"${item.name}" restored.`);
      await list.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to restore category.");
    }
  };

  const isSaving = create.isPending || update.isPending;
  const isLoading = list.isPending || list.isFetching;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Categories</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Organize products with searchable, filterable categories.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      <Surface>
        <DataToolbar placeholder="Search categories" status={params.status} onSearch={onSearch} onStatusChange={onStatusChange} />
        <div className="responsive-table-shell">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Parent</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 ? (
                <TableLoader colSpan={5} label="Loading categories..." />
              ) : list.isError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                    <p>{list.error instanceof Error ? list.error.message : "Unable to load categories."}</p>
                    <Button className="mt-3" size="sm" variant="secondary" onClick={() => void list.refetch()}>
                      Retry
                    </Button>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                    No categories found. Create your first category.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const deleted = isRecordDeleted(item);
                  return (
                    <tr key={categoryResourceId(item._id)} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                      <td className="px-4 py-3">
                        <div className={`font-medium ${deleted ? "text-zinc-400 line-through" : ""}`}>{item.name}</div>
                        {deleted ? (
                          <Badge variant="warning" className="mt-1">
                            Deleted
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{categoryParentName(item, categoryNameById) || "—"}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.description || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {deleted ? (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => void onRestore(item)}>
                                Restore
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => setDeleteTarget(item)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
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
        <DialogContent title={editing ? "Edit Category" : "New Category"} description="Categories help filter inventory and reports.">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" className="mt-1.5" {...form.register("name")} />
              {form.formState.errors.name ? <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p> : null}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" className="mt-1.5" {...form.register("description")} />
            </div>
            <div>
              <Label htmlFor="parentId">Parent category</Label>
              <Select id="parentId" className="mt-1.5" {...form.register("parentId")}>
                <option value="">None (top level)</option>
                {parentCategories.map((category) => (
                  <option key={categoryResourceId(category._id)} value={categoryResourceId(category._id)}>
                    {category.name}
                  </option>
                ))}
              </Select>
              {parentCategories.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">Create a top-level category first to use as a parent.</p>
              ) : null}
              {form.formState.errors.parentId ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.parentId.message}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" type="number" className="mt-1.5" {...form.register("sortOrder", { valueAsNumber: true })} />
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
        title="Delete Category"
        description={`Permanently delete category "${deleteTarget?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete permanently"
        isPending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={onDelete}
      />
    </div>
  );
}
