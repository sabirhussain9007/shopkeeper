import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead, markNotificationRead, syncSubscriptionNotifications } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  void syncSubscriptionNotifications();

  const isSuper = session.user.role === "super_admin" || req.nextUrl.searchParams.get("audience") === "super_admin";
  const data = await listNotifications({
    userId: session.user.id,
    shopId: session.user.shopId,
    audience: isSuper ? "super_admin" : undefined,
    unreadOnly: req.nextUrl.searchParams.get("unread") === "1",
  });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  if (body.markAll) {
    await markAllNotificationsRead({
      userId: session.user.id,
      shopId: session.user.shopId,
      audience: session.user.role === "super_admin" ? "super_admin" : "shop",
    });
    return NextResponse.json({ ok: true });
  }
  if (body.id) {
    await markNotificationRead(body.id, session.user.role === "super_admin" ? undefined : session.user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Invalid request" }, { status: 422 });
}
