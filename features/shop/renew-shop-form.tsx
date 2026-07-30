"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SubscriptionPaymentPicker, type WalletPaymentChannel } from "@/components/saas/subscription-payment-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PlatformPaymentAccounts } from "@/lib/payment-env";
import { SHOP_PLANS, type ShopPaymentMethod } from "@/lib/saas";

export function RenewShopForm({ defaultPlan }: { defaultPlan?: "monthly" | "yearly" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState<PlatformPaymentAccounts | null>(null);
  const [paymentConfigError, setPaymentConfigError] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [paymentMode, setPaymentMode] = useState<ShopPaymentMethod>("easypaisa");
  const [paymentChannel, setPaymentChannel] = useState<WalletPaymentChannel>("manual");
  const [plan, setPlan] = useState<"monthly" | "yearly">(defaultPlan ?? "monthly");

  useEffect(() => {
    void fetch("/api/shops/pricing")
      .then(async (res) => {
        const data = (await res.json()) as {
          stripeEnabled?: boolean;
          paymentAccounts?: PlatformPaymentAccounts | null;
          paymentConfigError?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? data.paymentConfigError ?? "Could not load pricing.");
        const enabled = Boolean(data.stripeEnabled);
        setStripeEnabled(enabled);
        setPaymentAccounts(data.paymentAccounts ?? null);
        setPaymentConfigError(data.paymentConfigError ?? null);
        if (enabled) setPaymentMode("stripe");
      })
      .catch(() => undefined)
      .finally(() => setAccountsLoading(false));
  }, []);

  async function startStripeRenewal() {
    setPending(true);
    try {
      const res = await fetch("/api/shops/stripe/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Unable to start checkout.");
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start checkout.");
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (paymentMode === "stripe") return;
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/shops/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: form.get("plan"),
          paymentMethod: paymentMode,
          paymentReference: form.get("paymentReference"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Renewal failed");
      toast.success(data.message);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Renewal failed");
    } finally {
      setPending(false);
    }
  }

  const selectedPlan = SHOP_PLANS[plan];

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="font-semibold text-zinc-950">Renew subscription</h2>
      <p className="text-sm text-zinc-600">
        Pay with EasyPaisa, JazzCash, bank transfer{stripeEnabled ? ", or card online" : ""}. Admin verifies manual payments.
      </p>
      <div>
        <Label htmlFor="plan">Plan</Label>
        <Select
          id="plan"
          name="plan"
          className="mt-1.5"
          value={plan}
          onChange={(event) => setPlan(event.target.value as "monthly" | "yearly")}
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
      </div>

      <SubscriptionPaymentPicker
        accounts={paymentAccounts}
        amount={selectedPlan.amount}
        planLabel={selectedPlan.label}
        method={paymentMode}
        onMethodChange={setPaymentMode}
        paymentChannel={paymentChannel}
        onPaymentChannelChange={setPaymentChannel}
        stripeEnabled={stripeEnabled}
        loading={accountsLoading}
        configError={paymentConfigError}
      />

      {paymentMode === "stripe" && stripeEnabled ? (
        <Button type="button" loading={pending} loadingLabel="Redirecting..." onClick={() => void startStripeRenewal()}>
          Pay with card
        </Button>
      ) : paymentChannel === "app" && (paymentMode === "easypaisa" || paymentMode === "jazzcash") ? (
        <p className="text-sm text-zinc-600">
          Pay in app renewal is available from the create-shop flow. Submit a manual transfer reference here, or contact support.
        </p>
      ) : (
        <>
          <div>
            <Label htmlFor="paymentReference">Payment reference / TID</Label>
            <Input id="paymentReference" name="paymentReference" required placeholder="TID-12345678" className="mt-1.5" />
          </div>
          <Button type="submit" loading={pending} loadingLabel="Submitting...">
            Submit renewal
          </Button>
        </>
      )}
    </form>
  );
}
