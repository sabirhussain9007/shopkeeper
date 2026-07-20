import { NextResponse, type NextRequest } from "next/server";
import { createEmployee, getEmployeeStats } from "@/lib/employees";
import { requireApiPermission } from "@/lib/rbac";
import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { Employee } from "@/models";
import { employeeSchema, paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("employees:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (query.stats === "1") {
    const stats = await getEmployeeStats(shopId);
    return NextResponse.json(stats);
  }
  const params = paginationSchema.parse(query);
  const filter: Record<string, unknown> = withShopFilter(shopId, { deletedAt: { $exists: false } });
  if (params.status) filter.status = params.status;
  if (params.q) {
    filter.$or = ["fullName", "employeeId", "cnic", "phone", "email", "department", "designation"].map((field) => ({
      [field]: { $regex: params.q, $options: "i" },
    }));
  }
  if (query.department) filter.department = query.department;
  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    Employee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean(),
    Employee.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) || 1 });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("employees:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const payload = employeeSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const created = await createEmployee(allowed.session.user.shopId!, allowed.session.user.id, payload.data, {
    name: allowed.session.user.name,
    email: allowed.session.user.email,
    role: allowed.session.user.role,
  });
  return NextResponse.json(created, { status: 201 });
}
