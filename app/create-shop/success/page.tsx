import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateShopSuccessContent } from "@/features/saas/create-shop-success-content";

export const metadata: Metadata = {
  title: "Shop created",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateShopSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#0c1f1a] px-4 py-12 text-white">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0f2420]/95 p-8 text-center shadow-2xl">
            <p className="text-sm text-emerald-50/70">Confirming payment…</p>
          </div>
        </main>
      }
    >
      <CreateShopSuccessContent />
    </Suspense>
  );
}
