import { NextResponse, type NextRequest } from "next/server";
import { getActiveSettings, upsertSettings } from "@/lib/settings";
import { requireApiPermission } from "@/lib/rbac";
import { settingsSchema } from "@/schemas/domain";

export async function GET() {
  const allowed = await requireApiPermission("settings:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const settings = await getActiveSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const allowed = await requireApiPermission("settings:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  await upsertSettings(parsed.data, allowed.session.user.id);
  const settings = await getActiveSettings();
  return NextResponse.json(settings);
}
