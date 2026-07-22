"use client";

import { useQuery } from "@tanstack/react-query";
import type { ShopPaymentAccount } from "@/lib/payment-accounts";

type AccountType = "bank" | "easypaisa" | "jazzcash";

export function useShopPaymentAccounts(options?: { accountType?: AccountType; enabled?: boolean }) {
  const accountType = options?.accountType;
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ["shop-payment-accounts", accountType ?? "all"],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ status: "active", limit: "100" });
      if (accountType) params.set("accountType", accountType);
      const response = await fetch(`/api/bank-accounts?${params}`);
      if (!response.ok) throw new Error("Unable to load payment accounts");
      return response.json() as Promise<{ items: ShopPaymentAccount[] }>;
    },
    staleTime: 60_000,
  });
}
