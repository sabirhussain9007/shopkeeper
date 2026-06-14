import { NextResponse, type NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/rbac";
import { recordAdjustment, recordPayment } from "@/lib/ledger";

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("ledger:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const body = (await req.json()) as {
    customerId?: string;
    amount?: number;
    description?: string;
    action?: "payment" | "adjustment";
    direction?: "increase" | "decrease";
  };

  if (!body.customerId || !body.amount || !body.description) {
    return NextResponse.json({ error: "customerId, amount, and description are required." }, { status: 422 });
  }

  const result =
    body.action === "adjustment"
      ? await recordAdjustment(body.customerId, body.amount, body.direction ?? "decrease", body.description, allowed.session.user.id)
      : await recordPayment(body.customerId, body.amount, body.description, allowed.session.user.id);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
