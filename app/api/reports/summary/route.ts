import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getDashboardSummary } from "@/lib/summary";

export async function GET() {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const summary = await getDashboardSummary();
  return NextResponse.json(summary);
}
