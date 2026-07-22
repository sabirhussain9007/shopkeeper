import { NextResponse, type NextRequest } from "next/server";
import { validateCoupon } from "@/lib/coupons";
import { requireApiPermission } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { code, orderTotal } = (await req.json()) as { code?: string; orderTotal?: number };
  if (!code || orderTotal == null) {
    return NextResponse.json({ error: "Coupon code and order total are required." }, { status: 422 });
  }
  const result = await validateCoupon(allowed.session.user.shopId!, code, Number(orderTotal));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
