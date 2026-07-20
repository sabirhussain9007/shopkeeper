"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  CalendarCheck2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PackagePlus,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/saas/notification-center";
import { SubscriptionExpiryBadge } from "@/components/saas/subscription-expiry";
import { cn } from "@/lib/utils";
import type { NavRouteId } from "@/lib/nav-access";
import type { Role } from "@/types";

const iconByRoute: Record<NavRouteId, LucideIcon> = {
  dashboard: LayoutDashboard,
  inventory: Boxes,
  categories: ClipboardList,
  customers: Users,
  suppliers: Building2,
  pos: ShoppingCart,
  ledger: CreditCard,
  sales: ReceiptText,
  purchases: PackagePlus,
  employees: Users,
  attendance: CalendarCheck2,
  salaries: Banknote,
  expenses: Wallet,
  activity: ScrollText,
  reports: BarChart3,
  settings: Settings,
};

const navMeta: Array<{ id: NavRouteId; label: string; href: string }> = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "inventory", label: "Inventory", href: "/inventory" },
  { id: "categories", label: "Categories", href: "/categories" },
  { id: "customers", label: "Customers", href: "/customers" },
  { id: "suppliers", label: "Suppliers", href: "/suppliers" },
  { id: "pos", label: "POS", href: "/pos" },
  { id: "ledger", label: "Ledger", href: "/ledger" },
  { id: "sales", label: "Sales", href: "/sales" },
  { id: "purchases", label: "Purchases", href: "/purchases" },
  { id: "employees", label: "Employees", href: "/employees" },
  { id: "attendance", label: "Attendance", href: "/attendance" },
  { id: "salaries", label: "Salaries", href: "/salaries" },
  { id: "expenses", label: "Expenses", href: "/expenses" },
  { id: "activity", label: "Activity Logs", href: "/activity" },
  { id: "reports", label: "Reports", href: "/reports" },
  { id: "settings", label: "Settings", href: "/settings" },
];

const navGroups = [
  { label: "Main", items: ["Dashboard", "POS"] },
  { label: "Inventory", items: ["Inventory", "Categories", "Suppliers", "Purchases"] },
  { label: "Customers", items: ["Customers", "Ledger", "Sales"] },
  { label: "HR", items: ["Employees", "Attendance", "Salaries"] },
  { label: "Finance", items: ["Expenses"] },
  { label: "Reports", items: ["Reports"] },
  { label: "Admin", items: ["Activity Logs", "Settings"] },
] as const;

const adminRoutes: NavRouteId[] = [
  "dashboard",
  "inventory",
  "categories",
  "customers",
  "suppliers",
  "pos",
  "ledger",
  "sales",
  "purchases",
  "employees",
  "attendance",
  "salaries",
  "expenses",
  "activity",
  "reports",
  "settings",
];

type ResponsiveNavbarProps = {
  role?: Role;
  email?: string | null;
  appName?: string;
  appTagline?: string;
  logo?: string;
  allowedRoutes?: NavRouteId[];
  remainingDays?: number;
};

export function ResponsiveNavbar({
  role,
  email,
  appName = "Shopkeeper",
  appTagline = "Retail Command",
  logo,
  allowedRoutes,
  remainingDays,
}: ResponsiveNavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);

  const routes =
    role === "admin"
      ? adminRoutes
      : allowedRoutes && allowedRoutes.length > 0
        ? allowedRoutes
        : role === "cashier"
          ? (["pos", "sales"] as NavRouteId[])
          : role === "manager"
            ? (adminRoutes.filter((id) => id !== "settings" && id !== "activity") as NavRouteId[])
            : [];

  const links = navMeta
    .filter((item) => routes.includes(item.id))
    .map((item) => ({ ...item, icon: iconByRoute[item.id] }));

  const groupedLinks = navGroups
    .map((group) => ({
      ...group,
      links: links.filter((item) => group.items.includes(item.label as never)),
    }))
    .filter((group) => group.links.length > 0);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAgent: navigator.userAgent }),
      });
    } catch {
      // Proceed with sign-out even if logout logging fails.
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f2420]/95 shadow-lg shadow-emerald-950/30 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-center gap-3 py-3">
          <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-400">
            <span className="rounded-2xl bg-emerald-400 p-2.5 text-[#0c1f1a] shadow-sm shadow-emerald-900/30">
              {logo ? <span className="block h-5 w-5 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${logo})` }} /> : <Store className="h-5 w-5" />}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">{appName}</span>
              <span className="block truncate text-base font-semibold text-white">{appTagline}</span>
            </span>
          </Link>

          <div className="ml-auto hidden min-w-0 items-center justify-end gap-2 md:flex">
            {typeof remainingDays === "number" && remainingDays <= 3 ? (
              <SubscriptionExpiryBadge remainingDays={remainingDays} variant="badge" />
            ) : null}
            <NotificationCenter />
            {role ? (
              <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                {role}
              </span>
            ) : null}
            {email ? <span className="hidden max-w-64 truncate text-sm text-emerald-50/60 lg:block">{email}</span> : null}
            {email ? (
              <Button
                className="shrink-0 border border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10 hover:text-white"
                variant="ghost"
                size="sm"
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            ) : (
              <Button asChild className="shrink-0" size="sm">
                <Link href="/login">
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
              </Button>
            )}
          </div>

          <Button
            className="ml-auto shrink-0 border border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10 hover:text-white md:hidden"
            variant="ghost"
            size="sm"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="hidden border-t border-white/10 py-2 md:block">
          <div className="flex flex-wrap gap-2">
            {groupedLinks.map((group) => {
              const groupActive = group.links.some((item) => isActive(item.href));
              return (
                <div key={group.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdown((current) => (current === group.label ? null : group.label))}
                    onBlur={(event) => {
                      if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setDropdown(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400",
                      groupActive
                        ? "border-emerald-400 bg-emerald-400 text-[#0c1f1a]"
                        : "border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10 hover:text-white",
                    )}
                    aria-expanded={dropdown === group.label}
                  >
                    {group.label}
                    <span className={cn("text-xs transition", dropdown === group.label && "rotate-180")}>▼</span>
                  </button>

                  {dropdown === group.label ? (
                    <div
                      className="absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl border border-zinc-200 bg-[var(--panel)] p-2 shadow-xl shadow-emerald-950/20"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      {group.links.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setDropdown(null)}
                            className={cn(
                              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                              isActive(item.href)
                                ? "bg-emerald-400 text-[#0c1f1a]"
                                : "text-zinc-700 hover:bg-white hover:text-zinc-950",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>

        {open ? (
          <nav className="space-y-4 border-t border-white/10 py-4 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <NotificationCenter />
              {typeof remainingDays === "number" && remainingDays <= 3 ? (
                <SubscriptionExpiryBadge remainingDays={remainingDays} variant="badge" />
              ) : null}
            </div>
            {groupedLinks.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-wider text-emerald-300/80">{group.label}</p>
                {group.links.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium",
                        isActive(item.href) ? "bg-emerald-400 text-[#0c1f1a]" : "text-emerald-50 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
            {email ? (
              <Button className="w-full border border-white/15 bg-white/5 text-emerald-50 hover:bg-white/10" variant="ghost" onClick={() => void handleLogout()}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
