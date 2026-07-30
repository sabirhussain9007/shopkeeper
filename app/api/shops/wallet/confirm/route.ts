import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Shop } from "@/models";

const confirmSchema = z.object({
  shopId: z.string().min(1),
  paymentReference: z.string().min(3).max(120),
  provider: z.enum(["easypaisa", "jazzcash"]),
});

export async function POST(req: NextRequest) {
  const parsed = confirmSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Transaction ID is required." }, { status: 422 });
  }

  await connectDb();
  const shop = await Shop.findOne({ _id: parsed.data.shopId, deletedAt: { $exists: false } });
  if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404 });

  shop.paymentMethod = parsed.data.provider;
  shop.paymentReference = parsed.data.paymentReference.trim();
  shop.paymentStatus = "pending";
  await shop.save();

  return NextResponse.json({
    ok: true,
    message: "Payment submitted. Your shop will activate after admin verification.",
  });
}
