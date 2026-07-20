import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, refreshShopAccess } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { getRoleLandingPath } from "@/lib/access";
import { Shop } from "@/models";
import { SuperAdminSignOut } from "@/features/saas/super-admin-signout";
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
    <main className="grid min-h-screen place-items-center bg-[#f7f4ed] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Shop status</p>
        <h1 className="mt-2 font-[family-name:var(--font-landing-display)] text-3xl">{shop?.name ?? "Your shop"}</h1>
        <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
          {status}
        </p>
        <p className="mt-4 text-zinc-600">{message}</p>
        {shop?.plan && (
          <p className="mt-3 text-sm text-zinc-500">
            Plan: <span className="capitalize">{shop.plan}</span> · Rs. {shop.planAmount} · Payment: {shop.paymentMethod} ({shop.paymentReference})
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50">
            Home
          </Link>
          <SuperAdminSignOut />
        </div>
      </div>
    </main>
  );
}
