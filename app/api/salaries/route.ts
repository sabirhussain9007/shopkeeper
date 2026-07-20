import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { generateMonthlySalaries, getSalaryDashboard, upsertSalary } from "@/lib/salaries";
import { requireApiPermission } from "@/lib/rbac";
import { Salary } from "@/models";
import { paginationSchema, salarySchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("salaries:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (query.dashboard === "1") return NextResponse.json(await getSalaryDashboard(shopId));

  const params = paginationSchema.parse(query);
  const filter: Record<string, unknown> = { shopId: new Types.ObjectId(shopId), deletedAt: { $exists: false } };
  if (query.employee) filter.employee = new Types.ObjectId(query.employee);
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.month) filter.month = Number(query.month);
  if (query.year) filter.year = Number(query.year);

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    Salary.find(filter)
      .populate("employee", "fullName employeeId department designation")
      .sort({ year: -1, month: -1 })
      .skip(skip)
      .limit(params.limit)
      .lean(),
    Salary.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) || 1 });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("salaries:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const body = await req.json();
  if (body.generate === true) {
    const month = Number(body.month) || new Date().getMonth() + 1;
    const year = Number(body.year) || new Date().getFullYear();
    const rows = await generateMonthlySalaries(allowed.session.user.shopId!, allowed.session.user.id, month, year, {
      name: allowed.session.user.name,
      email: allowed.session.user.email,
      role: allowed.session.user.role,
    });
    return NextResponse.json({ ok: true, count: rows.length, items: rows }, { status: 201 });
  }
  const payload = salarySchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const result = await upsertSalary(allowed.session.user.shopId!, allowed.session.user.id, payload.data, {
    name: allowed.session.user.name,
    email: allowed.session.user.email,
    role: allowed.session.user.role,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: 201 });
}
