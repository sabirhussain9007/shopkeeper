import { NextResponse, type NextRequest } from "next/server";
import { getAccountingSummary } from "@/lib/accounting";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { AccountingEntry } from "@/models";
import { accountingEntrySchema, paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const params = paginationSchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const book = req.nextUrl.searchParams.get("book");
  const filter: Record<string, unknown> = withShopFilter(shopId, { deletedAt: { $exists: false } });
  if (book) filter.book = book;
  const skip = (params.page - 1) * params.limit;
  const [items, total, summary] = await Promise.all([
    AccountingEntry.find(filter).sort({ entryDate: -1 }).skip(skip).limit(params.limit).lean(),
    AccountingEntry.countDocuments(filter),
    getAccountingSummary(shopId),
  ]);
  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit), summary });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const parsed = accountingEntrySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const created = await AccountingEntry.create({
    ...parsed.data,
    shopId: allowed.session.user.shopId,
    createdBy: allowed.session.user.id,
  });
  return NextResponse.json(created, { status: 201 });
}
