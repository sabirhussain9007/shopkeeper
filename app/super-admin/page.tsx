import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Store } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { SuperAdminShops } from "@/features/saas/super-admin-shops";
import { SuperAdminSignOut } from "@/features/saas/super-admin-signout";
import { AppPanel, PageBackground } from "@/components/layout/page-background";

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="relative min-h-screen text-zinc-950">
      <PageBackground />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f2420]/95 backdrop-blur-xl shadow-lg shadow-emerald-950/30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-emerald-400 p-2.5 text-[#0c1f1a]">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Platform</p>
              <h1 className="font-[family-name:var(--font-landing-display)] text-2xl text-white">Super Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-emerald-50/60 sm:inline">{session.user.email}</span>
            <Link href="/" className="text-emerald-100/70 transition hover:text-white">
              Home
            </Link>
            <SuperAdminSignOut />
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-7xl p-4 md:p-8">
        <AppPanel className="p-4 md:p-8">
          <div className="mb-6">
            <h2 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold text-zinc-950">Subscription Monitoring</h2>
            <p className="text-sm text-zinc-500">Review payments, approve new shops, and manage subscriptions.</p>
          </div>
          <SuperAdminShops />
        </AppPanel>
      </main>
    </div>
  );
}
