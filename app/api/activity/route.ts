import { NextResponse, type NextRequest } from "next/server";
import { listActivityLogs } from "@/lib/activity";
import { requireApiPermission } from "@/lib/rbac";
import { paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("activity:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  if (allowed.session.user.role !== "admin") {
    return NextResponse.json({ error: "Only the shop owner can view activity logs." }, { status: 403 });
  }
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const params = paginationSchema.parse(query);
  const data = await listActivityLogs(allowed.session.user.shopId!, {
    q: params.q,
    page: params.page,
    limit: params.limit,
    action: query.action || undefined,
    module: query.module || undefined,
    userId: query.userId || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
  });
  return NextResponse.json(data);
}
