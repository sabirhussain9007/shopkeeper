"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, ShieldCheck, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRoleLandingPath } from "@/lib/access";
import type { Role } from "@/types";

const highlights = [
  { icon: Users, title: "Shop owners & staff", text: "Sign in with the email linked to your shop." },
  { icon: ShieldCheck, title: "Platform admins", text: "Super admins open the shops dashboard." },
  { icon: KeyRound, title: "Secure access", text: "RBAC keeps each shop’s data separated." },
] as const;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      toast.success("Shop submitted. Sign in after an admin verifies your payment.");
    }
  }, [searchParams]);

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
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f2420]/95 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl"
    >
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

          <div className="max-w-xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-2xl bg-emerald-400 p-3 text-[#0c1f1a]">
                <Store className="h-6 w-6" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Shopkeeper SaaS</span>
            </div>
            <h1 className="font-[family-name:var(--font-landing-display)] text-4xl leading-none text-white md:text-5xl">Welcome back</h1>
            <p className="mt-3 text-base text-emerald-50/70 md:text-lg">Sign in to run your shop, or open the platform admin console.</p>
          </div>

          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition duration-300 hover:bg-white/10">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-emerald-50/55">{item.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="space-y-6 bg-[var(--panel)] px-6 py-8 text-zinc-950 md:px-10 md:py-10">
        <div>
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl">Sign in</h2>
          <p className="text-sm text-zinc-500">Use the email and password for your shop or super admin account.</p>
        </div>

        <div className="mx-auto grid max-w-md gap-3">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-700">
              Email
            </label>
            <Input id="email" name="email" type="email" placeholder="you@shop.com" required autoComplete="email" className="bg-white" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-700">
              Password
            </label>
            <Input id="password" name="password" type="password" placeholder="••••••••" required autoComplete="current-password" className="bg-white" />
          </div>
          <Button className="mt-2 w-full" type="submit" loading={isPending} loadingLabel="Signing in...">
            Sign in
          </Button>
          <div className="flex justify-between text-sm text-zinc-500">
            <Link href="/forgot-password" className="hover:text-emerald-700">
              Forgot password?
            </Link>
            <Link href="/create-shop" className="font-medium text-emerald-700 hover:underline">
              Create shop
            </Link>
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-6 text-center text-sm text-zinc-500">
          New here?{" "}
          <Link href="/create-shop" className="font-medium text-emerald-700 hover:underline">
            Create a shop
          </Link>{" "}
          and get approved by the platform admin.
        </div>
      </div>
    </form>
  );
}
