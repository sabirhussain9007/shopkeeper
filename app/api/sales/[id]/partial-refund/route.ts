import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { processPartialRefund } from "@/lib/sales";
import { requireApiPermission } from "@/lib/rbac";

const schema = z.object({
  items: z.array(z.object({ saleItemId: z.string().min(1), quantity: z.coerce.number().positive() })).min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  const { id } = await params;
  const result = await processPartialRefund(id, allowed.session.user.id, allowed.session.user.shopId!, parsed.data.items);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ sale: result.sale, refundTotal: result.refundTotal });
}
