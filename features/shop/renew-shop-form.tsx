"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function RenewShopForm({ defaultPlan }: { defaultPlan?: "monthly" | "yearly" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/shops/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: form.get("plan"),
          paymentMethod: form.get("paymentMethod"),
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

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="font-semibold text-zinc-950">Renew subscription</h2>
      <p className="text-sm text-zinc-600">Submit a new payment reference for admin verification.</p>
      <div>
        <Label htmlFor="plan">Plan</Label>
        <Select id="plan" name="plan" className="mt-1.5" defaultValue={defaultPlan ?? "monthly"}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="paymentReference">Payment reference / TID</Label>
        <Input id="paymentReference" name="paymentReference" required placeholder="TID-12345678" className="mt-1.5" />
        <input type="hidden" name="paymentMethod" value="bank" />
        <p className="mt-1 text-xs text-zinc-500">Pay by bank transfer, then enter your transaction reference.</p>
      </div>
      <Button type="submit" loading={pending} loadingLabel="Submitting...">
        Submit renewal
      </Button>
    </form>
  );
}
