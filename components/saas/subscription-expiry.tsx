"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getExpiryWarningLabel, getExpiryWarningLevel, shouldBlinkExpiry } from "@/lib/saas";

type Props = {
  remainingDays: number;
  planLabel?: string;
  expiresAt?: string | null;
  variant?: "banner" | "badge" | "card";
  className?: string;
};

const colorMap = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  green: "border-emerald-300 bg-emerald-50 text-emerald-900",
  yellow: "border-amber-300 bg-amber-50 text-amber-900",
  orange: "border-orange-400 bg-orange-50 text-orange-950",
  red: "border-red-400 bg-red-50 text-red-900",
  expired: "border-red-600 bg-red-100 text-red-950",
} as const;

export function SubscriptionExpiryBadge({ remainingDays, planLabel, expiresAt, variant = "badge", className }: Props) {
  const level = getExpiryWarningLevel(remainingDays);
  const blink = shouldBlinkExpiry(remainingDays);
  const label = getExpiryWarningLabel(remainingDays);

  if (level === "ok") return null;

  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
          colorMap[level],
          blink && "animate-pulse",
          className,
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("rounded-2xl border p-4", colorMap[level], blink && "animate-pulse", className)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{label}</p>
            <p className="mt-1 text-sm opacity-80">
              {planLabel ? `${planLabel} plan` : "Current plan"}
              {expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          {(level === "expired" || remainingDays <= 3) && (
            <Button asChild size="sm">
              <Link href="/create-shop">Renew Now</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mb-4 rounded-xl border px-4 py-3 text-sm font-medium", colorMap[level], blink && "animate-pulse", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {label}
        </span>
        {level === "expired" ? (
          <Link href="/create-shop" className="underline">
            Renew Now
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function SubscriptionExpiryPopup({ remainingDays, planLabel }: { remainingDays: number; planLabel?: string }) {
  const blink = shouldBlinkExpiry(remainingDays);
  const storageKey = `shop-expiry-popup-${new Date().toISOString().slice(0, 10)}`;
  const [dismissed, setDismissed] = useState(false);

  const alreadyShown = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem(storageKey) === "1",
    () => true,
  );

  const eligible = blink || remainingDays <= 3;
  const open = eligible && !alreadyShown && !dismissed;

  function dismiss() {
    sessionStorage.setItem(storageKey, "1");
    setDismissed(true);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className={cn("w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl", blink && "animate-pulse")}>
        <h3 className="text-xl font-semibold">{getExpiryWarningLabel(remainingDays)}</h3>
        <p className="mt-2 text-sm text-zinc-600">
          {planLabel ? `${planLabel} package` : "Your package"} needs attention. Renew soon to avoid interruption.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={dismiss}>
            Dismiss
          </Button>
          <Button asChild>
            <Link href="/create-shop" onClick={dismiss}>
              Renew Now
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
