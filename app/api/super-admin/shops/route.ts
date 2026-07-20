import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/rbac";
import { getSubscriptionMonitorStats, listShops } from "@/lib/shops";

export async function GET(req: NextRequest) {
  const allowed = await requireSuperAdminApi();
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  if (req.nextUrl.searchParams.get("stats") === "1") {
    return NextResponse.json(await getSubscriptionMonitorStats());
  }

  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const expiryFilter = req.nextUrl.searchParams.get("expiryFilter") as
    | "expired"
    | "today"
    | "1"
    | "2"
    | "3"
    | "active"
    | "expiring_3"
    | undefined;
  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const data = await listShops({ q, status: status || undefined, page, limit, expiryFilter: expiryFilter || undefined });
  return NextResponse.json(data);
}
