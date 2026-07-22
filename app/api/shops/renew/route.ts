import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { connectDb } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { Shop } from "@/models";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.shopId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { paymentMethod, paymentReference, plan } = (await req.json()) as {
    paymentMethod?: "bank";
    paymentReference?: string;
    plan?: "monthly" | "yearly";
  };
  if (!paymentMethod || !paymentReference?.trim()) {
    return NextResponse.json({ error: "Payment method and reference are required." }, { status: 422 });
  }

  await connectDb();
  const shop = await Shop.findById(session.user.shopId);
  if (!shop) return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  shop.paymentMethod = "bank";
  shop.paymentReference = paymentReference.trim();
  shop.paymentStatus = "pending";
  if (plan) shop.plan = plan;
  if (shop.status === "expired") shop.status = "pending";
  await shop.save();

  return NextResponse.json({ message: "Renewal submitted. Awaiting admin approval." });
}
