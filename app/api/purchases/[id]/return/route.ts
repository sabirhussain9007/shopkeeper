import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { returnPurchase } from "@/lib/purchases";
import { requireApiPermission } from "@/lib/rbac";

const schema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid product id"),
        quantity: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 422 });
  }
  const { id } = await params;
  const result = await returnPurchase(id, allowed.session.user.id, allowed.session.user.shopId!, parsed.data.items);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ returnTotal: result.returnTotal, fullyReturned: result.fullyReturned });
}
