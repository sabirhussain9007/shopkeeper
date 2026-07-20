import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ResponsiveNavbar } from "@/components/layout/responsive-navbar";
import { SubscriptionExpiryBadge, SubscriptionExpiryPopup } from "@/components/saas/subscription-expiry";
import { authOptions, refreshShopAccess } from "@/lib/auth";
import { getRemainingDays, SHOP_PLANS, type ShopPlanId } from "@/lib/saas";
import { getActiveSettings, getRoleNavRoutes } from "@/lib/settings";
import { getShopById } from "@/lib/shops";
import type { Role, ShopRole } from "@/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "super_admin") redirect("/super-admin");
  if (!session.user.shopId) redirect("/login");

  const active = await refreshShopAccess(session.user.shopId);
  if (!active) redirect("/shop-status");

  const [settings, shop] = await Promise.all([
    getActiveSettings(session.user.shopId),
    getShopById(session.user.shopId),
  ]);
  const role = session.user.role as Role;
  const allowedRoutes =
    role === "admin" || role === "manager" || role === "cashier"
      ? await getRoleNavRoutes(role as ShopRole, session.user.shopId)
      : [];

  const remainingDays = getRemainingDays(shop?.expiresAt);
  const planLabel = shop?.plan ? SHOP_PLANS[shop.plan as ShopPlanId]?.label : undefined;

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ResponsiveNavbar
        role={role}
        email={session.user.email}
        appName={settings.appName}
        appTagline={settings.appTagline}
        logo={settings.logo ?? undefined}
        allowedRoutes={allowedRoutes}
        remainingDays={remainingDays}
      />
      <main className="mx-auto min-w-0 max-w-7xl p-4 md:p-8">
        {remainingDays <= 3 ? (
          <SubscriptionExpiryBadge
            remainingDays={remainingDays}
            planLabel={planLabel}
            expiresAt={shop?.expiresAt ? new Date(shop.expiresAt).toISOString() : null}
            variant="banner"
          />
        ) : null}
        <header className="mb-6 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Signed in as {session.user.email}</p>
              <h1 className="text-2xl font-semibold">{settings.dashboardTitle}</h1>
            </div>
            {remainingDays <= 7 ? (
              <SubscriptionExpiryBadge remainingDays={remainingDays} planLabel={planLabel} variant="badge" />
            ) : null}
          </div>
        </header>
        {remainingDays <= 3 ? (
          <div className="mb-6">
            <SubscriptionExpiryBadge
              remainingDays={remainingDays}
              planLabel={planLabel}
              expiresAt={shop?.expiresAt ? new Date(shop.expiresAt).toISOString() : null}
              variant="card"
            />
          </div>
        ) : null}
        {children}
      </main>
      {remainingDays <= 3 ? <SubscriptionExpiryPopup remainingDays={remainingDays} planLabel={planLabel} /> : null}
    </div>
  );
}
