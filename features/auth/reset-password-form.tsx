"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      toast.error("Reset token is missing. Use the link from your email.");
      return;
    }
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password !== confirm) {
      setIsPending(false);
      toast.error("Passwords do not match.");
      return;
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setIsPending(false);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(body.error ?? "Unable to reset password.");
      return;
    }
    toast.success("Password reset. You can sign in now.");
    router.push("/login");
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
            <h1 className="font-[family-name:var(--font-landing-display)] text-2xl text-white">Reset password</h1>
            <p className="text-sm text-emerald-50/60">Choose a new password for your account.</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 bg-[var(--panel)] px-6 py-8 text-zinc-950 md:px-8">
        {!token ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            No reset token found.{" "}
            <Link className="font-medium underline" href="/forgot-password">
              Request a new one
            </Link>
            .
          </p>
        ) : null}
        <Input name="password" type="password" placeholder="New password" required minLength={8} autoComplete="new-password" className="bg-white" />
        <Input name="confirm" type="password" placeholder="Confirm password" required minLength={8} autoComplete="new-password" className="bg-white" />
        <Button className="w-full" type="submit" disabled={!token} loading={isPending} loadingLabel="Updating...">
          Reset password
        </Button>
        <p className="text-center text-sm text-zinc-500">
          <Link className="font-medium text-emerald-700 hover:underline" href="/login">
            Back to login
          </Link>
        </p>
      </div>
    </form>
  );
}
