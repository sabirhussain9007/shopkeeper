"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Download, Package, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { adjustStock } from "@/actions/products";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
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
import { currency, percentage } from "@/lib/utils";
import { productSchema } from "@/schemas/domain";
import { exportRowsToPdf } from "@/services/report-export";
import type { CategoryInput, ProductInput } from "@/types";

type Product = ProductInput & { _id: string };
type Category = CategoryInput & { _id: string };

const formSchema = productSchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = {
  productName: "",
  sku: "",
  barcode: "",
  category: undefined,
  brand: "",
  unit: "pcs",
  purchasePrice: 0,
  sellingPrice: 0,
  taxRate: 0,
  quantity: 0,
  reorderLevel: 5,
  supplier: undefined,
  productImage: "",
  description: "",
  status: "active",
};

function profitInfo(purchase: number, selling: number) {
  const profit = selling - purchase;
  const margin = selling > 0 ? (profit / selling) * 100 : 0;
  return { profit, margin };
}

export function InventoryManager() {
  const { list, create, update, remove, params, setParams } = useCrud<ProductInput, Product>("products");
  const categoriesCrud = useCrud<CategoryInput, Category>("categories", { limit: 100 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockType, setStockType] = useState<"increase" | "decrease" | "manual">("increase");
  const [stockQty, setStockQty] = useState(1);
  const [stockReason, setStockReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });
  const purchasePrice = form.watch("purchasePrice");
  const sellingPrice = form.watch("sellingPrice");
  const profit = useMemo(() => profitInfo(Number(purchasePrice) || 0, Number(sellingPrice) || 0), [purchasePrice, sellingPrice]);

  const categories = categoriesCrud.list.data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const openEdit = (item: Product) => {
    setEditing(item);
    form.reset({
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode ?? "",
      category: item.category,
      brand: item.brand ?? "",
      unit: item.unit,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      taxRate: item.taxRate,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel,
      supplier: item.supplier,
      productImage: item.productImage ?? "",
      description: item.description ?? "",
      status: item.status,
    });
    setDialogOpen(true);
  };

  const openStock = (item: Product) => {
    setStockProduct(item);
    setStockType("increase");
    setStockQty(1);
    setStockReason("");
    setStockOpen(true);
  };

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q, page: 1 })), [setParams]);
  const onStatusChange = useCallback((status: string) => setParams((p) => ({ ...p, status: status || undefined, page: 1 })), [setParams]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const parsed = formSchema.parse(values);
      const payload = {
        ...parsed,
        category: parsed.category || undefined,
        supplier: parsed.supplier || undefined,
        productImage: parsed.productImage || "",
      };
      if (editing) {
        await update.mutateAsync({ id: editing._id, input: payload });
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

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget._id);
      toast.success("Product deleted.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete product.");
    }
  };

  const onDuplicate = async (item: Product) => {
    try {
      const response = await fetch(`/api/products/${item._id}/duplicate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to duplicate");
      toast.success("Product duplicated.");
      list.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to duplicate product.");
    }
  };

  const onExportPdf = () => {
    const items = list.data?.items ?? [];
    exportRowsToPdf(
      "Inventory Report",
      ["Product", "SKU", "Qty", "Purchase", "Selling", "Status"],
      items.map((p) => [p.productName, p.sku, p.quantity, p.purchasePrice, p.sellingPrice, p.status]),
    );
  };

  const onStockSubmit = async () => {
    if (!stockProduct) return;
    const previous = stockProduct.quantity;
    let newQuantity = previous;
    if (stockType === "increase") newQuantity = previous + stockQty;
    if (stockType === "decrease") newQuantity = Math.max(0, previous - stockQty);
    if (stockType === "manual") newQuantity = stockQty;

    const result = await adjustStock({
      product: stockProduct._id,
      type: stockType,
      quantity: stockQty,
      previousQuantity: previous,
      newQuantity,
      reason: stockReason || `${stockType} stock adjustment`,
    });

    if (!result.ok) {
      toast.error("error" in result ? result.error : "Unable to adjust stock.");
      return;
    }

    toast.success("Stock updated.");
    setStockOpen(false);
    list.refetch();
  };

  const items = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;

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
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Purchase</th>
                <th className="px-4 py-3 font-medium">Selling</th>
                <th className="px-4 py-3 font-medium">Profit</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={8} label="Loading products..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    No products found. Add your first product.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const { profit: lineProfit, margin } = profitInfo(item.purchasePrice, item.sellingPrice);
                  const lowStock = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item._id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.productName}</div>
                        {lowStock ? (
                          <Badge variant="warning" className="mt-1">
                            Low stock
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{item.sku}</td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">{currency(item.purchasePrice)}</td>
                      <td className="px-4 py-3">{currency(item.sellingPrice)}</td>
                      <td className="px-4 py-3">
                        <div>{currency(lineProfit)}</div>
                        <div className="text-xs text-zinc-500">{percentage(margin)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Adjust stock" onClick={() => openStock(item)}>
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Duplicate" onClick={() => onDuplicate(item)}>
                            <Copy className="h-4 w-4" />
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
        <DialogContent title={editing ? "Edit Product" : "New Product"} description="Track pricing, stock, tax, and category." className="max-w-3xl">
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input id="productName" className="mt-1.5" {...form.register("productName")} />
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" className="mt-1.5" {...form.register("sku")} />
            </div>
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" className="mt-1.5" {...form.register("barcode")} />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" className="mt-1.5" {...form.register("category")}>
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" className="mt-1.5" {...form.register("brand")} />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" className="mt-1.5" {...form.register("unit")} />
            </div>
            <div>
              <Label htmlFor="purchasePrice">Purchase Price</Label>
              <Input id="purchasePrice" type="number" min={0} className="mt-1.5" {...form.register("purchasePrice", { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="sellingPrice">Selling Price</Label>
              <Input id="sellingPrice" type="number" min={0} className="mt-1.5" {...form.register("sellingPrice", { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input id="taxRate" type="number" min={0} max={100} className="mt-1.5" {...form.register("taxRate", { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" min={0} className="mt-1.5" {...form.register("quantity", { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="reorderLevel">Reorder Level</Label>
              <Input id="reorderLevel" type="number" min={0} className="mt-1.5" {...form.register("reorderLevel", { valueAsNumber: true })} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" className="mt-1.5" {...form.register("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="md:col-span-2 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                Smart Profit Calculator
              </div>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <span>Profit: {currency(profit.profit)}</span>
                <span>Margin: {percentage(profit.margin)}</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" className="mt-1.5" {...form.register("description")} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : editing ? "Update Product" : "Create Product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent title="Adjust Stock" description={stockProduct ? `Current stock: ${stockProduct.quantity} ${stockProduct.unit}` : undefined}>
          <div className="space-y-4">
            <div>
              <Label>Adjustment Type</Label>
              <Select className="mt-1.5" value={stockType} onChange={(e) => setStockType(e.target.value as typeof stockType)}>
                <option value="increase">Increase</option>
                <option value="decrease">Decrease</option>
                <option value="manual">Manual set</option>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input className="mt-1.5" type="number" min={0} value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea className="mt-1.5" value={stockReason} onChange={(e) => setStockReason(e.target.value)} placeholder="e.g. Received shipment, damaged goods" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setStockOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onStockSubmit}>Save Adjustment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        description={`Delete product "${deleteTarget?.productName ?? ""}"? This action cannot be undone.`}
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
