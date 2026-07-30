"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateShopSuccessContent() {
  const searchParams = useSearchParams();
  const shopId = searchParams.get("shopId");
  const sessionId = searchParams.get("session_id");
  const walletPaid = searchParams.get("paid") === "1";
  const [status, setStatus] = useState<"loading" | "paid" | "pending">(walletPaid ? "paid" : "loading");

  useEffect(() => {
    if (walletPaid) return;
    if (!sessionId) {
      setStatus("pending");
      return;
    }
    void fetch(`/api/shops/stripe/checkout?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean }) => setStatus(data.ok ? "paid" : "pending"))
      .catch(() => setStatus("pending"));
  }, [sessionId, walletPaid]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0c1f1a] px-4 py-12 text-white">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0f2420]/95 p-8 text-center shadow-2xl">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-300" />
            <h1 className="mt-4 text-2xl font-semibold">Confirming payment…</h1>
            <p className="mt-2 text-sm text-emerald-50/70">Your shop activates automatically once payment is verified.</p>
          </>
        ) : status === "paid" ? (
          <>
            <BadgeCheck className="mx-auto h-12 w-12 text-emerald-300" />
            <h1 className="mt-4 text-2xl font-semibold">Payment successful</h1>
            <p className="mt-2 text-sm text-emerald-50/70">
              Your shop subscription is active{shopId ? ` (ref ${shopId.slice(-6)})` : ""}. You can sign in now.
            </p>
            <Button asChild className="mt-6">
              <Link href="/login?created=1">Go to login</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Payment received</h1>
            <p className="mt-2 text-sm text-emerald-50/70">
              If your shop is not active yet, wait a minute and refresh. Webhook activation may still be processing.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild variant="secondary">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/create-shop">Back</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
