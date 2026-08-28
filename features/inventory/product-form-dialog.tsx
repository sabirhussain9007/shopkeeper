"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { hierarchicalCategoryOptions } from "@/lib/categories";
import { currency, percentage } from "@/lib/utils";
import { emptyValues, formSchema, profitInfo, type Brand, type FormValues, type Vendor } from "./inventory-utils";

/** Owned by the page shell so open/edit handlers can reset it before the dialog mounts. */
export function useProductForm() {
  return useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: emptyValues });
}

export type ProductForm = ReturnType<typeof useProductForm>;

type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  isSaving: boolean;
  form: ProductForm;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  categoryOptions: ReturnType<typeof hierarchicalCategoryOptions>;
  brands: Brand[];
  vendors: Vendor[];
};

export function ProductFormDialog({
  open,
  onOpenChange,
  isEditing,
  isSaving,
  form,
  onSubmit,
  categoryOptions,
  brands,
  vendors,
}: ProductFormDialogProps) {
  const purchasePrice = form.watch("purchasePrice");
  const sellingPrice = form.watch("sellingPrice");
  const profit = useMemo(
    () => profitInfo(Number(purchasePrice) || 0, Number(sellingPrice) || 0),
    [purchasePrice, sellingPrice],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Edit Product" : "New Product"}
        description="Track pricing, stock, tax, and category."
        className="max-w-3xl"
      >
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
            <Label htmlFor="wholesalePrice">Wholesale Price</Label>
            <Input id="wholesalePrice" type="number" min={0} className="mt-1.5" {...form.register("wholesalePrice", { valueAsNumber: true })} />
            <p className="mt-1 text-xs text-zinc-500">Charged when the POS is set to wholesale. Leave at 0 to use the selling price.</p>
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : isEditing ? "Save changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
