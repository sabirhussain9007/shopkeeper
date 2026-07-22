import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { createSpotPurchase, listPurchases } from "@/lib/purchases";
import { purchaseSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const page = Number(req.nextUrl.searchParams.get("page") ?? 1);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const data = await listPurchases(page, limit, allowed.session.user.shopId!, "spot");
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = purchaseSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const result = await createSpotPurchase(parsed.data, allowed.session.user.id, allowed.session.user.shopId!);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result.purchase, { status: 201 });
}
