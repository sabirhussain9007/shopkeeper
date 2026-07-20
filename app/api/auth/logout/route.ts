import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { logActivity } from "@/lib/activity";
import { authOptions } from "@/lib/auth";
import { getClientDeviceInfo } from "@/lib/request-meta";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => ({}))) as { userAgent?: string };
  const info = getClientDeviceInfo(req);
  const fromBody = body.userAgent ? undefined : undefined;
  void fromBody;

  await logActivity({
    shopId: session.user.shopId,
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    userRole: session.user.role,
    action: "auth.logout",
    entity: "user",
    entityId: session.user.id,
    module: "Auth",
    description: `Logout: ${session.user.email}`,
    ip: info.ip,
    browser: info.browser,
    device: info.device,
    userAgent: body.userAgent || info.userAgent,
  });

  return NextResponse.json({ ok: true });
}
