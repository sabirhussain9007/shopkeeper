"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
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
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-2xl bg-emerald-500 p-3 text-zinc-950">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          <p className="text-sm text-zinc-500">We will send reset instructions if the account exists.</p>
        </div>
      </div>
      <div className="space-y-4">
        <Input name="email" type="email" placeholder="Email address" required autoComplete="email" />
        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending ? "Sending..." : "Send reset link"}
        </Button>
        {devToken ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Dev token:{" "}
            <Link className="font-medium underline" href={`/reset-password?token=${devToken}`}>
              use this reset link
            </Link>
          </p>
        ) : null}
        <p className="text-center text-sm text-zinc-500">
          <Link className="font-medium text-emerald-700 dark:text-emerald-400" href="/login">
            Back to login
          </Link>
        </p>
      </div>
    </form>
  );
}
