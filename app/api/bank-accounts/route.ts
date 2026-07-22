import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { connectDb } from "@/lib/db";
import { requireAnyApiPermission, requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { BankAccount } from "@/models";
import { bankAccountSchema, paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireAnyApiPermission("reports:read", "inventory:write", "pos:write", "ledger:write", "expenses:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const params = paginationSchema.parse(query);
  const filter: Record<string, unknown> = withShopFilter(shopId, { deletedAt: { $exists: false } });
  if (params.status) filter.status = params.status;
  const accountType = req.nextUrl.searchParams.get("accountType");
  if (accountType && accountType === "bank") {
    if (accountType === "bank") {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        { $or: [{ accountType: "bank" }, { accountType: { $exists: false } }] },
      ];
    } else {
      filter.accountType = accountType;
    }
  }
  if (query.q) {
    filter.$or = ["name", "accountTitle", "accountNumber", "branch", "iban"].map((field) => ({
      [field]: { $regex: params.q, $options: "i" },
    }));
  }
  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    BankAccount.find(filter).sort({ name: 1 }).skip(skip).limit(params.limit).lean(),
    BankAccount.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) || 1 });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("settings:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const payload = bankAccountSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const shopId = allowed.session.user.shopId!;
  const exists = await BankAccount.exists(withShopFilter(shopId, { name: payload.data.name, deletedAt: { $exists: false } }));
  if (exists) {
    return NextResponse.json({ error: "A bank account with this name already exists." }, { status: 409 });
  }
  const created = await BankAccount.create({
    ...payload.data,
    shopId,
    createdBy: allowed.session.user.id,
  });
  await logActivity({
    shopId,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "bank_account.created",
    entity: "bank_account",
    entityId: String(created._id),
    description: `Bank account added: ${created.name}`,
    req,
  });
  return NextResponse.json(created, { status: 201 });
}
