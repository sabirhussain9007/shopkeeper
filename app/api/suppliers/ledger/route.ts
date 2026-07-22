import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { formatPakistanDateInput, resolvePakistanEntryDate } from "@/lib/datetime";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Supplier, SupplierLedgerEntry } from "@/models";
import { supplierLedgerPaymentSchema } from "@/schemas/domain";

export async function GET(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  const supplierId = req.nextUrl.searchParams.get("supplierId");
  if (!supplierId) return NextResponse.json({ error: "supplierId required" }, { status: 422 });
  await connectDb();
  const items = await SupplierLedgerEntry.find(
    withShopFilter(allowed.session.user.shopId!, { supplier: supplierId, deletedAt: { $exists: false } }),
  )
    .sort({ entryDate: -1, createdAt: -1 })
    .limit(200)
    .populate("purchase", "invoiceNumber grandTotal orderDate purchaseKind status paidAmount paymentMethod chequeNumber chequeDate")
    .lean();
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = supplierLedgerPaymentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment payload." }, { status: 422 });
  }

  const body = parsed.data;
  await connectDb();
  const shopId = allowed.session.user.shopId!;
  const supplier = await Supplier.findOneAndUpdate(
    withShopFilter(shopId, { _id: body.supplierId }),
    { $inc: { currentBalance: body.type === "payment" ? -body.amount : body.amount } },
    { new: true },
  );
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const reference = body.reference?.trim() ?? "";
  const bankName = body.bankName?.trim() ?? "";
  const usesBankName = body.paymentMethod === "bank" || body.paymentMethod === "cheque";
  const entryDate =
    body.type === "payment"
      ? resolvePakistanEntryDate(formatPakistanDateInput(body.entryDate ?? new Date()))
      : (body.entryDate ?? new Date());

  const entry = await SupplierLedgerEntry.create({
    shopId,
    supplier: body.supplierId,
    type: body.type,
    debit: body.type === "payment" ? 0 : body.amount,
    credit: body.type === "payment" ? body.amount : 0,
    balance: supplier.currentBalance ?? 0,
    description: body.description.trim(),
    entryDate,
    paymentMethod: body.type === "payment" ? body.paymentMethod : undefined,
    reference: body.type === "payment" && reference ? reference : undefined,
    bankName: body.type === "payment" && usesBankName && bankName ? bankName : undefined,
    chequeDate: body.type === "payment" && body.paymentMethod === "cheque" ? body.chequeDate ?? undefined : undefined,
    createdBy: allowed.session.user.id,
  });

  if (body.type === "payment") {
    const { syncVendorPaymentAccounting } = await import("@/lib/accounting-sync");
    await syncVendorPaymentAccounting(
      shopId,
      allowed.session.user.id,
      String(entry._id),
      supplier.supplierName ?? "Vendor",
      body.amount,
      body.paymentMethod,
      reference,
      bankName,
      body.paymentMethod === "cheque" ? body.chequeDate ?? null : null,
      entryDate,
    );
  }

  return NextResponse.json(entry, { status: 201 });
}
