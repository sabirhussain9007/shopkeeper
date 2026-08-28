import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateShopPayContent } from "@/features/saas/create-shop-pay-content";

export const metadata: Metadata = {
  title: "Checkout",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateShopPayPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#0c1f1a] px-4 py-12 text-white">
          <p className="text-sm text-emerald-50/70">Loading payment…</p>
        </main>
      }
    >
      <CreateShopPayContent />
    </Suspense>
  );
}
