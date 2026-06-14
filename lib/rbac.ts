import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getRoleLandingPath } from "@/lib/access";
import { authOptions } from "@/lib/auth";
import { type Permission, rolePermissions, type Role } from "@/types";

export function can(role: Role | undefined, permission: Permission) {
  if (!role) return false;
  return rolePermissions[role].includes(permission);
}

export async function requirePermission(permission: Permission) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as Role | undefined;
  if (!session?.user) {
    redirect("/login");
  }
  if (!can(role, permission)) redirect(getRoleLandingPath(role));
  return session;
}

export async function requireApiPermission(permission: Permission) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role as Role | undefined;
  if (!session?.user || !can(role, permission)) {
    return { ok: false as const, status: 403, error: "You do not have permission to perform this action." };
  }
  return { ok: true as const, session };
}
