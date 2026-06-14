"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ProductInput } from "@/types";

type Product = ProductInput & { _id: string };

export function usePosProducts(search: string) {
  const query = useQuery({
    queryKey: ["pos-products", search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/pos/products?${params}`);
      if (!response.ok) throw new Error("Unable to load products");
      return response.json() as Promise<{ items: Product[] }>;
    },
    staleTime: 15_000,
  });

  const products = useMemo(() => query.data?.items.filter((p) => p.quantity > 0) ?? [], [query.data?.items]);

  return { products, isLoading: query.isLoading, refetch: query.refetch };
}

export function usePosCustomers() {
  return useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => {
      const response = await fetch("/api/pos/customers");
      if (!response.ok) throw new Error("Unable to load customers");
      return response.json() as Promise<{ items: Array<{ _id: string; name: string; phone: string; creditLimit: number; currentBalance?: number }> }>;
    },
    staleTime: 30_000,
  });
}

export function usePosSettings() {
  return useQuery({
    queryKey: ["pos-settings"],
    queryFn: async () => {
      const response = await fetch("/api/pos/settings");
      if (!response.ok) {
        return { businessName: "Shopkeeper", logo: "", address: "", phone: "", email: "", gstVatNumber: "", ntn: "", receiptSize: "80mm" as const, receiptLogoAlign: "center" as const, receiptHeader: "", receiptFooter: "", thankYouMessage: "Thank you for shopping with us." };
      }
      return response.json() as Promise<{ businessName: string; logo: string; address: string; phone: string; email: string; gstVatNumber: string; ntn: string; receiptSize: "58mm" | "80mm" | "a4"; receiptLogoAlign: "left" | "center" | "right"; receiptHeader: string; receiptFooter: string; thankYouMessage: string }>;
    },
    staleTime: 60_000,
  });
}
