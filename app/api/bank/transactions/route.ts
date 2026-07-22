import { NextResponse, type NextRequest } from "next/server";
import { getBankTransactions } from "@/lib/bank";
import { requireApiPermission } from "@/lib/rbac";
import { paginationSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("reports:read");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const params = paginationSchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const bankName = req.nextUrl.searchParams.get("bankName") ?? undefined;
  const sourceType = req.nextUrl.searchParams.get("sourceType") ?? undefined;

  const data = await getBankTransactions(allowed.session.user.shopId!, {
    page: params.page,
    limit: params.limit,
    bankName,
    sourceType,
  });

  return NextResponse.json(data);
}
