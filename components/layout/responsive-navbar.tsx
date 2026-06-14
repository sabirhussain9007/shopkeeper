"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PackagePlus,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Permission, Role } from "@/types";

const nav: Array<{ label: string; href: string; icon: LucideIcon; permission: Permission }> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
  { label: "Inventory", href: "/inventory", icon: Boxes, permission: "inventory:write" },
  { label: "Categories", href: "/categories", icon: ClipboardList, permission: "inventory:write" },
  { label: "Customers", href: "/customers", icon: Users, permission: "ledger:write" },
  { label: "Suppliers", href: "/suppliers", icon: Building2, permission: "inventory:write" },
  { label: "POS", href: "/pos", icon: ShoppingCart, permission: "pos:write" },
  { label: "Ledger", href: "/ledger", icon: CreditCard, permission: "ledger:write" },
  { label: "Sales", href: "/sales", icon: ReceiptText, permission: "reports:read" },
  { label: "Purchases", href: "/purchases", icon: PackagePlus, permission: "inventory:write" },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
  { label: "Settings", href: "/settings", icon: Settings, permission: "settings:write" },
];

const rolePermissions: Record<Role, Permission[]> = {
  admin: ["dashboard:read", "inventory:write", "pos:write", "ledger:write", "reports:read", "settings:write", "users:write"],
  manager: ["dashboard:read", "inventory:write", "pos:write", "ledger:write", "reports:read"],
  cashier: ["pos:write", "reports:read"],
};

const navGroups = [
  { label: "Main", items: ["Dashboard", "POS"] },
  { label: "Inventory", items: ["Inventory", "Categories", "Suppliers", "Purchases"] },
  { label: "Customers", items: ["Customers", "Ledger", "Sales"] },
  { label: "Reports", items: ["Reports"] },
  { label: "Admin", items: ["Settings"] },
] as const;

type ResponsiveNavbarProps = {
  role?: Role;
  email?: string | null;
  appName?: string;
  appTagline?: string;
  logo?: string;
};

export function ResponsiveNavbar({ role, email, appName = "Shopkeeper", appTagline = "Retail Command", logo }: ResponsiveNavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);
  const links = role ? nav.filter((item) => rolePermissions[role].includes(item.permission)) : [];
  const groupedLinks = navGroups
    .map((group) => ({
      ...group,
      links: links.filter((item) => group.items.includes(item.label as never)),
    }))
    .filter((group) => group.links.length > 0);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-[#f7f4ed]/90 shadow-sm backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex items-center gap-3 py-3">
          <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <span className="rounded-2xl bg-emerald-500 p-2.5 text-zinc-950 shadow-sm shadow-emerald-500/20">
              {logo ? <span className="block h-5 w-5 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${logo})` }} /> : <Store className="h-5 w-5" />}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400">{appName}</span>
              <span className="block truncate text-base font-semibold text-zinc-950 dark:text-white">{appTagline}</span>
            </span>
          </Link>

          <div className="ml-auto hidden min-w-0 items-center justify-end gap-2 md:flex">
            {role ? (
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                {role}
              </span>
            ) : null}
            {email ? <span className="hidden max-w-64 truncate text-sm text-zinc-500 dark:text-zinc-400 lg:block">{email}</span> : null}
            {email ? (
              <Button className="shrink-0 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
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

          <Button className="ml-auto shrink-0 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:hidden" variant="ghost" size="sm" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="hidden border-t border-zinc-200/80 py-2 dark:border-zinc-800/80 md:block">
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
                      "flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500",
                      groupActive
                        ? "border-zinc-950 bg-zinc-950 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
                    )}
                    aria-expanded={dropdown === group.label}
                  >
                    {group.label}
                    <span className={cn("text-xs transition", dropdown === group.label && "rotate-180")}>▼</span>
                  </button>

                  {dropdown === group.label ? (
                    <div
                      className="absolute left-0 top-full z-50 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-950/10 dark:border-zinc-800 dark:bg-zinc-900"
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
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500",
                              isActive(item.href)
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
                            )}
                          >
                            <Icon className="h-4 w-4 text-emerald-500" />
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
      </div>

      {open ? (
        <div className="mx-4 mb-4 rounded-3xl border border-zinc-200 bg-white p-3 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900 md:hidden">
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{email ?? "Guest"}</p>
              {role ? <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{role} access</p> : null}
            </div>
          </div>
          <nav className="grid gap-2 sm:grid-cols-2">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                    isActive(item.href)
                      ? "bg-zinc-950 text-white dark:bg-emerald-500 dark:text-zinc-950"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            {email ? (
              <Button className="w-full" variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link href="/login" onClick={() => setOpen(false)}>
                  <LogIn className="h-4 w-4" />
                  Login
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
