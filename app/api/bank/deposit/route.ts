import { NextResponse, type NextRequest } from "next/server";
import { recordBankDeposit } from "@/lib/accounting-sync";
import { formatPakistanDateInput, resolvePakistanEntryDate } from "@/lib/datetime";
import { requireApiPermission } from "@/lib/rbac";
import { bankDepositSchema } from "@/schemas/domain";

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = bankDepositSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid deposit payload." }, { status: 422 });
  }

  const body = parsed.data;
  const entryDate = resolvePakistanEntryDate(formatPakistanDateInput(body.entryDate ?? new Date()));
  const description =
    body.description?.trim() ||
    `${body.depositType === "cash" ? "Cash" : "Cheque"} deposit to ${body.bankName.trim()}`;

  const depositId = await recordBankDeposit(allowed.session.user.shopId!, allowed.session.user.id, {
    depositType: body.depositType,
    amount: body.amount,
    bankName: body.bankName.trim(),
    reference: body.reference?.trim(),
    description,
    chequeDate: body.depositType === "cheque" ? body.chequeDate ?? null : null,
    entryDate,
  });

  return NextResponse.json({ ok: true, depositId }, { status: 201 });
}
