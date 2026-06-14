import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getLedgerOverview } from "@/lib/ledger";

export async function GET() {
  const allowed = await requireApiPermission("ledger:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const data = await getLedgerOverview();
  return NextResponse.json(data);
}
