import { NextResponse, type NextRequest } from "next/server";
import { buyStockFromVendor } from "@/lib/purchases";
import { requireApiPermission } from "@/lib/rbac";
import { buyStockSchema } from "@/schemas/domain";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const { id: productId } = await context.params;
  const parsed = buyStockSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const result = await buyStockFromVendor(
    productId,
    {
      vendorId: parsed.data.vendorId,
      quantity: parsed.data.quantity,
      unitCost: parsed.data.unitCost,
      paidAmount: parsed.data.paidAmount,
      notes: parsed.data.notes,
    },
    allowed.session.user.id,
    allowed.session.user.shopId!,
  );

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
