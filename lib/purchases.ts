import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { withShopFilter } from "@/lib/tenant";
import { AccountingEntry, Product, Purchase, PurchaseItem, StockAdjustment, Supplier, SupplierLedgerEntry } from "@/models";
import type { PurchaseInput } from "@/types";
import { syncPurchaseAccounting, syncPurchaseAdvancePayment, syncPurchaseReceiveAccounting } from "@/lib/accounting-sync";
import { aggregatePurchaseLines, calcPurchaseLineAmounts, type PurchaseDiscountType } from "@/lib/purchase-line-math";

function normalizePurchaseProducts(products: PurchaseInput["products"]) {
  return products.map((item) => {
    const amounts = calcPurchaseLineAmounts({
      quantity: item.quantity,
      cost: item.cost,
      discountType: item.discountType ?? "flat",
      discountValue: item.discountValue ?? 0,
      salesTaxType: item.salesTaxType ?? "percentage",
      salesTaxValue: item.salesTaxValue ?? item.taxRate ?? 0,
    });
    return {
      ...item,
      ...amounts,
      orderedQuantity: item.quantity,
      orderedCost: item.cost,
      orderedDiscountType: item.discountType ?? "flat",
      orderedDiscountValue: item.discountValue ?? 0,
      orderedSalesTaxType: item.salesTaxType ?? "percentage",
      orderedSalesTaxValue: item.salesTaxValue ?? item.taxRate ?? 0,
      taxRate: item.salesTaxType === "percentage" ? item.salesTaxValue ?? item.taxRate ?? 0 : item.taxRate ?? 0,
      lineTotal: amounts.netAmount,
    };
  });
}

function purchaseKindFilter(kind?: "order" | "spot") {
  if (kind === "spot") return { purchaseKind: "spot" };
  return { $or: [{ purchaseKind: "order" }, { purchaseKind: { $exists: false } }] };
}

export async function createPurchase(input: PurchaseInput, userId: string, shopId: string) {
  await connectDb();
  const supplier = await Supplier.findOne(withShopFilter(shopId, { _id: input.supplier }));
  if (!supplier) return { ok: false as const, error: "Supplier not found" };

  const normalizedProducts = normalizePurchaseProducts(input.products);

  const totals = aggregatePurchaseLines(normalizedProducts);
  const discountAmount = totals.discountAmount;
  const salesTaxAmount = totals.salesTaxAmount;

  const purchase = await Purchase.create({
    shopId,
    supplier: input.supplier,
    invoiceNumber: input.invoiceNumber?.trim() || "",
    orderDate: input.orderDate ?? new Date(),
    subtotal: totals.subtotal,
    discountType: "flat",
    discountValue: discountAmount,
    discountAmount,
    salesTaxType: "flat",
    salesTaxValue: salesTaxAmount,
    salesTaxAmount,
    taxes: salesTaxAmount,
    grandTotal: totals.grandTotal,
    orderedGrandTotal: totals.grandTotal,
    adjustmentAmount: 0,
    paidAmount: input.paidAmount,
    paymentMethod: input.paymentMethod ?? "cash",
    chequeNumber:
      input.paymentMethod === "cheque" || input.paymentMethod === "easypaisa" || input.paymentMethod === "jazzcash"
        ? input.chequeNumber?.trim() || ""
        : "",
    chequeDate: input.paymentMethod === "cheque" ? input.chequeDate ?? undefined : undefined,
    bankName:
      input.paymentMethod === "cheque" || input.paymentMethod === "easypaisa" || input.paymentMethod === "jazzcash"
        ? input.bankName?.trim() || ""
        : "",
    status: input.status,
    purchaseKind: input.purchaseKind ?? "order",
    createdBy: userId,
  });

  await PurchaseItem.insertMany(
    normalizedProducts.map((item) => ({
      ...item,
      shopId,
      purchase: purchase._id,
      createdBy: userId,
    })),
  );

  if ((purchase.paidAmount ?? 0) > 0) {
    await syncPurchaseAdvancePayment(shopId, userId, {
      id: String(purchase._id),
      grandTotal: purchase.grandTotal ?? 0,
      paidAmount: purchase.paidAmount ?? 0,
      paymentMethod: purchase.paymentMethod,
      chequeNumber: purchase.chequeNumber ?? undefined,
      chequeDate: purchase.chequeDate,
      bankName: purchase.bankName ?? undefined,
    });
  }

  return { ok: true as const, purchase };
}

async function recordSupplierCredit(shopId: string, supplierId: string, purchaseId: string, amount: number, userId: string, description: string, type: "purchase" | "return") {
  if (amount <= 0) return;
  const supplier = await Supplier.findOneAndUpdate(
    withShopFilter(shopId, { _id: supplierId }),
    { $inc: { currentBalance: type === "return" ? -amount : amount } },
    { new: true },
  );
  if (!supplier) return;
  await SupplierLedgerEntry.create({
    shopId,
    supplier: supplierId,
    purchase: purchaseId,
    type,
    debit: type === "purchase" ? amount : 0,
    credit: type === "return" ? amount : 0,
    balance: supplier.currentBalance ?? 0,
    description,
    createdBy: userId,
  });
}

export async function createSpotPurchase(input: PurchaseInput, userId: string, shopId: string) {
  await connectDb();
  const supplier = await Supplier.findOne(withShopFilter(shopId, { _id: input.supplier }));
  if (!supplier) return { ok: false as const, error: "Supplier not found" };

  const normalizedProducts = normalizePurchaseProducts(input.products);
  const totals = aggregatePurchaseLines(normalizedProducts);

  const purchase = await Purchase.create({
    shopId,
    supplier: input.supplier,
    invoiceNumber: input.invoiceNumber?.trim() || "",
    orderDate: input.orderDate ?? new Date(),
    subtotal: totals.subtotal,
    discountType: "flat",
    discountValue: totals.discountAmount,
    discountAmount: totals.discountAmount,
    salesTaxType: "flat",
    salesTaxValue: totals.salesTaxAmount,
    salesTaxAmount: totals.salesTaxAmount,
    taxes: totals.salesTaxAmount,
    grandTotal: totals.grandTotal,
    orderedGrandTotal: totals.grandTotal,
    adjustmentAmount: 0,
    paidAmount: input.paidAmount,
    paymentMethod: input.paymentMethod ?? "cash",
    chequeNumber:
      input.paymentMethod === "cheque" || input.paymentMethod === "easypaisa" || input.paymentMethod === "jazzcash"
        ? input.chequeNumber?.trim() || ""
        : "",
    chequeDate: input.paymentMethod === "cheque" ? input.chequeDate ?? undefined : undefined,
    bankName:
      input.paymentMethod === "cheque" || input.paymentMethod === "easypaisa" || input.paymentMethod === "jazzcash"
        ? input.bankName?.trim() || ""
        : "",
    status: "received",
    purchaseKind: "spot",
    createdBy: userId,
  });

  await PurchaseItem.insertMany(
    normalizedProducts.map((item) => ({
      ...item,
      shopId,
      purchase: purchase._id,
      createdBy: userId,
    })),
  );

  for (const item of normalizedProducts) {
    const product = await Product.findOne(withShopFilter(shopId, { _id: item.product, deletedAt: { $exists: false } }));
    if (!product) {
      return { ok: false as const, error: `Product not found for ${item.name}.` };
    }

    const previousQuantity = product.quantity ?? 0;
    const newQuantity = previousQuantity + item.quantity;
    product.quantity = newQuantity;
    product.purchasePrice = item.cost;
    product.costPrice = item.cost;
    product.supplier = new Types.ObjectId(input.supplier);
    product.updatedBy = new Types.ObjectId(userId);
    await product.save();

    await StockAdjustment.create({
      shopId,
      product: product._id,
      type: "increase",
      quantity: item.quantity,
      previousQuantity,
      newQuantity,
      reason: `Spot purchase ${purchase._id}: +${item.quantity} ${product.unit ?? "pcs"} @ ${item.cost}`,
      createdBy: userId,
    });
  }

  const unpaid = Math.max((purchase.grandTotal ?? 0) - (purchase.paidAmount ?? 0), 0);
  await recordSupplierCredit(
    shopId,
    String(purchase.supplier),
    String(purchase._id),
    unpaid,
    userId,
    `Spot purchase ${purchase._id}`,
    "purchase",
  );
  await syncPurchaseAccounting(shopId, userId, {
    id: String(purchase._id),
    grandTotal: purchase.grandTotal ?? 0,
    paidAmount: purchase.paidAmount ?? 0,
    paymentMethod: purchase.paymentMethod,
    chequeNumber: purchase.chequeNumber ?? undefined,
    chequeDate: purchase.chequeDate,
    bankName: purchase.bankName ?? undefined,
  });

  return { ok: true as const, purchase };
}

export type PurchaseReceiveInput = {
  items?: Array<{
    productId: string;
    receivedQuantity: number;
    receivedCost: number;
    discountType?: "flat" | "flat_per_piece" | "percentage";
    discountValue?: number;
    salesTaxType?: "flat" | "percentage";
    salesTaxValue?: number;
  }>;
  paidAmount?: number;
  paymentMethod?: "cash" | "cheque" | "credit";
  chequeNumber?: string;
  chequeDate?: Date | null;
  bankName?: string;
};

export async function receivePurchase(
  purchaseId: string,
  userId: string,
  shopId: string,
  input?: PurchaseReceiveInput,
) {
  await connectDb();
  const purchase = await Purchase.findOne(withShopFilter(shopId, { _id: purchaseId, deletedAt: { $exists: false }, status: "ordered" }));
  if (!purchase) return { ok: false as const, status: 404, error: "Ordered purchase not found." };

  const items = await PurchaseItem.find(withShopFilter(shopId, { purchase: purchaseId }));
  if (items.length === 0) return { ok: false as const, status: 422, error: "Purchase has no line items." };

  const adjustmentMap = new Map(input?.items?.map((line) => [line.productId, line]) ?? []);
  const normalizedLines: Array<{
    grossAmount: number;
    discountAmount: number;
    salesTaxAmount: number;
    netAmount: number;
  }> = [];
  let receivedUnits = 0;

  for (const item of items) {
    const productId = String(item.product);
    const adjustment = adjustmentMap.get(productId);
    const orderedQuantity = item.orderedQuantity ?? item.quantity ?? 0;
    const orderedCost = item.orderedCost ?? item.cost ?? 0;
    const orderedDiscountType = item.orderedDiscountType ?? (item.discountType as PurchaseDiscountType) ?? "flat";
    const orderedDiscountValue = item.orderedDiscountValue ?? item.discountValue ?? 0;
    const orderedSalesTaxType = item.orderedSalesTaxType ?? (item.salesTaxType as "flat" | "percentage") ?? "percentage";
    const orderedSalesTaxValue = item.orderedSalesTaxValue ?? item.salesTaxValue ?? item.taxRate ?? 0;
    const receivedQuantity = adjustment?.receivedQuantity ?? orderedQuantity;
    const receivedCost = adjustment?.receivedCost ?? orderedCost;
    const discountType = adjustment?.discountType ?? orderedDiscountType;
    const discountValue = adjustment?.discountValue ?? orderedDiscountValue;
    const salesTaxType = adjustment?.salesTaxType ?? orderedSalesTaxType;
    const salesTaxValue = adjustment?.salesTaxValue ?? orderedSalesTaxValue;

    if (receivedQuantity < 0 || receivedQuantity > orderedQuantity) {
      return { ok: false as const, status: 422, error: `Received quantity for ${item.name ?? "item"} must be between 0 and ${orderedQuantity}.` };
    }
    if (receivedCost < 0) {
      return { ok: false as const, status: 422, error: `Received cost for ${item.name ?? "item"} cannot be negative.` };
    }

    const amounts = calcPurchaseLineAmounts({
      quantity: receivedQuantity,
      cost: receivedCost,
      discountType,
      discountValue,
      salesTaxType,
      salesTaxValue,
    });

    if (receivedQuantity > 0) {
      const product = await Product.findOne(withShopFilter(shopId, { _id: item.product, deletedAt: { $exists: false } }));
      if (!product) return { ok: false as const, status: 404, error: `Product not found for ${item.name ?? "item"}.` };

      const previousQuantity = product.quantity ?? 0;
      const newQuantity = previousQuantity + receivedQuantity;
      product.quantity = newQuantity;
      product.purchasePrice = receivedCost;
      product.costPrice = receivedCost;
      product.updatedBy = new Types.ObjectId(userId);
      await product.save();

      const adjusted =
        receivedQuantity !== orderedQuantity ||
        receivedCost !== orderedCost ||
        discountType !== ((item.discountType as PurchaseDiscountType) ?? "flat") ||
        discountValue !== (item.discountValue ?? 0) ||
        salesTaxType !== ((item.salesTaxType as "flat" | "percentage") ?? "percentage") ||
        salesTaxValue !== (item.salesTaxValue ?? item.taxRate ?? 0);
      await StockAdjustment.create({
        shopId,
        product: product._id,
        type: "increase",
        quantity: receivedQuantity,
        previousQuantity,
        newQuantity,
        reason: adjusted
          ? `PO received with adjustment: ordered ${orderedQuantity} @ ${orderedCost}, received ${receivedQuantity} @ ${receivedCost}`
          : `PO received: +${receivedQuantity} @ ${receivedCost}`,
        createdBy: userId,
      });
      receivedUnits += receivedQuantity;
    }

    item.orderedQuantity = orderedQuantity;
    item.orderedCost = orderedCost;
    item.orderedDiscountType = orderedDiscountType;
    item.orderedDiscountValue = orderedDiscountValue;
    item.orderedSalesTaxType = orderedSalesTaxType;
    item.orderedSalesTaxValue = orderedSalesTaxValue;
    item.quantity = receivedQuantity;
    item.cost = receivedCost;
    item.discountType = discountType;
    item.discountValue = discountValue;
    item.salesTaxType = salesTaxType;
    item.salesTaxValue = salesTaxValue;
    item.grossAmount = amounts.grossAmount;
    item.netAmount = amounts.netAmount;
    item.lineTotal = amounts.netAmount;
    item.taxRate = salesTaxType === "percentage" ? salesTaxValue : item.taxRate ?? 0;
    item.updatedBy = new Types.ObjectId(userId);
    await item.save();

    normalizedLines.push(amounts);
  }

  if (receivedUnits <= 0) {
    return { ok: false as const, status: 422, error: "Enter a received quantity greater than zero for at least one product." };
  }

  const totals = aggregatePurchaseLines(normalizedLines);
  const orderedGrandTotal = purchase.orderedGrandTotal ?? purchase.grandTotal ?? 0;
  const adjustmentAmount = orderedGrandTotal - totals.grandTotal;

  purchase.orderedGrandTotal = orderedGrandTotal;
  purchase.adjustmentAmount = adjustmentAmount;
  purchase.subtotal = totals.subtotal;
  purchase.discountType = "flat";
  purchase.discountValue = totals.discountAmount;
  purchase.discountAmount = totals.discountAmount;
  purchase.salesTaxType = "flat";
  purchase.salesTaxValue = totals.salesTaxAmount;
  purchase.salesTaxAmount = totals.salesTaxAmount;
  purchase.taxes = totals.salesTaxAmount;
  purchase.grandTotal = totals.grandTotal;

  const previousPaid = purchase.paidAmount ?? 0;
  const totalPaid =
    input?.paidAmount !== undefined
      ? Math.min(Math.max(input.paidAmount, 0), totals.grandTotal)
      : previousPaid;
  purchase.paidAmount = totalPaid;

  if (input?.paymentMethod) {
    purchase.paymentMethod = input.paymentMethod;
    if (input.paymentMethod === "cheque") {
      if (input.chequeNumber?.trim()) {
        purchase.chequeNumber = input.chequeNumber.trim();
      }
      if (input.chequeDate) {
        purchase.chequeDate = input.chequeDate;
      }
      if (input.bankName?.trim()) {
        purchase.bankName = input.bankName.trim();
      }
    } else {
      purchase.chequeNumber = "";
      purchase.chequeDate = undefined;
      purchase.bankName = "";
    }
  }

  purchase.status = "received";
  purchase.updatedBy = new Types.ObjectId(userId);
  await purchase.save();

  const unpaid = Math.max((purchase.grandTotal ?? 0) - (purchase.paidAmount ?? 0), 0);
  await recordSupplierCredit(
    shopId,
    String(purchase.supplier),
    String(purchase._id),
    unpaid,
    userId,
    adjustmentAmount !== 0
      ? `Purchase received with adjustment ${adjustmentAmount}: ${purchase._id}`
      : `Purchase received ${purchase._id}`,
    "purchase",
  );
  await syncPurchaseReceiveAccounting(shopId, userId, {
    id: String(purchase._id),
    grandTotal: purchase.grandTotal ?? 0,
    paidAmount: purchase.paidAmount ?? 0,
    paymentMethod: purchase.paymentMethod,
    chequeNumber: purchase.chequeNumber ?? undefined,
    chequeDate: purchase.chequeDate,
    bankName: purchase.bankName ?? undefined,
  }, previousPaid);

  return { ok: true as const, purchase };
}

export async function returnPurchase(
  purchaseId: string,
  userId: string,
  shopId: string,
  lines: Array<{ productId: string; quantity: number }>,
) {
  await connectDb();
  const purchase = await Purchase.findOne(withShopFilter(shopId, { _id: purchaseId, deletedAt: { $exists: false }, status: "received" }));
  if (!purchase) return { ok: false as const, status: 404, error: "Received purchase not found." };

  const items = await PurchaseItem.find(withShopFilter(shopId, { purchase: purchaseId, deletedAt: { $exists: false } }));
  const returnLines = lines.filter((line) => line.quantity > 0);
  if (returnLines.length === 0) {
    return { ok: false as const, status: 422, error: "Add at least one product quantity to return." };
  }

  let returnTotal = 0;

  for (const line of returnLines) {
    const item = items.find((row) => String(row.product) === line.productId);
    const itemQty = item?.quantity ?? 0;
    if (!item || line.quantity > itemQty) {
      return { ok: false as const, status: 422, error: `Invalid return quantity for ${item?.name ?? "item"}.` };
    }

    const product = await Product.findOne(withShopFilter(shopId, { _id: line.productId, deletedAt: { $exists: false } }));
    if (!product) {
      return { ok: false as const, status: 404, error: `Product not found for ${item.name ?? "item"}.` };
    }

    const availableStock = product.quantity ?? 0;
    if (availableStock < line.quantity) {
      return {
        ok: false as const,
        status: 422,
        error: `Not enough stock to return ${item.name ?? "item"}. Available: ${availableStock}, requested: ${line.quantity}.`,
      };
    }

    const lineNet = item.netAmount ?? itemQty * (item.cost ?? 0);
    const returnedNet = itemQty > 0 ? (lineNet * line.quantity) / itemQty : 0;
    returnTotal += returnedNet;

    const previousQuantity = availableStock;
    const newQuantity = previousQuantity - line.quantity;
    product.quantity = newQuantity;
    product.updatedBy = new Types.ObjectId(userId);
    await product.save();

    await StockAdjustment.create({
      shopId,
      product: product._id,
      type: "decrease",
      quantity: line.quantity,
      previousQuantity,
      newQuantity,
      reason: `Purchase return ${purchase._id}: -${line.quantity} ${product.unit ?? "pcs"}`,
      createdBy: userId,
    });

    const remainingQty = itemQty - line.quantity;
    item.quantity = remainingQty;
    item.netAmount = Math.max(lineNet - returnedNet, 0);
    item.grossAmount = remainingQty > 0 && itemQty > 0 ? ((item.grossAmount ?? 0) * remainingQty) / itemQty : 0;
    item.lineTotal = item.netAmount;
    item.updatedBy = new Types.ObjectId(userId);
    await item.save();
  }

  await recordSupplierCredit(shopId, String(purchase.supplier), String(purchase._id), returnTotal, userId, `Purchase return ${purchase._id}`, "return");

  const remainingItems = await PurchaseItem.find(withShopFilter(shopId, { purchase: purchaseId, deletedAt: { $exists: false } }));
  const fullyReturned = remainingItems.every((row) => (row.quantity ?? 0) <= 0);
  if (fullyReturned) {
    purchase.status = "cancelled";
    purchase.updatedBy = new Types.ObjectId(userId);
    await purchase.save();
  }

  return { ok: true as const, returnTotal, fullyReturned };
}

export async function getPurchaseDetail(purchaseId: string, shopId: string) {
  await connectDb();
  const purchase = await Purchase.findOne(withShopFilter(shopId, { _id: purchaseId, deletedAt: { $exists: false } }))
    .populate("supplier", "supplierName phone contactPerson")
    .lean();
  if (!purchase) return null;
  const items = await PurchaseItem.find(withShopFilter(shopId, { purchase: purchaseId, deletedAt: { $exists: false } })).lean();
  return {
    purchase,
    items: items.map((item) => ({
      ...item,
      _id: String(item._id),
      product: String(item.product),
      discountType: item.discountType ?? item.orderedDiscountType ?? "flat",
      discountValue: item.discountValue ?? item.orderedDiscountValue ?? 0,
      salesTaxType: item.salesTaxType ?? item.orderedSalesTaxType ?? "percentage",
      salesTaxValue: item.salesTaxValue ?? item.orderedSalesTaxValue ?? item.taxRate ?? 0,
      orderedDiscountType: item.orderedDiscountType ?? item.discountType ?? "flat",
      orderedDiscountValue: item.orderedDiscountValue ?? item.discountValue ?? 0,
      orderedSalesTaxType: item.orderedSalesTaxType ?? item.salesTaxType ?? "percentage",
      orderedSalesTaxValue: item.orderedSalesTaxValue ?? item.salesTaxValue ?? item.taxRate ?? 0,
    })),
  };
}

export async function buyStockFromVendor(
  productId: string,
  input: { vendorId: string; quantity: number; unitCost: number; paidAmount?: number; notes?: string },
  userId: string,
  shopId: string,
) {
  await connectDb();
  const [product, vendor] = await Promise.all([
    Product.findOne(withShopFilter(shopId, { _id: productId, deletedAt: { $exists: false } })),
    Supplier.findOne(withShopFilter(shopId, { _id: input.vendorId, deletedAt: { $exists: false } })),
  ]);
  if (!product) return { ok: false as const, status: 404, error: "Product not found." };
  if (!vendor) return { ok: false as const, status: 404, error: "Vendor not found." };

  const quantity = input.quantity;
  const unitCost = input.unitCost;
  const taxRate = product.taxRate ?? 0;
  const lineSubtotal = quantity * unitCost;
  const taxes = (lineSubtotal * taxRate) / 100;
  const grandTotal = lineSubtotal + taxes;
  const paidAmount = Math.min(Math.max(input.paidAmount ?? 0, 0), grandTotal);
  const previousQuantity = product.quantity ?? 0;
  const previousPurchasePrice = product.purchasePrice ?? 0;
  const newQuantity = previousQuantity + quantity;
  const vendorLabel = vendor.supplierName ?? "Vendor";
  const noteSuffix = input.notes?.trim() ? ` · ${input.notes.trim()}` : "";

  const purchase = await Purchase.create({
    shopId,
    supplier: input.vendorId,
    subtotal: lineSubtotal,
    taxes,
    grandTotal,
    paidAmount,
    status: "received",
    createdBy: userId,
  });

  await PurchaseItem.create({
    shopId,
    purchase: purchase._id,
    product: product._id,
    name: product.productName,
    quantity,
    cost: unitCost,
    taxRate,
    lineTotal: grandTotal,
    createdBy: userId,
  });

  product.quantity = newQuantity;
  product.purchasePrice = unitCost;
  product.costPrice = unitCost;
  product.supplier = new Types.ObjectId(input.vendorId);
  product.updatedBy = new Types.ObjectId(userId);
  await product.save();

  await StockAdjustment.create({
    shopId,
    product: product._id,
    type: "increase",
    quantity,
    previousQuantity,
    newQuantity,
    reason: `Vendor stock-in: ${vendorLabel} · +${quantity} ${product.unit ?? "pcs"} @ ${unitCost}${noteSuffix}`,
    createdBy: userId,
  });

  const unpaid = Math.max(grandTotal - paidAmount, 0);
  await recordSupplierCredit(
    shopId,
    input.vendorId,
    String(purchase._id),
    unpaid,
    userId,
    `Stock purchase ${product.sku} from ${vendorLabel}`,
    "purchase",
  );
  await syncPurchaseAccounting(shopId, userId, {
    id: String(purchase._id),
    grandTotal,
    paidAmount,
    paymentMethod: "cash",
  });

  return {
    ok: true as const,
    purchase,
    product: {
      _id: String(product._id),
      sku: product.sku,
      quantity: newQuantity,
      purchasePrice: unitCost,
      previousQuantity,
      previousPurchasePrice,
    },
    totals: { lineSubtotal, taxes, grandTotal, paidAmount, unpaid },
  };
}

async function getSpotPurchaseOrError(purchaseId: string, shopId: string) {
  await connectDb();
  const purchase = await Purchase.findOne(
    withShopFilter(shopId, { _id: purchaseId, purchaseKind: "spot", deletedAt: { $exists: false } }),
  );
  if (!purchase) return { ok: false as const, status: 404, error: "Spot purchase not found." };
  return { ok: true as const, purchase };
}

async function clearPurchaseAccounting(shopId: string, purchaseId: string) {
  await connectDb();
  await AccountingEntry.deleteMany({
    shopId,
    $or: [{ sourceId: purchaseId }, { eventKey: { $regex: `^purchase:${purchaseId}:` } }],
  });
}

async function revertSpotPurchaseStock(purchaseId: string, userId: string, shopId: string) {
  const items = await PurchaseItem.find(withShopFilter(shopId, { purchase: purchaseId, deletedAt: { $exists: false } }));
  const returnLines = items
    .filter((item) => (item.quantity ?? 0) > 0)
    .map((item) => ({ productId: String(item.product), quantity: item.quantity ?? 0 }));
  if (returnLines.length === 0) return { ok: true as const };
  return returnPurchase(purchaseId, userId, shopId, returnLines);
}

async function applySpotPurchaseStock(
  shopId: string,
  userId: string,
  purchaseId: string,
  supplierId: string,
  normalizedProducts: ReturnType<typeof normalizePurchaseProducts>,
) {
  for (const item of normalizedProducts) {
    const product = await Product.findOne(withShopFilter(shopId, { _id: item.product, deletedAt: { $exists: false } }));
    if (!product) {
      return { ok: false as const, error: `Product not found for ${item.name}.` };
    }

    const previousQuantity = product.quantity ?? 0;
    const newQuantity = previousQuantity + item.quantity;
    product.quantity = newQuantity;
    product.purchasePrice = item.cost;
    product.costPrice = item.cost;
    product.supplier = new Types.ObjectId(supplierId);
    product.updatedBy = new Types.ObjectId(userId);
    await product.save();

    await StockAdjustment.create({
      shopId,
      product: product._id,
      type: "increase",
      quantity: item.quantity,
      previousQuantity,
      newQuantity,
      reason: `Spot purchase ${purchaseId}: +${item.quantity} ${product.unit ?? "pcs"} @ ${item.cost}`,
      createdBy: userId,
    });
  }

  return { ok: true as const };
}

export async function deleteSpotPurchase(purchaseId: string, userId: string, shopId: string) {
  const found = await getSpotPurchaseOrError(purchaseId, shopId);
  if (!found.ok) return found;

  const reverted = await revertSpotPurchaseStock(purchaseId, userId, shopId);
  if (!reverted.ok) return { ...reverted, status: reverted.status ?? 400 };

  await clearPurchaseAccounting(shopId, purchaseId);
  await PurchaseItem.deleteMany(withShopFilter(shopId, { purchase: purchaseId }));
  await Purchase.findOneAndDelete(withShopFilter(shopId, { _id: purchaseId }));

  return { ok: true as const };
}

export async function updateSpotPurchase(purchaseId: string, input: PurchaseInput, userId: string, shopId: string) {
  const found = await getSpotPurchaseOrError(purchaseId, shopId);
  if (!found.ok) return found;

  const supplier = await Supplier.findOne(withShopFilter(shopId, { _id: input.supplier }));
  if (!supplier) return { ok: false as const, error: "Supplier not found" };

  const reverted = await revertSpotPurchaseStock(purchaseId, userId, shopId);
  if (!reverted.ok) return reverted;

  await clearPurchaseAccounting(shopId, purchaseId);
  await PurchaseItem.deleteMany(withShopFilter(shopId, { purchase: purchaseId }));

  const normalizedProducts = normalizePurchaseProducts(input.products);
  const totals = aggregatePurchaseLines(normalizedProducts);

  const purchase = await Purchase.findOneAndUpdate(
    withShopFilter(shopId, { _id: purchaseId }),
    {
      supplier: input.supplier,
      invoiceNumber: input.invoiceNumber?.trim() || "",
      orderDate: input.orderDate ?? new Date(),
      subtotal: totals.subtotal,
      discountType: "flat",
      discountValue: totals.discountAmount,
      discountAmount: totals.discountAmount,
      salesTaxType: "flat",
      salesTaxValue: totals.salesTaxAmount,
      salesTaxAmount: totals.salesTaxAmount,
      taxes: totals.salesTaxAmount,
      grandTotal: totals.grandTotal,
      orderedGrandTotal: totals.grandTotal,
      adjustmentAmount: 0,
      paidAmount: input.paidAmount,
      paymentMethod: input.paymentMethod ?? "cash",
      chequeNumber: input.paymentMethod === "cheque" ? input.chequeNumber?.trim() || "" : "",
      chequeDate: input.paymentMethod === "cheque" ? input.chequeDate ?? undefined : undefined,
      bankName: input.paymentMethod === "cheque" ? input.bankName?.trim() || "" : "",
      status: "received",
      purchaseKind: "spot",
      updatedBy: userId,
    },
    { new: true },
  );
  if (!purchase) return { ok: false as const, status: 404, error: "Spot purchase not found." };

  await PurchaseItem.insertMany(
    normalizedProducts.map((item) => ({
      ...item,
      shopId,
      purchase: purchase._id,
      createdBy: userId,
    })),
  );

  const stockResult = await applySpotPurchaseStock(
    shopId,
    userId,
    String(purchase._id),
    input.supplier,
    normalizedProducts,
  );
  if (!stockResult.ok) return stockResult;

  const unpaid = Math.max((purchase.grandTotal ?? 0) - (purchase.paidAmount ?? 0), 0);
  await recordSupplierCredit(
    shopId,
    String(purchase.supplier),
    String(purchase._id),
    unpaid,
    userId,
    `Spot purchase ${purchase._id}`,
    "purchase",
  );
  await syncPurchaseAccounting(shopId, userId, {
    id: String(purchase._id),
    grandTotal: purchase.grandTotal ?? 0,
    paidAmount: purchase.paidAmount ?? 0,
    paymentMethod: purchase.paymentMethod,
    chequeNumber: purchase.chequeNumber ?? undefined,
    chequeDate: purchase.chequeDate,
    bankName: purchase.bankName ?? undefined,
  });

  return { ok: true as const, purchase };
}

export async function listPurchases(page = 1, limit = 20, shopId: string, kind: "order" | "spot" = "order") {
  await connectDb();
  const filter = withShopFilter(shopId, { deletedAt: { $exists: false }, ...purchaseKindFilter(kind) });
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
