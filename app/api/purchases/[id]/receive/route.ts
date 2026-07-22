import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { receivePurchase } from "@/lib/purchases";
import { purchaseReceiveSchema } from "@/schemas/domain";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    const result = await receivePurchase(id, allowed.session.user.id, allowed.session.user.shopId!);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ purchase: result.purchase });
  }

  const parsed = purchaseReceiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid receive payload." }, { status: 422 });
  }

  const result = await receivePurchase(id, allowed.session.user.id, allowed.session.user.shopId!, {
    items: parsed.data.items,
    paidAmount: parsed.data.paidAmount,
    paymentMethod: parsed.data.paymentMethod,
    chequeNumber: parsed.data.chequeNumber,
    chequeDate: parsed.data.chequeDate,
    bankName: parsed.data.bankName,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ purchase: result.purchase });
}
