import { Expense } from "@/models";
import { expenseSchema, paginationSchema } from "@/schemas/domain";
import { NextResponse, type NextRequest } from "next/server";
import { getExpenseDashboard } from "@/lib/expenses";
import { requireApiPermission } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("expenses:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  if (req.nextUrl.searchParams.get("dashboard") === "1") {
    return NextResponse.json(await getExpenseDashboard(allowed.session.user.shopId!));
  }
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const params = paginationSchema.parse(query);
  const filter: Record<string, unknown> = withShopFilter(shopId, { deletedAt: { $exists: false } });
  if (params.status) filter.status = params.status;
  if (query.category) filter.category = query.category;
  if (params.q) {
    filter.$or = ["title", "category", "reference", "notes"].map((field) => ({
      [field]: { $regex: params.q, $options: "i" },
    }));
  }
  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    Expense.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean(),
    Expense.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) || 1 });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("expenses:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const payload = expenseSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const created = await Expense.create({
    ...payload.data,
    shopId: allowed.session.user.shopId,
    createdBy: allowed.session.user.id,
  });
  await logActivity({
    shopId: allowed.session.user.shopId,
    userId: allowed.session.user.id,
    userName: allowed.session.user.name,
    userEmail: allowed.session.user.email,
    userRole: allowed.session.user.role,
    action: "expense.created",
    entity: "expense",
    entityId: String(created._id),
    description: `Expense added: ${created.title} (${created.category}) — Rs. ${created.amount}`,
  });
  return NextResponse.json(created, { status: 201 });
}
