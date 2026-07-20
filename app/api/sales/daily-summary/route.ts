import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getDailySalesSummary } from "@/lib/sales";

export async function GET() {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const summary = await getDailySalesSummary(allowed.session.user.shopId!);
  return NextResponse.json(summary);
}
