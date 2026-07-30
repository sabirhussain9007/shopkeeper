"use client";

import { Building2, Copy, ExternalLink, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Loader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import type { PlatformPaymentAccounts } from "@/lib/payment-env";
import { getWalletAppOpenUrl, walletProviderLabel } from "@/lib/payments/wallet-app";
import {
  MANUAL_SHOP_PAYMENT_METHODS,
  shopPaymentMethodLabel,
  type ManualShopPaymentMethod,
  type ShopPaymentMethod,
} from "@/lib/saas";
import { cn } from "@/lib/utils";

export type WalletPaymentChannel = "app" | "manual";

type SubscriptionPaymentPickerProps = {
  accounts: PlatformPaymentAccounts | null;
  amount: number;
  planLabel: string;
  method: ShopPaymentMethod;
  onMethodChange: (method: ShopPaymentMethod) => void;
  paymentChannel: WalletPaymentChannel;
  onPaymentChannelChange: (channel: WalletPaymentChannel) => void;
  stripeEnabled?: boolean;
  walletGateways?: { easypaisa: boolean; jazzcash: boolean };
  loading?: boolean;
  configError?: string | null;
};

function copyText(value: string, label: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Could not copy to clipboard"),
  );
}

function methodIcon(method: ManualShopPaymentMethod) {
  if (method === "bank") return Building2;
  return Smartphone;
}

function methodAccent(method: ManualShopPaymentMethod) {
  if (method === "easypaisa") return "bg-[#00a651] text-white";
  if (method === "jazzcash") return "bg-[#c8102e] text-white";
  return "bg-emerald-400 text-[#0c1f1a]";
}

export function SubscriptionPaymentPicker({
  accounts,
  amount,
  planLabel,
  method,
  onMethodChange,
  paymentChannel,
  onPaymentChannelChange,
  stripeEnabled = false,
  walletGateways,
  loading = false,
  configError = null,
}: SubscriptionPaymentPickerProps) {
  const manualMethod = method === "stripe" ? "easypaisa" : method;
  const isWalletMethod = method === "easypaisa" || method === "jazzcash";
  const gatewayLive =
    isWalletMethod && walletGateways
      ? method === "easypaisa"
        ? walletGateways.easypaisa
        : walletGateways.jazzcash
      : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {stripeEnabled ? (
          <button
            type="button"
            onClick={() => onMethodChange("stripe")}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              method === "stripe"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300",
            )}
          >
            Pay online (Stripe)
          </button>
        ) : null}
        {MANUAL_SHOP_PAYMENT_METHODS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onMethodChange(item)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              method === item
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300",
            )}
          >
            {shopPaymentMethodLabel(item)}
          </button>
        ))}
      </div>

      {isWalletMethod ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPaymentChannelChange("app")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
              paymentChannel === "app"
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-600",
            )}
          >
            Pay online in app
          </button>
          <button
            type="button"
            onClick={() => onPaymentChannelChange("manual")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
              paymentChannel === "manual"
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-600",
            )}
          >
            Manual transfer
          </button>
        </div>
      ) : null}

      {method === "stripe" && stripeEnabled ? (
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
          <p className="font-medium">Secure online checkout</p>
          <p className="mt-2 text-sm text-emerald-900/80">
            After you submit shop details, you&apos;ll be redirected to Stripe to pay Rs. {amount}. Your shop activates
            automatically once payment succeeds.
          </p>
        </div>
      ) : isWalletMethod && paymentChannel === "app" ? (
        <div className="rounded-[1.5rem] border border-emerald-900/10 bg-[#0f2420] p-5 text-white md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className={cn("grid h-11 w-11 place-items-center rounded-xl", methodAccent(manualMethod))}>
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Pay online</p>
                <p className="mt-1 font-[family-name:var(--font-landing-display)] text-2xl">
                  Rs. {amount}
                  <span className="ml-2 text-base font-normal text-emerald-100/60">· {shopPaymentMethodLabel(manualMethod)}</span>
                </p>
              </div>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-emerald-100/70">{planLabel} plan</span>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            {gatewayLive ? (
              <p className="text-emerald-100/80">
                After shop details are saved, you&apos;ll be redirected to the secure {shopPaymentMethodLabel(manualMethod)}{" "}
                checkout. Your shop activates automatically when payment succeeds.
              </p>
            ) : (
              <>
                <p className="text-emerald-100/80">
                  After shop details are saved, open the {shopPaymentMethodLabel(manualMethod)} app on your phone, pay Rs.{" "}
                  {amount}
                  {accounts ? (
                    <>
                      {" "}
                      to <span className="font-mono text-white">{accounts[manualMethod as "easypaisa" | "jazzcash"].displayNumber}</span>
                    </>
                  ) : null}
                  , then confirm with your transaction ID.
                </p>
                {accounts ? (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      if (manualMethod === "bank") return;
                      window.open(getWalletAppOpenUrl(manualMethod), "_blank", "noopener,noreferrer");
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Preview {manualMethod !== "bank" ? walletProviderLabel(manualMethod) : ""} app
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-emerald-900/10 bg-[#0f2420] p-5 text-white md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className={cn("grid h-11 w-11 place-items-center rounded-xl", methodAccent(manualMethod))}>
                {(() => {
                  const Icon = methodIcon(manualMethod);
                  return <Icon className="h-5 w-5" />;
                })()}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Send payment to</p>
                <p className="mt-1 font-[family-name:var(--font-landing-display)] text-2xl">
                  Rs. {amount}
                  <span className="ml-2 text-base font-normal text-emerald-100/60">· {shopPaymentMethodLabel(manualMethod)}</span>
                </p>
              </div>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-emerald-100/70">{planLabel} plan</span>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            {loading ? (
              <Loader label="Loading payment accounts…" variant="inline" className="text-emerald-100/60" />
            ) : configError ? (
              <div className="space-y-2 text-amber-100">
                <p className="font-medium">Payment accounts are not available</p>
                <p className="text-xs text-emerald-100/70">{configError}</p>
              </div>
            ) : !accounts ? (
              <p className="text-emerald-100/70">Payment account details could not be loaded.</p>
            ) : manualMethod === "bank" ? (
              <div className="space-y-2 font-mono">
                <p>
                  <span className="text-emerald-300/70">Bank</span>
                  <span className="ml-3 text-white">{accounts.bank.bankName}</span>
                </p>
                <p>
                  <span className="text-emerald-300/70">Title</span>
                  <span className="ml-3 text-white">{accounts.bank.accountTitle}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p>
                    <span className="text-emerald-300/70">Account</span>
                    <span className="ml-3 text-lg tracking-wide text-white">{accounts.bank.accountNumber}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(accounts.bank.accountNumber, "Account number")}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-emerald-100/80 transition hover:bg-white/10"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p>
                  <span className="text-emerald-300/70">Account title</span>
                  <span className="ml-3 text-white">{accounts[manualMethod].accountTitle}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p>
                    <span className="text-emerald-300/70">{shopPaymentMethodLabel(manualMethod)}</span>
                    <span className="ml-3 font-mono text-lg tracking-wide text-white">
                      {accounts[manualMethod].displayNumber}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(accounts[manualMethod].accountNumber, shopPaymentMethodLabel(manualMethod))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-emerald-100/80 transition hover:bg-white/10"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
                <p className="text-xs text-emerald-100/60">
                  Send Rs. {amount} from your {shopPaymentMethodLabel(manualMethod)} app, then paste the transaction ID below.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
