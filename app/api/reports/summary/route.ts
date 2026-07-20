import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getDashboardSummary } from "@/lib/summary";

export async function GET() {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const summary = await getDashboardSummary(allowed.session.user.shopId!);
  return NextResponse.json(summary);
}
