import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { generateReport } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const type = req.nextUrl.searchParams.get("type") ?? "sales";
  const now = new Date();
  const start = req.nextUrl.searchParams.get("start") ? new Date(req.nextUrl.searchParams.get("start")!) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = req.nextUrl.searchParams.get("end") ? new Date(req.nextUrl.searchParams.get("end")!) : now;

  const report = await generateReport(type, start, end, allowed.session.user.shopId!);
  if (!report) return NextResponse.json({ error: "Invalid report type" }, { status: 400 });

  return NextResponse.json({ ...report, range: { start, end } });
}
