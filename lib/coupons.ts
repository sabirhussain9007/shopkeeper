import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Coupon } from "@/models";

export async function validateCoupon(shopId: string, code: string, orderTotal: number) {
  await connectDb();
  const coupon = await Coupon.findOne(
    withShopFilter(shopId, { code: code.toUpperCase(), status: "active", deletedAt: { $exists: false } }),
  ).lean();
  if (!coupon) return { ok: false as const, error: "Invalid coupon code." };
  if (coupon.startsAt && new Date(coupon.startsAt) > new Date()) {
    return { ok: false as const, error: "Coupon is not active yet." };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { ok: false as const, error: "Coupon has expired." };
  }
  if (coupon.maxUses > 0 && (coupon.usedCount ?? 0) >= coupon.maxUses) {
    return { ok: false as const, error: "Coupon usage limit reached." };
  }
  if (orderTotal < (coupon.minOrder ?? 0)) {
    return { ok: false as const, error: `Minimum order ${coupon.minOrder} required.` };
  }
  const discount =
    coupon.type === "percentage" ? (orderTotal * coupon.value) / 100 : Math.min(coupon.value, orderTotal);
  return { ok: true as const, code: coupon.code, discount, type: coupon.type, value: coupon.value };
}

export async function markCouponUsed(shopId: string, code: string) {
  await connectDb();
  await Coupon.updateOne(withShopFilter(shopId, { code: code.toUpperCase() }), { $inc: { usedCount: 1 } });
}
