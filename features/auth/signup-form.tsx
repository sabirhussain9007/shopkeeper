"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignupResponse =
  | {
      id: string;
      name: string;
      email: string;
      role: string;
    }
  | {
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export function SignupForm({ canSignup, businessName }: { canSignup: boolean; businessName: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password,
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      }),
    });

    const result = (await response.json()) as SignupResponse;

    if (!response.ok) {
      setIsPending(false);
      toast.error("error" in result ? result.error : "Unable to create account.");
      return;
    }

    const loginResult = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    setIsPending(false);

    if (loginResult?.error) {
      toast.success("Account created. Please sign in.");
      router.push("/login");
      return;
    }

    toast.success("Account created successfully.");
    router.push(loginResult?.url ?? "/dashboard");
    router.refresh();
  }

  if (!canSignup) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950">
          <UserPlus className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold">{businessName} signup is closed</h1>
        <p className="mt-3 text-sm text-zinc-500">
          An admin account already exists. Only an admin can add users from the Settings panel.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-2xl bg-emerald-500 p-3 text-zinc-950">
          <UserPlus className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Create {businessName} Account</h1>
          <p className="text-sm text-zinc-500">No admin account exists yet. This signup will create the admin user.</p>
        </div>
      </div>
      <div className="space-y-4">
        <Input name="name" placeholder="Full name" required autoComplete="name" />
        <Input name="email" type="email" placeholder="Email address" required autoComplete="email" />
        <Input name="password" type="password" placeholder="Password" required minLength={8} autoComplete="new-password" />
        <Input name="confirmPassword" type="password" placeholder="Confirm password" required minLength={8} autoComplete="new-password" />
        <Button className="w-full" type="submit" loading={isPending} loadingLabel="Creating account...">
          Sign up
        </Button>
        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link className="font-medium text-emerald-700 dark:text-emerald-400" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
