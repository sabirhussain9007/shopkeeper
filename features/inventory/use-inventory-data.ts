"use client";

import { useMemo } from "react";
import { useCrud } from "@/hooks/use-crud";
import { hierarchicalCategoryOptions } from "@/lib/categories";
import type { BrandInput, CategoryInput, ProductInput, SupplierInput } from "@/types";
import { resourceId, type Brand, type Category, type Product, type Vendor } from "./inventory-utils";

/** Products plus the reference lists the inventory screen resolves names against. */
export function useInventoryData() {
  const { list, create, update, remove, params, setParams } = useCrud<ProductInput, Product>("products");
  const categoriesCrud = useCrud<CategoryInput, Category>("categories", { limit: 100 });
  const vendorsCrud = useCrud<SupplierInput, Vendor>("suppliers", { limit: 100 });
  const brandsCrud = useCrud<BrandInput, Brand>("brands", { limit: 100 });

  const categories = categoriesCrud.list.data?.items ?? [];
  const categoryOptions = useMemo(() => hierarchicalCategoryOptions(categories), [categories]);
  const brands = brandsCrud.list.data?.items ?? [];
  const vendors = useMemo(() => vendorsCrud.list.data?.items ?? [], [vendorsCrud.list.data?.items]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [resourceId(v._id), v.supplierName])), [vendors]);

  /** Network call only — callers decide when to refetch so toast ordering stays theirs. */
  const restoreProduct = async (id: string) => {
    const response = await fetch(`/api/products/${id}/restore`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to restore product.");
  };

  return {
    list,
    create,
    update,
    remove,
    params,
    setParams,
    categoryOptions,
    brands,
    vendors,
    vendorNameById,
    restoreProduct,
  };
}
