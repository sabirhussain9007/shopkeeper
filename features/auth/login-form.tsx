"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRoleLandingPath } from "@/lib/access";
import type { Role } from "@/types";

export function LoginForm({ businessName }: { businessName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    const callbackUrl = searchParams.get("callbackUrl");
    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
      callbackUrl: callbackUrl ?? undefined,
    });
    setIsPending(false);

    if (result?.error) {
      toast.error("Invalid email or password.");
      return;
    }

    const session = await getSession();
    router.push(callbackUrl ?? getRoleLandingPath(session?.user?.role as Role | undefined));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-2xl bg-emerald-500 p-3 text-zinc-950">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{businessName} Login</h1>
          <p className="text-sm text-zinc-500">RBAC protected retail operations.</p>
        </div>
      </div>
      <div className="space-y-4">
        <Input name="email" type="email" placeholder="Email address" required autoComplete="email" />
        <Input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
        <div className="flex justify-between text-sm text-zinc-500">
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <p className="text-center text-sm text-zinc-500">
          New to {businessName}?{" "}
          <Link className="font-medium text-emerald-700 dark:text-emerald-400" href="/signup">
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}
