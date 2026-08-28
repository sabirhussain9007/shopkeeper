"use client";

import { Download, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { isRecordDeleted } from "@/lib/soft-delete";
import { exportRowsToPdf } from "@/services/report-export";
import { emptyValues, formSchema, productToFormValues, resourceId, type FormValues, type Product } from "./inventory-utils";
import { ProductFormDialog, useProductForm } from "./product-form-dialog";
import { ProductTable } from "./product-table";
import { useInventoryData } from "./use-inventory-data";

export function InventoryManager() {
  const { list, create, update, remove, params, setParams, categoryOptions, brands, vendors, vendorNameById, restoreProduct } =
    useInventoryData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const form = useProductForm();

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Product) => {
    setEditing(item);
    form.reset(productToFormValues(item));
    setDialogOpen(true);
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(resourceId(deleteTarget._id));
      toast.success(isRecordDeleted(deleteTarget) ? "Product permanently deleted." : "Product deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete product.");
    }
  };

  const onRestore = async (item: Product) => {
    try {
      await restoreProduct(resourceId(item._id));
      toast.success(`"${item.productName}" restored.`);
      await list.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to restore product.");
    }
  };

  const buildPayload = (values: FormValues) => {
    const parsed = formSchema.parse(values);
    const brandRecord = brands.find((brand) => brand._id === parsed.brandId);
    return {
      ...parsed,
      brand: brandRecord?.name ?? "",
      productImage: parsed.productImage || "",
    };
  };

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q: q || undefined, page: 1 })), [setParams]);
  const onStatusChange = useCallback((status: string) => setParams((p) => ({ ...p, status: status || undefined, page: 1 })), [setParams]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = buildPayload(values);
      if (editing) {
        await update.mutateAsync({ id: resourceId(editing._id), input: payload });
        toast.success("Product updated.");
      } else {
        await create.mutateAsync(payload);
        toast.success("Product created.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save product.");
    }
  });

  const onExportPdf = () => {
    const items = list.data?.items ?? [];
    exportRowsToPdf(
      "Inventory Report",
      ["Product", "SKU", "Qty", "Purchase", "Selling", "Status"],
      items.map((p) => [p.productName, p.sku, p.quantity, p.purchasePrice, p.sellingPrice, p.status]),
    );
  };

  const items = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;
  const isLoading = list.isPending || list.isFetching;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Inventory</h2>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">Manage products, stock levels, profit margins, and exports.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </div>

      <Surface>
        <DataToolbar
          placeholder="Search products by name, SKU, or barcode"
          status={params.status}
          onSearch={onSearch}
          onStatusChange={onStatusChange}
          actions={
            <Button variant="ghost" onClick={onExportPdf}>
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          }
        />
        <ProductTable
          items={items}
          isLoading={isLoading}
          isError={list.isError}
          error={list.error}
          onRetry={() => void list.refetch()}
          vendorNameById={vendorNameById}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
          onRestore={(item) => void onRestore(item)}
        />
        <PaginationBar
          page={list.data?.page ?? 1}
          pages={list.data?.pages ?? 1}
          total={list.data?.total ?? 0}
          onPageChange={(page) => setParams((p) => ({ ...p, page }))}
        />
      </Surface>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isEditing={!!editing}
        isSaving={isSaving}
        form={form}
        onSubmit={onSubmit}
        categoryOptions={categoryOptions}
        brands={brands}
        vendors={vendors}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget && isRecordDeleted(deleteTarget) ? "Permanently delete product" : "Delete product"}
        description={
          deleteTarget
            ? isRecordDeleted(deleteTarget)
              ? `Permanently remove "${deleteTarget.productName}"? This cannot be undone.`
              : `Delete "${deleteTarget.productName}"? You can restore it later.`
            : ""
        }
        confirmLabel={deleteTarget && isRecordDeleted(deleteTarget) ? "Delete permanently" : "Delete"}
        confirmVariant="danger"
        isPending={remove.isPending}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
