import { NextResponse, type NextRequest } from "next/server";
import { createShopRegistration } from "@/lib/shops";
import { createShopSchema } from "@/schemas/domain";

export async function POST(req: NextRequest) {
  const parsed = createShopSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const result = await createShopRegistration({
    shopName: parsed.data.shopName,
    ownerName: parsed.data.ownerName,
    ownerEmail: parsed.data.ownerEmail,
    ownerPhone: parsed.data.ownerPhone,
    password: parsed.data.password,
    plan: parsed.data.plan,
    paymentMethod: parsed.data.paymentMethod,
    paymentReference: parsed.data.paymentReference,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(
    {
      ...result.shop,
      message: "Shop created. Your payment is pending verification by the platform admin.",
    },
    { status: 201 },
  );
}
