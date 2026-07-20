import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Customer } from "@/models";

export async function GET() {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  await connectDb();
  const items = await Customer.find(withShopFilter(allowed.session.user.shopId, { deletedAt: { $exists: false }, status: "active" }))
    .sort({ name: 1 })
    .select("name phone creditLimit currentBalance")
    .lean();

  return NextResponse.json({ items });
}
