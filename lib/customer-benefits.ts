import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Customer, CustomerGroup } from "@/models";

export async function getCustomerGroupDiscountPercent(shopId: string, customerId?: string) {
  if (!customerId) return 0;
  await connectDb();
  const customer = await Customer.findOne(withShopFilter(shopId, { _id: customerId, deletedAt: { $exists: false } })).lean();
  if (!customer?.groupId) return 0;
  const group = await CustomerGroup.findOne(
    withShopFilter(shopId, { _id: customer.groupId, status: "active", deletedAt: { $exists: false } }),
  ).lean();
  return group?.discountPercent ?? 0;
}

export function pointsDiscountAmount(points: number) {
  return Math.max(0, Math.floor(points));
}

export function pointsEarned(grandTotal: number) {
  return Math.max(0, Math.floor(grandTotal / 100));
}
