import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { deleteSpotPurchase, updateSpotPurchase } from "@/lib/purchases";
import { purchaseSchema } from "@/schemas/domain";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = purchaseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { id } = await params;
  const result = await updateSpotPurchase(id, parsed.data, allowed.session.user.id, allowed.session.user.shopId!);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: "status" in result ? result.status : 400 });
  }
  return NextResponse.json(result.purchase);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const { id } = await params;
  const result = await deleteSpotPurchase(id, allowed.session.user.id, allowed.session.user.shopId!);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: "status" in result ? result.status : 400 });
  }
  return NextResponse.json({ ok: true });
}
