"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Download, Package, PackagePlus, Pencil, Plus, Trash2, TrendingUp, Upload } from "lucide-react";
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
import { parseCsv } from "@/services/csv-import";
import type { CategoryInput, ProductInput, SupplierInput } from "@/types";

type Product = ProductInput & { _id: string };
type Category = CategoryInput & { _id: string };
type Vendor = SupplierInput & { _id: string; supplierName: string };

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
  const vendorsCrud = useCrud<SupplierInput, Vendor>("suppliers", { limit: 100 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockType, setStockType] = useState<"increase" | "decrease" | "manual">("increase");
  const [stockQty, setStockQty] = useState(1);
  const [stockReason, setStockReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [buyStockOpen, setBuyStockOpen] = useState(false);
  const [buyStockProduct, setBuyStockProduct] = useState<Product | null>(null);
  const [buyVendorId, setBuyVendorId] = useState("");
  const [buyQty, setBuyQty] = useState(1);
  const [buyUnitCost, setBuyUnitCost] = useState(0);
  const [buyPaidAmount, setBuyPaidAmount] = useState(0);
  const [buyNotes, setBuyNotes] = useState("");
  const [buyPending, setBuyPending] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });
  const purchasePrice = form.watch("purchasePrice");
  const sellingPrice = form.watch("sellingPrice");
  const profit = useMemo(() => profitInfo(Number(purchasePrice) || 0, Number(sellingPrice) || 0), [purchasePrice, sellingPrice]);

  const categories = categoriesCrud.list.data?.items ?? [];
  const vendors = useMemo(() => vendorsCrud.list.data?.items ?? [], [vendorsCrud.list.data?.items]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v._id, v.supplierName])), [vendors]);

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

  const openBuyStock = (item: Product) => {
    setBuyStockProduct(item);
    setBuyVendorId(item.supplier ? String(item.supplier) : "");
    setBuyQty(1);
    setBuyUnitCost(item.purchasePrice ?? 0);
    setBuyPaidAmount(0);
    setBuyNotes("");
    setBuyStockOpen(true);
  };

  const buyLineSubtotal = buyQty * buyUnitCost;
  const buyTaxRate = buyStockProduct?.taxRate ?? 0;
  const buyTaxes = (buyLineSubtotal * buyTaxRate) / 100;
  const buyGrandTotal = buyLineSubtotal + buyTaxes;
  const buyNewStock = (buyStockProduct?.quantity ?? 0) + buyQty;
  const buyRateIncreased = buyStockProduct ? buyUnitCost > (buyStockProduct.purchasePrice ?? 0) : false;

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

  const onImportCsv = async (file: File) => {
    try {
      const rows = await parseCsv<Record<string, string>>(file);
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Import failed");
      toast.success(`Imported ${data.created} of ${data.total} products.`);
      if (data.errors?.length) toast.message(`${data.errors.length} rows skipped.`);
      list.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    }
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

  const onBuyStockSubmit = async () => {
    if (!buyStockProduct) return;
    if (!buyVendorId) {
      toast.error("Select the vendor you are buying from.");
      return;
    }
    if (buyQty <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    if (buyUnitCost < 0) {
      toast.error("Enter a valid purchase rate.");
      return;
    }

    setBuyPending(true);
    try {
      const response = await fetch(`/api/products/${buyStockProduct._id}/buy-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: buyVendorId,
          quantity: buyQty,
          unitCost: buyUnitCost,
          paidAmount: buyPaidAmount,
          notes: buyNotes,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to buy stock.");

      const rateMsg =
        buyRateIncreased && buyStockProduct.purchasePrice
          ? ` Purchase rate updated from ${currency(buyStockProduct.purchasePrice)} to ${currency(buyUnitCost)}.`
          : "";
      toast.success(`Stock received — ${buyNewStock} ${buyStockProduct.unit ?? "pcs"} in hand.${rateMsg}`);
      setBuyStockOpen(false);
      list.refetch();
      vendorsCrud.list.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to buy stock.");
    } finally {
      setBuyPending(false);
    }
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
            <>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100">
                <Upload className="h-4 w-4" />
                Import CSV
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onImportCsv(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <Button variant="ghost" onClick={onExportPdf}>
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </>
          }
        />
        <div className="responsive-table-shell responsive-table-shell--lg">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-[var(--panel)] text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Purchase</th>
                <th className="px-4 py-3 font-medium">Selling</th>
                <th className="px-4 py-3 font-medium">Profit</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading ? (
                <TableLoader colSpan={9} label="Loading products..." />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                    No products found. Add your first product.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const { profit: lineProfit, margin } = profitInfo(item.purchasePrice, item.sellingPrice);
                  const lowStock = item.quantity <= item.reorderLevel;
                  return (
                    <tr key={item._id} className="border-t border-zinc-100 hover:bg-emerald-50/60">
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
                      <td className="px-4 py-3 text-zinc-500">
                        {item.supplier ? vendorNameById.get(String(item.supplier)) ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Buy stock from vendor" onClick={() => openBuyStock(item)}>
                            <PackagePlus className="h-4 w-4" />
                          </Button>
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
              <Label htmlFor="vendor">Vendor</Label>
              <Select id="vendor" className="mt-1.5" {...form.register("supplier")}>
                <option value="">No vendor</option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.supplierName}
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

      <Dialog open={buyStockOpen} onOpenChange={setBuyStockOpen}>
        <DialogContent
          title="Buy Stock"
          description={
            buyStockProduct
              ? `${buyStockProduct.productName} · SKU ${buyStockProduct.sku} · Current stock: ${buyStockProduct.quantity} ${buyStockProduct.unit ?? "pcs"}`
              : undefined
          }
          className="max-w-lg"
        >
          {buyStockProduct ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="buy-vendor">Vendor</Label>
                <Select id="buy-vendor" className="mt-1.5" value={buyVendorId} onChange={(e) => setBuyVendorId(e.target.value)}>
                  <option value="">Select vendor</option>
                  {vendors.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.supplierName}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="buy-qty">Quantity to add</Label>
                  <Input
                    id="buy-qty"
                    className="mt-1.5"
                    type="number"
                    min={1}
                    value={buyQty || ""}
                    onChange={(e) => setBuyQty(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="buy-rate">Purchase rate (per unit)</Label>
                  <Input
                    id="buy-rate"
                    className="mt-1.5"
                    type="number"
                    min={0}
                    step="0.01"
                    value={buyUnitCost || ""}
                    onChange={(e) => setBuyUnitCost(Number(e.target.value))}
                  />
                </div>
              </div>
              {buyRateIncreased ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Rate increased from <strong>{currency(buyStockProduct.purchasePrice)}</strong> to{" "}
                  <strong>{currency(buyUnitCost)}</strong>. The product purchase price will be updated.
                </div>
              ) : null}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
                <div className="flex justify-between">
                  <span>New stock on hand</span>
                  <strong>
                    {buyStockProduct.quantity} + {buyQty} = {buyNewStock} {buyStockProduct.unit ?? "pcs"}
                  </strong>
                </div>
                <div className="mt-2 flex justify-between">
                  <span>Line total {buyTaxRate > 0 ? `(incl. ${buyTaxRate}% tax)` : ""}</span>
                  <strong>{currency(buyGrandTotal)}</strong>
                </div>
              </div>
              <div>
                <Label htmlFor="buy-paid">Paid now (optional)</Label>
                <Input
                  id="buy-paid"
                  className="mt-1.5"
                  type="number"
                  min={0}
                  max={buyGrandTotal}
                  value={buyPaidAmount || ""}
                  onChange={(e) => setBuyPaidAmount(Number(e.target.value))}
                />
                {buyGrandTotal - buyPaidAmount > 0 ? (
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {currency(buyGrandTotal - buyPaidAmount)} will be added to vendor balance.
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="buy-notes">Notes (optional)</Label>
                <Textarea
                  id="buy-notes"
                  className="mt-1.5"
                  value={buyNotes}
                  onChange={(e) => setBuyNotes(e.target.value)}
                  placeholder="Invoice ref, delivery note, etc."
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setBuyStockOpen(false)}>
                  Cancel
                </Button>
                <Button loading={buyPending} loadingLabel="Receiving..." onClick={() => void onBuyStockSubmit()}>
                  Receive stock
                </Button>
              </div>
            </div>
          ) : null}
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
