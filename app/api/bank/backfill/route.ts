import { NextResponse, type NextRequest } from "next/server";
import { backfillBankTransactions } from "@/lib/bank-backfill";
import { requireApiPermission } from "@/lib/rbac";

export async function POST(_: NextRequest) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const stats = await backfillBankTransactions(allowed.session.user.shopId!, allowed.session.user.id);
  return NextResponse.json({ ok: true, stats });
}
