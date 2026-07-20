import type { Role } from "@/types";

export function getRoleLandingPath(role: Role | undefined) {
  if (role === "super_admin") return "/super-admin";
  if (role === "cashier") return "/pos";
  return "/dashboard";
}
