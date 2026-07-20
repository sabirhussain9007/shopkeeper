import { Types } from "mongoose";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { isShopAccessAllowed } from "@/lib/saas";
import { Shop } from "@/models";
import type { Role } from "@/types";

export function shopObjectId(shopId: string | null | undefined) {
  if (!shopId) return null;
  return new Types.ObjectId(shopId);
}

export function withShopFilter(shopId: string | null | undefined, extra: Record<string, unknown> = {}) {
  if (!shopId) return { ...extra, shopId: { $exists: false } };
  return { ...extra, shopId: new Types.ObjectId(shopId) };
}

export async function requireShopSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.role === "super_admin") redirect("/super-admin");
  if (!session.user.shopId) redirect("/login");
  return session;
}

export async function requireActiveShopSession() {
  const session = await requireShopSession();
  await connectDb();
  const shop = await Shop.findById(session.user.shopId).lean();
  if (!shop) redirect("/shop-status");
  if (!isShopAccessAllowed(shop)) redirect("/shop-status");
  return { session, shop };
}

export function getSessionShopId(session: Session | null | undefined) {
  return session?.user?.shopId ?? null;
}

export function isSuperAdmin(role: Role | undefined) {
  return role === "super_admin";
}
