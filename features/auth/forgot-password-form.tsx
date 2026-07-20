"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [isPending, setIsPending] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setDevToken(null);
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email") }),
    });
    setIsPending(false);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Unable to process request.");
      return;
    }
    toast.success(body.message ?? "Check your email for reset instructions.");
    if (body.resetToken) setDevToken(body.resetToken);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f2420]/95 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl"
    >
      <div className="border-b border-white/10 px-6 py-8 md:px-8">
        <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-sm text-emerald-100/70 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-emerald-400 p-3 text-[#0c1f1a]">
            <Store className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-landing-display)] text-2xl text-white">Forgot password</h1>
            <p className="text-sm text-emerald-50/60">We will send reset instructions if the account exists.</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 bg-[#f6f8f5] px-6 py-8 text-zinc-950 md:px-8">
        <Input name="email" type="email" placeholder="Email address" required autoComplete="email" className="bg-white" />
        <Button className="w-full" type="submit" loading={isPending} loadingLabel="Sending...">
          Send reset link
        </Button>
        {devToken ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Dev token:{" "}
            <Link className="font-medium underline" href={`/reset-password?token=${devToken}`}>
              use this reset link
            </Link>
          </p>
        ) : null}
        <p className="text-center text-sm text-zinc-500">
          <Link className="font-medium text-emerald-700 hover:underline" href="/login">
            Back to login
          </Link>
        </p>
      </div>
    </form>
  );
}
