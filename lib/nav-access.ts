import type { Permission } from "@/types";

export const navRouteIds = [
  "dashboard",
  "inventory",
  "categories",
  "brands",
  "warehouses",
  "customers",
  "customer-groups",
  "vendors",
  "pos",
  "coupons",
  "ledger",
  "sales",
  "purchases",
  "spot-purchases",
  "employees",
  "attendance",
  "salaries",
  "expenses",
  "accounting",
  "bank",
  "activity",
  "login-history",
  "reports",
  "settings",
] as const;

export type NavRouteId = (typeof navRouteIds)[number];

export type NavRouteDef = {
  id: NavRouteId;
  label: string;
  href: string;
  permission: Permission;
  group: "Main" | "Inventory" | "Customers" | "HR" | "Finance" | "Reports" | "Admin";
};

export const NAV_ROUTES: NavRouteDef[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", permission: "dashboard:read", group: "Main" },
  { id: "pos", label: "POS", href: "/pos", permission: "pos:write", group: "Main" },
  { id: "inventory", label: "Inventory", href: "/inventory", permission: "inventory:write", group: "Inventory" },
  { id: "categories", label: "Categories", href: "/categories", permission: "inventory:write", group: "Inventory" },
  { id: "brands", label: "Brands", href: "/brands", permission: "inventory:write", group: "Inventory" },
  { id: "warehouses", label: "Warehouses", href: "/warehouses", permission: "inventory:write", group: "Inventory" },
  { id: "vendors", label: "Vendors", href: "/vendors", permission: "inventory:write", group: "Inventory" },
  { id: "purchases", label: "Purchases", href: "/purchases", permission: "inventory:write", group: "Inventory" },
  { id: "spot-purchases", label: "Spot Purchases", href: "/spot-purchases", permission: "inventory:write", group: "Inventory" },
  { id: "customers", label: "Customers", href: "/customers", permission: "ledger:write", group: "Customers" },
  { id: "customer-groups", label: "Customer Groups", href: "/customer-groups", permission: "ledger:write", group: "Customers" },
  { id: "coupons", label: "Coupons", href: "/coupons", permission: "pos:write", group: "Customers" },
  { id: "ledger", label: "Ledger", href: "/ledger", permission: "ledger:write", group: "Customers" },
  { id: "sales", label: "Sales", href: "/sales", permission: "reports:read", group: "Customers" },
  { id: "employees", label: "Employees", href: "/employees", permission: "employees:write", group: "HR" },
  { id: "attendance", label: "Attendance", href: "/attendance", permission: "attendance:write", group: "HR" },
  { id: "salaries", label: "Salaries", href: "/salaries", permission: "salaries:write", group: "HR" },
  { id: "expenses", label: "Expenses", href: "/expenses", permission: "expenses:write", group: "Finance" },
  { id: "accounting", label: "Accounting", href: "/accounting", permission: "reports:read", group: "Finance" },
  { id: "bank", label: "Bank", href: "/bank", permission: "reports:read", group: "Finance" },
  { id: "activity", label: "Activity Logs", href: "/activity", permission: "activity:read", group: "Admin" },
  { id: "login-history", label: "Login History", href: "/login-history", permission: "activity:read", group: "Admin" },
  { id: "reports", label: "Reports", href: "/reports", permission: "reports:read", group: "Reports" },
  { id: "settings", label: "Settings", href: "/settings", permission: "settings:write", group: "Admin" },
];

export const DEFAULT_MANAGER_ROUTES: NavRouteId[] = [
  "dashboard",
  "inventory",
  "categories",
  "brands",
  "warehouses",
  "customers",
  "customer-groups",
  "coupons",
  "vendors",
  "pos",
  "ledger",
  "sales",
  "purchases",
  "spot-purchases",
  "employees",
  "attendance",
  "salaries",
  "expenses",
  "accounting",
  "bank",
  "activity",
  "reports",
];

export const DEFAULT_CASHIER_ROUTES: NavRouteId[] = ["pos", "sales"];

export function isNavRouteId(value: string): value is NavRouteId {
  return (navRouteIds as readonly string[]).includes(value);
}

export function sanitizeNavRoutes(routes: unknown, fallback: NavRouteId[]): NavRouteId[] {
  if (!Array.isArray(routes)) return [...fallback];
  const cleaned = routes
    .map((item) => (item === "suppliers" ? "vendors" : item))
    .filter((item): item is NavRouteId => typeof item === "string" && isNavRouteId(item));
  return cleaned.length > 0 ? Array.from(new Set(cleaned)) : [...fallback];
}

export function permissionsFromRoutes(routes: NavRouteId[]): Permission[] {
  const set = new Set<Permission>();
  for (const route of NAV_ROUTES) {
    if (routes.includes(route.id)) set.add(route.permission);
  }
  return Array.from(set);
}

export function getDefaultRoutesForRole(role: "manager" | "cashier"): NavRouteId[] {
  return role === "manager" ? [...DEFAULT_MANAGER_ROUTES] : [...DEFAULT_CASHIER_ROUTES];
}
