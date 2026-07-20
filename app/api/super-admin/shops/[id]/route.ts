import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/rbac";
import { approveShop, getShopById, rejectShop, suspendShop } from "@/lib/shops";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireSuperAdminApi();
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { id } = await params;
  const shop = await getShopById(id);
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  return NextResponse.json({ ...shop, _id: String(shop._id) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireSuperAdminApi();
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { id } = await params;
  const body = (await req.json()) as { action?: "approve" | "reject" | "suspend"; reason?: string };

  if (body.action === "approve") {
    const result = await approveShop(id, allowed.session.user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, shop: result.shop });
  }

  if (body.action === "reject") {
    const result = await rejectShop(id, allowed.session.user.id, body.reason);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, shop: result.shop });
  }

  if (body.action === "suspend") {
    const result = await suspendShop(id, allowed.session.user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, shop: result.shop });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
