import { NextResponse, type NextRequest } from "next/server";
import { getCustomerSales } from "@/lib/sales";
import { requireApiPermission } from "@/lib/rbac";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("ledger:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { id } = await params;
  const items = await getCustomerSales(id, allowed.session.user.shopId!);
  return NextResponse.json({ items });
}
