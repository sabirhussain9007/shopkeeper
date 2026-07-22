import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Customer, CustomerGroup } from "@/models";

export async function GET() {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const items = await Customer.find(withShopFilter(shopId, { deletedAt: { $exists: false }, status: "active" }))
    .sort({ name: 1 })
    .select("name phone creditLimit currentBalance groupId rewardPoints")
    .lean();

  const groupIds = [...new Set(items.map((c) => String(c.groupId)).filter(Boolean))];
  const groups = groupIds.length
    ? await CustomerGroup.find(withShopFilter(shopId, { _id: { $in: groupIds }, status: "active" })).select("discountPercent").lean()
    : [];
  const groupMap = new Map(groups.map((g) => [String(g._id), g.discountPercent ?? 0]));

  return NextResponse.json({
    items: items.map((c) => ({
      ...c,
      groupDiscountPercent: c.groupId ? groupMap.get(String(c.groupId)) ?? 0 : 0,
    })),
  });
}
