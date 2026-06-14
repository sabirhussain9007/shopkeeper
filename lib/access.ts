import type { Role } from "@/types";

export function getRoleLandingPath(role: Role | undefined) {
  if (role === "cashier") return "/pos";
  return "/dashboard";
}
