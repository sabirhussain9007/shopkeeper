import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, refreshShopAccess } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { getRoleLandingPath } from "@/lib/access";
import { Shop } from "@/models";
import { SuperAdminSignOut } from "@/features/saas/super-admin-signout";
import { RenewShopForm } from "@/features/shop/renew-shop-form";
import { PageBackground } from "@/components/layout/page-background";
import type { Role } from "@/types";

export default async function ShopStatusPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role === "super_admin") redirect("/super-admin");
  if (!session.user.shopId) redirect("/login");

  const active = await refreshShopAccess(session.user.shopId);
  if (active) redirect(getRoleLandingPath(session.user.role as Role));

  await connectDb();
  const shop = await Shop.findById(session.user.shopId).lean();

  const status = shop?.status ?? "unknown";
  const message =
    status === "pending"
      ? "Your payment is awaiting verification by the platform administrator. You will get full access once approved."
      : status === "expired"
        ? "Your subscription has expired. Create a new payment or contact the platform admin to renew."
        : status === "suspended"
          ? "This shop has been suspended. Please contact the platform administrator."
          : status === "rejected"
            ? shop?.rejectionReason || "Your shop registration was rejected."
            : "This shop is not currently available.";

  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-10">
      <PageBackground />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f2420]/95 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
        <div className="border-b border-white/10 px-8 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Shop status</p>
          <h1 className="mt-2 font-[family-name:var(--font-landing-display)] text-3xl text-white">{shop?.name ?? "Your shop"}</h1>
        </div>
        <div className="space-y-4 bg-[var(--panel)] p-8 text-zinc-950">
          <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            {status}
          </p>
          <p className="text-zinc-600">{message}</p>
          {shop?.plan && (
            <p className="text-sm text-zinc-500">
              Plan: <span className="capitalize">{shop.plan}</span> · Rs. {shop.planAmount} · Payment: {shop.paymentMethod} ({shop.paymentReference})
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/" className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50">
              Home
            </Link>
            <SuperAdminSignOut className="border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950" />
          </div>
          {status === "expired" || status === "pending" ? (
            <RenewShopForm defaultPlan={shop?.plan as "monthly" | "yearly" | undefined} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
