import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { getPurchaseDetail } from "@/lib/purchases";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { id } = await params;
  const data = await getPurchaseDetail(id, allowed.session.user.shopId!);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
