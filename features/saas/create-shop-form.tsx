"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Clock, Receipt, ShieldCheck, Store, Wallet } from "lucide-react";
import { SubscriptionPaymentPicker, type WalletPaymentChannel } from "@/components/saas/subscription-payment-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileInput, formatMobileOnInput } from "@/components/ui/pakistan-fields";
import { MOBILE_PLACEHOLDER } from "@/lib/pakistan-validators";
import type { PlatformPaymentAccounts } from "@/lib/payment-env";
import { SHOP_PLANS, type ShopPlanId, type ShopPaymentMethod } from "@/lib/saas";
import { cn } from "@/lib/utils";
import { createShopSchema } from "@/schemas/domain";

type PricingResponse = {
  paymentAccounts: PlatformPaymentAccounts | null;
  paymentConfigError?: string;
  stripeEnabled?: boolean;
  walletGateways?: { easypaisa: boolean; jazzcash: boolean };
};

const stepsWalletApp = [
  { icon: Wallet, title: "Pay in EasyPaisa or JazzCash app", text: "Open your wallet app and pay online." },
  { icon: Receipt, title: "Confirm payment", text: "Submit your transaction ID or complete secure checkout." },
  { icon: ShieldCheck, title: "Get access", text: "Instant activation with gateway, or admin verification for app pay." },
] as const;

const stepsManual = [
  { icon: Wallet, title: "Pay via EasyPaisa, JazzCash, or bank", text: "Send the plan amount to the account shown." },
  { icon: Receipt, title: "Submit transaction ID", text: "Paste your receipt or TID below." },
  { icon: ShieldCheck, title: "Wait for approval", text: "Super admin verifies and activates your shop." },
] as const;

const stepsStripe = [
  { icon: Wallet, title: "Pay online", text: "Secure card payment via Stripe checkout." },
  { icon: ShieldCheck, title: "Instant activation", text: "Your shop activates automatically after payment." },
  { icon: Store, title: "Start selling", text: "Sign in and use your shop right away." },
] as const;

export function CreateShopForm() {
  const router = useRouter();
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [plan, setPlan] = useState<ShopPlanId>("monthly");
  const [paymentMode, setPaymentMode] = useState<ShopPaymentMethod>("easypaisa");
  const [paymentChannel, setPaymentChannel] = useState<WalletPaymentChannel>("app");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    void fetch("/api/shops/pricing")
      .then(async (res) => {
        const data = (await res.json()) as PricingResponse & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? data.paymentConfigError ?? "Could not load pricing.");
        }
        setPricing(data);
        if (data.stripeEnabled) setPaymentMode("stripe");
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Could not load pricing.");
      })
      .finally(() => setPricingLoading(false));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    const form = new FormData(event.currentTarget);
    const payOnline =
      paymentChannel === "app" && (paymentMode === "easypaisa" || paymentMode === "jazzcash");
    const payload = {
      shopName: String(form.get("shopName") ?? ""),
      ownerName: String(form.get("ownerName") ?? ""),
      ownerEmail: String(form.get("ownerEmail") ?? ""),
      ownerPhone: String(form.get("ownerPhone") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
      plan,
      paymentMethod: paymentMode,
      paymentReference: payOnline || paymentMode === "stripe" ? "" : String(form.get("paymentReference") ?? ""),
      payOnline,
    };

    const parsed = createShopSchema.safeParse(payload);
    if (!parsed.success) {
      setIsPending(false);
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }

    const res = await fetch("/api/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = (await res.json()) as { error?: string; message?: string; id?: string };
    if (!res.ok) {
      setIsPending(false);
      toast.error(data.error ?? "Could not create shop.");
      return;
    }

    if (paymentMode === "stripe" && data.id) {
      const checkoutRes = await fetch("/api/shops/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: data.id }),
      });
      const checkout = (await checkoutRes.json()) as { error?: string; url?: string };
      setIsPending(false);
      if (!checkoutRes.ok || !checkout.url) {
        toast.error(checkout.error ?? "Could not start online payment.");
        return;
      }
      window.location.href = checkout.url;
      return;
    }

    if (payOnline && data.id) {
      setIsPending(false);
      router.push(`/create-shop/pay?shopId=${data.id}&provider=${paymentMode}`);
      return;
    }

    setIsPending(false);
    toast.success(data.message ?? "Shop submitted for approval.");
    router.push("/login?created=1");
  }

  const selectedPlan = SHOP_PLANS[plan];
  const stripeEnabled = pricing?.stripeEnabled ?? false;
  const walletAppPay =
    paymentChannel === "app" && (paymentMode === "easypaisa" || paymentMode === "jazzcash");
  const steps =
    paymentMode === "stripe" && stripeEnabled ? stepsStripe : walletAppPay ? stepsWalletApp : stepsManual;
  const needsManualReference =
    paymentMode === "bank" ||
    ((paymentMode === "easypaisa" || paymentMode === "jazzcash") && paymentChannel === "manual");

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f2420]/95 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
      <div className="relative overflow-hidden border-b border-white/10 px-6 py-8 md:px-10 md:py-10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 0% 0%, rgba(52,211,153,0.28), transparent 55%), radial-gradient(ellipse 50% 60% at 100% 20%, rgba(250,204,21,0.12), transparent 50%)",
          }}
        />
        <div className="relative">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-emerald-100/70 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-2xl bg-emerald-400 p-3 text-[#0c1f1a]">
                  <Store className="h-6 w-6" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Shopkeeper SaaS</span>
              </div>
              <h1 className="font-[family-name:var(--font-landing-display)] text-4xl leading-none text-white md:text-5xl">Create your shop</h1>
              <p className="mt-3 text-base text-emerald-50/70 md:text-lg">
                Pay with EasyPaisa, JazzCash, bank transfer{stripeEnabled ? ", or card online" : ""}. Get verified and start selling.
              </p>
            </div>
          </div>

          <ol className="relative mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 transition duration-300 hover:bg-white/10"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">Step {index + 1}</span>
                  </div>
                  <p className="font-semibold text-white">{step.title}</p>
                  <p className="mt-1 text-sm text-emerald-50/55">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="space-y-8 bg-[var(--panel)] px-6 py-8 text-zinc-950 md:px-10 md:py-10">
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-[family-name:var(--font-landing-display)] text-2xl">Choose a plan</h2>
              <p className="text-sm text-zinc-500">Pick how long you want full shop access.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(Object.values(SHOP_PLANS) as Array<(typeof SHOP_PLANS)[ShopPlanId]>).map((item) => {
              const selected = plan === item.id;
              const isYearly = item.id === "yearly";
              const yearlyDiscount = "discount" in item ? item.discount : undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPlan(item.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.5rem] border p-6 text-left transition duration-300",
                    selected
                      ? "border-emerald-600 bg-[#0f2420] text-white shadow-lg shadow-emerald-900/20"
                      : "border-zinc-200 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md",
                  )}
                >
                  {isYearly && (
                    <span
                      className={cn(
                        "absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                        selected ? "bg-emerald-400 text-[#0c1f1a]" : "bg-emerald-100 text-emerald-800",
                      )}
                    >
                      Best value
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className={cn("h-4 w-4", selected ? "text-emerald-300" : "text-emerald-600")} />
                    <p className={cn("text-sm font-semibold uppercase tracking-[0.18em]", selected ? "text-emerald-300" : "text-emerald-700")}>
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-4 font-[family-name:var(--font-landing-display)] text-5xl leading-none tracking-tight">
                    <span className="text-2xl align-top">Rs.</span> {item.amount}
                  </p>
                  {yearlyDiscount ? (
                    <p className={cn("mt-2 text-sm font-medium", selected ? "text-emerald-300" : "text-emerald-700")}>
                      Save Rs. {yearlyDiscount} vs 12 months
                    </p>
                  ) : null}
                  <p className={cn("mt-3 text-sm", selected ? "text-emerald-50/70" : "text-zinc-500")}>{item.description}</p>
                  <div className={cn("mt-5 flex items-center gap-2 text-sm font-medium", selected ? "text-emerald-300" : "text-zinc-400")}>
                    <BadgeCheck className="h-4 w-4" />
                    {selected ? "Selected" : "Select plan"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl">Shop details</h2>
          <p className="mb-4 text-sm text-zinc-500">This account becomes the shop admin after approval.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Input name="shopName" placeholder="Shop name" required className="bg-white" />
            <Input name="ownerName" placeholder="Owner full name" required className="bg-white" />
            <Input name="ownerEmail" type="email" placeholder="Owner email" required autoComplete="email" className="bg-white" />
            <MobileInput name="ownerPhone" className="bg-white" placeholder={`Owner mobile (${MOBILE_PLACEHOLDER})`} onChange={formatMobileOnInput} />
            <Input name="password" type="password" placeholder="Password (min 8)" required autoComplete="new-password" className="bg-white" />
            <Input name="confirmPassword" type="password" placeholder="Confirm password" required autoComplete="new-password" className="bg-white" />
          </div>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl">Payment</h2>
          <p className="mb-4 text-sm text-zinc-500">Rs. {selectedPlan.amount} for the {selectedPlan.label.toLowerCase()} plan.</p>

          <SubscriptionPaymentPicker
            accounts={pricing?.paymentAccounts ?? null}
            amount={selectedPlan.amount}
            planLabel={selectedPlan.label}
            method={paymentMode}
            onMethodChange={(method) => {
              setPaymentMode(method);
              if (method === "bank") setPaymentChannel("manual");
            }}
            paymentChannel={paymentChannel}
            onPaymentChannelChange={setPaymentChannel}
            stripeEnabled={stripeEnabled}
            walletGateways={pricing?.walletGateways}
            loading={pricingLoading}
            configError={pricing?.paymentConfigError}
          />

          {needsManualReference ? (
            <div className="mt-4">
              <label htmlFor="paymentReference" className="mb-2 block text-sm font-medium text-zinc-700">
                Transaction / receipt ID
              </label>
              <Input id="paymentReference" name="paymentReference" placeholder="e.g. TID-48291037" required className="bg-white" />
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6">
          <p className="text-sm text-zinc-500">
            Already registered?{" "}
            <Link href="/login" className="font-medium text-emerald-700 hover:underline">
              Login
            </Link>
          </p>
          <Button type="submit" loading={isPending} loadingLabel="Submitting..." className="min-w-44">
            {paymentMode === "stripe" && stripeEnabled
              ? "Continue to payment"
              : walletAppPay
                ? "Continue to pay in app"
                : "Submit for approval"}
          </Button>
        </div>
      </div>
    </form>
  );
}
