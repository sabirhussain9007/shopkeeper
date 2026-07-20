"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
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
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-2xl bg-emerald-500 p-3 text-zinc-950">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <p className="text-sm text-zinc-500">Choose a new password for your account.</p>
        </div>
      </div>
      <div className="space-y-4">
        {!token ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            No reset token found.{" "}
            <Link className="font-medium underline" href="/forgot-password">
              Request a new one
            </Link>
            .
          </p>
        ) : null}
        <Input name="password" type="password" placeholder="New password" required minLength={8} autoComplete="new-password" />
        <Input name="confirm" type="password" placeholder="Confirm password" required minLength={8} autoComplete="new-password" />
        <Button className="w-full" type="submit" disabled={!token} loading={isPending} loadingLabel="Updating...">
          Reset password
        </Button>
        <p className="text-center text-sm text-zinc-500">
          <Link className="font-medium text-emerald-700 dark:text-emerald-400" href="/login">
            Back to login
          </Link>
        </p>
      </div>
    </form>
  );
}
