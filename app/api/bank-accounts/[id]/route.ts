import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { BankAccount } from "@/models";
import { bankAccountBaseSchema, bankAccountSchema } from "@/schemas/domain";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const item = await BankAccount.findOne(withShopFilter(allowed.session.user.shopId!, { _id: id, deletedAt: { $exists: false } })).lean();
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("settings:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const payload = bankAccountBaseSchema.partial().safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const { id } = await params;
  const shopId = allowed.session.user.shopId!;
  const existing = await BankAccount.findOne(withShopFilter(shopId, { _id: id, deletedAt: { $exists: false } }));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const merged = {
    accountType: (payload.data.accountType ?? existing.accountType ?? "bank") as "bank" | "easypaisa" | "jazzcash",
    name: payload.data.name ?? existing.name,
    accountTitle: payload.data.accountTitle ?? existing.accountTitle,
    accountNumber: payload.data.accountNumber ?? existing.accountNumber,
    branch: payload.data.branch ?? existing.branch ?? "",
    iban: payload.data.iban ?? existing.iban ?? "",
    notes: payload.data.notes ?? existing.notes ?? "",
    status: payload.data.status ?? existing.status,
  };
  const validated = bankAccountSchema.safeParse(merged);
  if (!validated.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: validated.error.flatten().fieldErrors }, { status: 422 });
  }
  if (validated.data.name !== existing.name) {
    const duplicate = await BankAccount.exists(withShopFilter(shopId, { name: validated.data.name, deletedAt: { $exists: false }, _id: { $ne: id } }));
    if (duplicate) return NextResponse.json({ error: "A bank account with this name already exists." }, { status: 409 });
  }
  Object.assign(existing, validated.data, { updatedBy: allowed.session.user.id });
  await existing.save();
  await logActivity({
    shopId,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "bank_account.updated",
    entity: "bank_account",
    entityId: id,
    description: `Bank account updated: ${existing.name}`,
    req,
  });
  return NextResponse.json(existing);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const allowed = await requireApiPermission("settings:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const { id } = await params;
  const shopId = allowed.session.user.shopId!;
  const deleted = await BankAccount.findOneAndUpdate(
    withShopFilter(shopId, { _id: id, deletedAt: { $exists: false } }),
    { $set: { deletedAt: new Date(), deletedBy: allowed.session.user.id } },
    { new: true },
  );
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logActivity({
    shopId,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "bank_account.deleted",
    entity: "bank_account",
    entityId: id,
    description: `Bank account removed: ${deleted.name}`,
    req,
  });
  return NextResponse.json({ ok: true });
}
