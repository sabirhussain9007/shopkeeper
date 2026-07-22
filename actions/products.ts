"use server";

import { revalidatePath } from "next/cache";
import { connectDb } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Product, StockAdjustment } from "@/models";
import { productSchema, stockAdjustmentSchema } from "@/schemas/domain";

export async function createProduct(input: unknown) {
  const session = await requirePermission("inventory:write");
  const shopId = session.user.shopId;
  if (!shopId) return { ok: false, error: "No shop linked." };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  await connectDb();
  const product = await Product.create({ ...parsed.data, shopId, createdBy: session.user.id });
  revalidatePath("/inventory");
  return { ok: true, product: JSON.parse(JSON.stringify(product)) };
}

export async function adjustStock(input: unknown) {
  const session = await requirePermission("inventory:write");
  const shopId = session.user.shopId;
  if (!shopId) return { ok: false, error: "No shop linked." };
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  await connectDb();
  const product = await Product.findOne(withShopFilter(shopId, { _id: parsed.data.product, deletedAt: { $exists: false } }));
  if (!product) return { ok: false, error: "Product not found" };
  product.quantity = parsed.data.newQuantity;
  await product.save();
  await StockAdjustment.create({ ...parsed.data, shopId, createdBy: session.user.id });
  revalidatePath("/inventory");
  return { ok: true };
}
