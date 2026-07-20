"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Building2, Clock, Receipt, ShieldCheck, Smartphone, Store, Wallet } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createShopSchema } from "@/schemas/domain";
import { MobileInput, formatMobileOnInput } from "@/components/ui/pakistan-fields";
import { MOBILE_PLACEHOLDER } from "@/lib/pakistan-validators";
import { SHOP_PLANS, type ShopPaymentMethod, type ShopPlanId } from "@/lib/saas";
import { cn } from "@/lib/utils";

type PricingResponse = {
  paymentAccounts: {
    easypaisa: string;
    jazzcash: string;
    bank: { bankName: string; accountTitle: string; accountNumber: string };
  };
};

const paymentLabels: Record<ShopPaymentMethod, string> = {
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  bank: "Bank",
};

const paymentIcons: Record<ShopPaymentMethod, typeof Wallet> = {
  easypaisa: Smartphone,
  jazzcash: Wallet,
  bank: Building2,
};

const steps = [
  { icon: Wallet, title: "Pay outside the app", text: "Send the plan amount to the account shown." },
  { icon: Receipt, title: "Submit transaction ID", text: "Paste your receipt or TID below." },
  { icon: ShieldCheck, title: "Wait for approval", text: "Super admin verifies and activates your shop." },
] as const;

export function CreateShopForm() {
  const router = useRouter();
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [plan, setPlan] = useState<ShopPlanId>("monthly");
  const [paymentMethod, setPaymentMethod] = useState<ShopPaymentMethod>("easypaisa");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    void fetch("/api/shops/pricing")
      .then((res) => res.json())
      .then((data: PricingResponse) => setPricing(data))
      .catch(() => toast.error("Could not load pricing."));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      shopName: String(form.get("shopName") ?? ""),
      ownerName: String(form.get("ownerName") ?? ""),
      ownerEmail: String(form.get("ownerEmail") ?? ""),
      ownerPhone: String(form.get("ownerPhone") ?? ""),
      password: String(form.get("password") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
      plan,
      paymentMethod,
      paymentReference: String(form.get("paymentReference") ?? ""),
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
    const data = (await res.json()) as { error?: string; message?: string };
    setIsPending(false);

    if (!res.ok) {
      toast.error(data.error ?? "Could not create shop.");
      return;
    }

    toast.success(data.message ?? "Shop submitted for approval.");
    router.push("/login?created=1");
  }

  const accounts = pricing?.paymentAccounts;
  const selectedPlan = SHOP_PLANS[plan];
  const PaymentIcon = paymentIcons[paymentMethod];

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
              <p className="mt-3 text-base text-emerald-50/70 md:text-lg">Open your till in three steps. No in-app payment — just transfer and get verified.</p>
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
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl">How will you pay?</h2>
          <p className="mb-4 text-sm text-zinc-500">Transfer Rs. {selectedPlan.amount} outside the app, then submit your TID.</p>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(paymentLabels) as ShopPaymentMethod[]).map((method) => {
              const Icon = paymentIcons[method];
              const selected = paymentMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition",
                    selected ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                  )}
                >
                  <span className={cn("grid h-10 w-10 place-items-center rounded-xl", selected ? "bg-emerald-500 text-zinc-950" : "bg-zinc-100 text-zinc-600")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-semibold">{paymentLabels[method]}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-[1.5rem] border border-emerald-900/10 bg-[#0f2420] p-5 text-white md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400 text-[#0c1f1a]">
                  <PaymentIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Send payment to</p>
                  <p className="mt-1 font-[family-name:var(--font-landing-display)] text-2xl">
                    Rs. {selectedPlan.amount}
                    <span className="ml-2 text-base font-normal text-emerald-100/60">· {paymentLabels[paymentMethod]}</span>
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-emerald-100/70">{selectedPlan.label} plan</span>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-sm">
              {accounts && paymentMethod === "easypaisa" && (
                <p>
                  <span className="text-emerald-300/70">EasyPaisa</span>
                  <span className="ml-3 text-lg tracking-wide text-white">{accounts.easypaisa}</span>
                </p>
              )}
              {accounts && paymentMethod === "jazzcash" && (
                <p>
                  <span className="text-emerald-300/70">JazzCash</span>
                  <span className="ml-3 text-lg tracking-wide text-white">{accounts.jazzcash}</span>
                </p>
              )}
              {accounts && paymentMethod === "bank" && (
                <div className="space-y-1.5">
                  <p>
                    <span className="text-emerald-300/70">Bank</span>
                    <span className="ml-3 text-white">{accounts.bank.bankName}</span>
                  </p>
                  <p>
                    <span className="text-emerald-300/70">Title</span>
                    <span className="ml-3 text-white">{accounts.bank.accountTitle}</span>
                  </p>
                  <p>
                    <span className="text-emerald-300/70">Account</span>
                    <span className="ml-3 text-lg tracking-wide text-white">{accounts.bank.accountNumber}</span>
                  </p>
                </div>
              )}
              {!accounts && <Loader label="Loading payment account…" variant="inline" className="text-emerald-100/60" />}
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="paymentReference" className="mb-2 block text-sm font-medium text-zinc-700">
              Transaction / receipt ID
            </label>
            <Input id="paymentReference" name="paymentReference" placeholder="e.g. TID-48291037" required className="bg-white" />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-6">
          <p className="text-sm text-zinc-500">Already registered? <Link href="/login" className="font-medium text-emerald-700 hover:underline">Login</Link></p>
          <Button type="submit" loading={isPending} loadingLabel="Submitting..." className="min-w-44">
            Submit for approval
          </Button>
        </div>
      </div>
    </form>
  );
}
