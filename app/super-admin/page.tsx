import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Store } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { SuperAdminShops } from "@/features/saas/super-admin-shops";
import { SuperAdminSignOut } from "@/features/saas/super-admin-signout";

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#f3f1ea] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-emerald-500 p-2.5 text-zinc-950">
              <Store className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Platform</p>
              <h1 className="font-[family-name:var(--font-landing-display)] text-2xl">Super Admin</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline">{session.user.email}</span>
            <Link href="/" className="text-zinc-500 hover:text-zinc-800">
              Home
            </Link>
            <SuperAdminSignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Subscription Monitoring</h2>
          <p className="text-sm text-zinc-500">Review payments, approve new shops, and manage subscriptions.</p>
        </div>
        <SuperAdminShops />
      </main>
    </div>
  );
}
