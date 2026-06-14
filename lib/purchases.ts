import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Product, Purchase, PurchaseItem, Supplier } from "@/models";
import type { PurchaseInput } from "@/types";

export async function createPurchase(input: PurchaseInput, userId: string) {
  await connectDb();
  const supplier = await Supplier.findById(input.supplier);
  if (!supplier) return { ok: false as const, error: "Supplier not found" };

  const purchase = await Purchase.create({
    supplier: input.supplier,
    subtotal: input.subtotal,
    taxes: input.taxes,
    grandTotal: input.grandTotal,
    paidAmount: input.paidAmount,
    status: input.status,
    createdBy: userId,
  });

  await PurchaseItem.insertMany(
    input.products.map((item) => ({
      ...item,
      purchase: purchase._id,
      createdBy: userId,
    })),
  );

  return { ok: true as const, purchase };
}

export async function receivePurchase(purchaseId: string, userId: string) {
  await connectDb();
  const purchase = await Purchase.findOne({ _id: purchaseId, deletedAt: { $exists: false }, status: "ordered" });
  if (!purchase) return { ok: false as const, status: 404, error: "Ordered purchase not found." };

  const items = await PurchaseItem.find({ purchase: purchaseId });
  await Promise.all(
    items.map((item) =>
      Product.updateOne(
        { _id: item.product },
        {
          $inc: { quantity: item.quantity },
          $set: { purchasePrice: item.cost, updatedBy: new Types.ObjectId(userId) },
        },
      ),
    ),
  );

  purchase.status = "received";
  purchase.updatedBy = new Types.ObjectId(userId);
  await purchase.save();

  return { ok: true as const, purchase };
}

export async function getPurchaseDetail(purchaseId: string) {
  await connectDb();
  const purchase = await Purchase.findOne({ _id: purchaseId, deletedAt: { $exists: false } })
    .populate("supplier", "supplierName phone contactPerson")
    .lean();
  if (!purchase) return null;
  const items = await PurchaseItem.find({ purchase: purchaseId, deletedAt: { $exists: false } }).lean();
  return { purchase, items };
}

export async function listPurchases(page = 1, limit = 20) {
  await connectDb();
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Purchase.find(filter)
      .populate("supplier", "supplierName phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Purchase.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}
