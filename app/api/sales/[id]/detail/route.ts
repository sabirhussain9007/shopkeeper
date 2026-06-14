import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getSaleDetail } from "@/lib/sales";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { id } = await params;
  const data = await getSaleDetail(id);
  if (!data) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  return NextResponse.json(data);
}
