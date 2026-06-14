import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getCustomerLedger } from "@/lib/ledger";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("ledger:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { id } = await params;
  const data = await getCustomerLedger(id);
  if (!data) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  return NextResponse.json(data);
}
