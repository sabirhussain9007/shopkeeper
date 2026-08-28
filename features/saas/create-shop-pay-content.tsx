"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWalletAppOpenUrl, walletProviderLabel, type WalletProvider } from "@/lib/payments/wallet-app";
import { shopPaymentMethodLabel } from "@/lib/saas";

type PayDetails = {
  shopId: string;
  shopName: string;
  planAmount: number;
  provider: WalletProvider;
  gatewayConfigured: boolean;
  account?: {
    accountNumber: string;
    displayNumber?: string;
    accountTitle: string;
  };
};

function GatewayRedirectForm({ actionUrl, fields }: { actionUrl: string; fields: Record<string, string> }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  return (
    <form ref={formRef} method="POST" action={actionUrl} className="hidden">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </form>
  );
}

export function CreateShopPayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = searchParams.get("shopId");
  const provider = searchParams.get("provider") as WalletProvider | null;
  const paymentStatus = searchParams.get("payment");

  const [details, setDetails] = useState<PayDetails | null>(null);
  const [gatewayForm, setGatewayForm] = useState<{ actionUrl: string; fields: Record<string, string> } | null>(null);
  const [fetching, setFetching] = useState(true);
  // Without a shop and provider there is nothing to fetch, so that is derived here
  // rather than pushed into state by the effect below.
  const loading = Boolean(shopId && provider) && fetching;
  const [tid, setTid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!shopId || !provider) return;

    void fetch(`/api/shops/wallet/checkout?shopId=${encodeURIComponent(shopId)}&provider=${provider}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Unable to load payment details.");
        setDetails(data as PayDetails);

        if (data.gatewayConfigured) {
          const checkoutRes = await fetch("/api/shops/wallet/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, provider }),
          });
          const checkout = await checkoutRes.json();
          if (!checkoutRes.ok) throw new Error(checkout.error ?? "Unable to start online payment.");
          setGatewayForm({ actionUrl: checkout.actionUrl, fields: checkout.fields });
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Unable to load payment.");
      })
      .finally(() => setFetching(false));
  }, [provider, shopId]);

  async function confirmAppPayment() {
    if (!shopId || !provider || tid.trim().length < 3) {
      toast.error("Enter your transaction ID.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/shops/wallet/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId, provider, paymentReference: tid.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit payment.");
      toast.success(data.message);
      router.push("/login?created=1");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!shopId || !provider) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0c1f1a] px-4 py-12 text-white">
        <div className="max-w-md text-center">
          <p className="text-emerald-100/80">Missing payment details.</p>
          <Button asChild className="mt-4">
            <Link href="/create-shop">Back to create shop</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (gatewayForm) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0c1f1a] px-4 py-12 text-white">
        <GatewayRedirectForm actionUrl={gatewayForm.actionUrl} fields={gatewayForm.fields} />
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-300" />
          <h1 className="mt-4 text-2xl font-semibold">Redirecting to {walletProviderLabel(provider)}…</h1>
          <p className="mt-2 text-sm text-emerald-50/70">Complete payment in the secure checkout page.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#0c1f1a] px-4 py-12 text-white">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0f2420]/95 p-8 shadow-2xl">
        {loading ? (
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-300" />
            <p className="mt-4 text-sm text-emerald-50/70">Preparing payment…</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400 text-[#0c1f1a]">
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Pay online in app</p>
                <h1 className="text-2xl font-semibold">{shopPaymentMethodLabel(provider)}</h1>
              </div>
            </div>

            {paymentStatus === "failed" ? (
              <p className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Payment was not completed. Try again or submit your transaction ID below.
              </p>
            ) : null}

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="text-emerald-100/70">Shop</p>
              <p className="font-medium">{details?.shopName}</p>
              <p className="mt-3 text-emerald-100/70">Amount</p>
              <p className="text-2xl font-semibold">Rs. {details?.planAmount ?? "—"}</p>
              {details?.account ? (
                <>
                  <p className="mt-3 text-emerald-100/70">Send to</p>
                  <p className="font-mono text-lg">{details.account.displayNumber ?? details.account.accountNumber}</p>
                  <p className="text-xs text-emerald-100/60">{details.account.accountTitle}</p>
                </>
              ) : null}
            </div>

            <Button
              type="button"
              className="mt-5 w-full"
              onClick={() => {
                window.location.href = getWalletAppOpenUrl(provider);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open {walletProviderLabel(provider)} app
            </Button>

            <p className="mt-3 text-xs text-emerald-100/60">
              Pay Rs. {details?.planAmount} in your {walletProviderLabel(provider)} app, then paste the transaction ID below.
            </p>

            <div className="mt-5">
              <label htmlFor="tid" className="mb-2 block text-sm text-emerald-100/80">
                Transaction ID
              </label>
              <Input
                id="tid"
                value={tid}
                onChange={(event) => setTid(event.target.value)}
                placeholder="e.g. TID-48291037"
                className="bg-white text-zinc-950"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" loading={submitting} loadingLabel="Submitting..." onClick={() => void confirmAppPayment()}>
                I&apos;ve paid — submit
              </Button>
              <Button asChild variant="secondary">
                <Link href="/create-shop">Back</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
