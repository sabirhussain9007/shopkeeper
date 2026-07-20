import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { getRoleLandingPath } from "@/lib/access";
import { authOptions } from "@/lib/auth";
import { SHOP_PLANS } from "@/lib/saas";
import type { Role } from "@/types";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect(getRoleLandingPath(session.user.role as Role));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0c1f1a] text-[#f3f7f4]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 10%, rgba(52,211,153,0.25), transparent 55%), radial-gradient(ellipse 60% 40% at 85% 20%, rgba(251,191,36,0.18), transparent 50%), linear-gradient(180deg, #0c1f1a 0%, #123029 45%, #0a1814 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-emerald-400 p-2.5 text-[#0c1f1a]">
              <Store className="h-5 w-5" />
            </span>
            <span className="font-[family-name:var(--font-landing-display)] text-2xl tracking-tight text-white">Shopkeeper</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/10">
              Login
            </Link>
            <Link href="/create-shop" className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-[#0c1f1a] transition hover:bg-emerald-300">
              Create shop
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 md:py-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300/90">Multi-shop retail SaaS</p>
          <h1 className="max-w-3xl font-[family-name:var(--font-landing-display)] text-5xl leading-[1.05] text-white md:text-7xl">
            Run your shop.
            <span className="block text-emerald-300">Own your till.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-emerald-50/75 md:text-xl">
            POS, inventory, ledger, and reports for Pakistani retailers — activate a shop in minutes with EasyPaisa, JazzCash, or bank transfer.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/create-shop"
              className="rounded-full bg-emerald-400 px-8 py-3.5 text-base font-semibold text-[#0c1f1a] shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-300"
            >
              Create shop
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/25 bg-white/5 px-8 py-3.5 text-base font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </section>

        <section className="grid gap-4 border-t border-white/10 pb-10 pt-8 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm uppercase tracking-wider text-emerald-300/80">Monthly</p>
            <p className="mt-2 font-[family-name:var(--font-landing-display)] text-4xl text-white">Rs. {SHOP_PLANS.monthly.amount}</p>
            <p className="mt-1 text-emerald-50/70">{SHOP_PLANS.monthly.label} of full access</p>
          </div>
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 backdrop-blur">
            <p className="text-sm uppercase tracking-wider text-emerald-300/80">Yearly</p>
            <p className="mt-2 font-[family-name:var(--font-landing-display)] text-4xl text-white">Rs. {SHOP_PLANS.yearly.amount}</p>
            <p className="mt-1 text-emerald-50/70">
              {SHOP_PLANS.yearly.label} of full access · Save Rs. {SHOP_PLANS.yearly.discount}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
