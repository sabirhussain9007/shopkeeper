"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Plus, TrendingUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DataToolbar, PaginationBar } from "@/components/crud/data-toolbar";
import { TableLoader } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCrud } from "@/hooks/use-crud";
import { hierarchicalCategoryOptions, type CategoryOption } from "@/lib/categories";
import { isRecordDeleted } from "@/lib/soft-delete";
import { currency, percentage } from "@/lib/utils";
import { productSchema } from "@/schemas/domain";
import { exportRowsToPdf } from "@/services/report-export";
import type { BrandInput, CategoryInput, ProductInput, SupplierInput } from "@/types";

type Product = ProductInput & {
  _id: string;
  category?: string | { _id: string };
  supplier?: string | { _id: string };
  brandId?: string | { _id: string };
  deletedAt?: string | null;
};
type Category = CategoryInput & CategoryOption & { _id: string };
type Vendor = SupplierInput & { _id: string; supplierName: string };
type Brand = BrandInput & { _id: string };

function resourceId(value?: string | { _id: string }) {
  if (!value) return "";
  return typeof value === "object" ? String(value._id) : String(value);
}

const formSchema = productSchema;
type FormValues = z.input<typeof formSchema>;

const emptyValues: FormValues = {
  productName: "",
  sku: "",
  barcode: "",
  category: "",
  brandId: "",
  unit: "pcs",
  purchasePrice: 0,
  sellingPrice: 0,
  taxRate: 0,
  quantity: 0,
  reorderLevel: 5,
  supplier: "",
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
  const { list, create, params, setParams } = useCrud<ProductInput, Product>("products");
  const categoriesCrud = useCrud<CategoryInput, Category>("categories", { limit: 100 });
  const vendorsCrud = useCrud<SupplierInput, Vendor>("suppliers", { limit: 100 });
  const brandsCrud = useCrud<BrandInput, Brand>("brands", { limit: 100 });
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });
  const purchasePrice = form.watch("purchasePrice");
  const sellingPrice = form.watch("sellingPrice");
  const profit = useMemo(() => profitInfo(Number(purchasePrice) || 0, Number(sellingPrice) || 0), [purchasePrice, sellingPrice]);

  const categories = categoriesCrud.list.data?.items ?? [];
  const categoryOptions = useMemo(() => hierarchicalCategoryOptions(categories), [categories]);
  const brands = brandsCrud.list.data?.items ?? [];
  const vendors = useMemo(() => vendorsCrud.list.data?.items ?? [], [vendorsCrud.list.data?.items]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [resourceId(v._id), v.supplierName])), [vendors]);

  const openCreate = () => {
    form.reset(emptyValues);
    setDialogOpen(true);
  };

  const onSearch = useCallback((q: string) => setParams((p) => ({ ...p, q: q || undefined, page: 1 })), [setParams]);
  const onStatusChange = useCallback((status: string) => setParams((p) => ({ ...p, status: status || undefined, page: 1 })), [setParams]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const parsed = formSchema.parse(values);
      const brandRecord = brands.find((brand) => brand._id === parsed.brandId);
      const payload = {
        ...parsed,
        brand: brandRecord?.name ?? "",
        productImage: parsed.productImage || "",
      };
      await create.mutateAsync(payload);
      toast.success("Product created.");
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
  const isSaving = create.isPending;
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
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 ? (
                <TableLoader colSpan={8} label="Loading products..." />
              ) : list.isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    <p>{list.error instanceof Error ? list.error.message : "Unable to load products."}</p>
                    <Button className="mt-3" size="sm" variant="secondary" onClick={() => void list.refetch()}>
                      Retry
                    </Button>
                  </td>
                </tr>
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
                  const deleted = isRecordDeleted(item);
                  return (
                    <tr key={resourceId(item._id)} className="border-t border-zinc-100 hover:bg-emerald-50/60">
                      <td className="px-4 py-3">
                        <div className={`font-medium ${deleted ? "text-zinc-400 line-through" : ""}`}>{item.productName}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {deleted ? <Badge variant="warning">Deleted</Badge> : null}
                          {!deleted && lowStock ? <Badge variant="warning">Low stock</Badge> : null}
                        </div>
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
                        {item.supplier ? vendorNameById.get(resourceId(item.supplier)) ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === "active" ? "success" : "default"}>{item.status}</Badge>
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
        <DialogContent title="New Product" description="Track pricing, stock, tax, and category." className="max-w-3xl">
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
                {categoryOptions.map((option) => (
                  <option key={option._id} value={option._id}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {form.formState.errors.category ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.category.message}</p>
              ) : null}
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
              {form.formState.errors.supplier ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.supplier.message}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="brandId">Brand</Label>
              <Select id="brandId" className="mt-1.5" {...form.register("brandId")}>
                <option value="">No brand</option>
                {brands.map((brand) => (
                  <option key={brand._id} value={brand._id}>
                    {brand.name}
                  </option>
                ))}
              </Select>
              {form.formState.errors.brandId ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.brandId.message}</p>
              ) : null}
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
                {isSaving ? "Saving..." : "Create Product"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
