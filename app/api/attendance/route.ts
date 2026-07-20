import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { getAttendanceDashboard, upsertAttendance } from "@/lib/attendance";
import { connectDb } from "@/lib/db";
import { requireApiPermission } from "@/lib/rbac";
import { Attendance } from "@/models";
import { attendanceSchema, paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("attendance:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (query.dashboard === "1") {
    return NextResponse.json(await getAttendanceDashboard(shopId));
  }

  const params = paginationSchema.parse(query);
  const filter: Record<string, unknown> = {
    shopId: new Types.ObjectId(shopId),
    deletedAt: { $exists: false },
  };
  if (query.employee) filter.employee = new Types.ObjectId(query.employee);
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) (filter.date as Record<string, Date>).$gte = new Date(query.from);
    if (query.to) (filter.date as Record<string, Date>).$lte = new Date(query.to);
  }

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    Attendance.find(filter)
      .populate("employee", "fullName employeeId department designation")
      .sort({ date: -1 })
      .skip(skip)
      .limit(params.limit)
      .lean(),
    Attendance.countDocuments(filter),
  ]);
  return NextResponse.json({ items, total, page: params.page, pages: Math.ceil(total / params.limit) || 1 });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("attendance:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const payload = attendanceSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
  }
  const result = await upsertAttendance(allowed.session.user.shopId!, allowed.session.user.id, payload.data, {
    name: allowed.session.user.name,
    email: allowed.session.user.email,
    role: allowed.session.user.role,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: 201 });
}
