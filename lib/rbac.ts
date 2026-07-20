import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getRoleLandingPath } from "@/lib/access";
import { authOptions } from "@/lib/auth";
import { getRolePermissionsForShop } from "@/lib/settings";
import { type Permission, rolePermissions, type Role } from "@/types";

export function can(role: Role | undefined, permission: Permission) {
  if (!role) return false;
  return rolePermissions[role].includes(permission);
}

export async function hasPermission(role: Role | undefined, permission: Permission, shopId?: string | null) {
  if (!role) return false;
  if (role === "super_admin") return rolePermissions.super_admin.includes(permission);
  if (role === "admin") return rolePermissions.admin.includes(permission);
  if (role === "manager" || role === "cashier") {
    const perms = await getRolePermissionsForShop(role, shopId);
    return perms.includes(permission);
  }
  return can(role, permission);
}

export async function requirePermission(permission: Permission) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as Role | undefined;
  if (!session?.user) {
    redirect("/login");
  }
  if (role === "super_admin" && permission !== "shops:manage") {
    redirect("/super-admin");
  }
  const allowed = await hasPermission(role, permission, session.user.shopId);
  if (!allowed) redirect(getRoleLandingPath(role));
  return session;
}

export async function requireApiPermission(permission: Permission) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as Role | undefined;
  if (!session?.user) {
    return { ok: false as const, status: 403, error: "You do not have permission to perform this action." };
  }
  const allowed = await hasPermission(role, permission, session.user.shopId);
  if (!allowed) {
    return { ok: false as const, status: 403, error: "You do not have permission to perform this action." };
  }
  if (role !== "super_admin" && !session.user.shopId && permission !== "shops:manage") {
    return { ok: false as const, status: 403, error: "No shop is linked to this account." };
  }
  return { ok: true as const, session };
}

export async function requireSuperAdminApi() {
  return requireApiPermission("shops:manage");
}
