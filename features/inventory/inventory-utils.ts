import { z } from "zod";
import type { CategoryOption } from "@/lib/categories";
import { productSchema } from "@/schemas/domain";
import type { BrandInput, CategoryInput, ProductInput, SupplierInput } from "@/types";

export type Product = ProductInput & {
  _id: string;
  category?: string | { _id: string };
  supplier?: string | { _id: string };
  brandId?: string | { _id: string };
  deletedAt?: string | null;
};
export type Category = CategoryInput & CategoryOption & { _id: string };
export type Vendor = SupplierInput & { _id: string; supplierName: string };
export type Brand = BrandInput & { _id: string };

export function resourceId(value?: string | { _id: string }) {
  if (!value) return "";
  return typeof value === "object" ? String(value._id) : String(value);
}

export const formSchema = productSchema;
export type FormValues = z.input<typeof formSchema>;

export const emptyValues: FormValues = {
  productName: "",
  sku: "",
  barcode: "",
  category: "",
  brandId: "",
  unit: "pcs",
  purchasePrice: 0,
  sellingPrice: 0,
  wholesalePrice: 0,
  taxRate: 0,
  quantity: 0,
  reorderLevel: 5,
  supplier: "",
  productImage: "",
  description: "",
  status: "active",
};

export function profitInfo(purchase: number, selling: number) {
  const profit = selling - purchase;
  const margin = selling > 0 ? (profit / selling) * 100 : 0;
  return { profit, margin };
}

/** Map a persisted product onto the shape the edit form expects. */
export function productToFormValues(item: Product): FormValues {
  return {
    productName: item.productName,
    sku: item.sku,
    barcode: item.barcode ?? "",
    category: resourceId(item.category),
    brandId: resourceId(item.brandId),
    unit: item.unit ?? "pcs",
    purchasePrice: item.purchasePrice,
    sellingPrice: item.sellingPrice,
    wholesalePrice: item.wholesalePrice ?? 0,
    taxRate: item.taxRate,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    supplier: resourceId(item.supplier),
    productImage: item.productImage ?? "",
    description: item.description ?? "",
    status: item.status,
  };
}
