import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { formatPakistanDateInput, resolvePakistanEntryDate } from "@/lib/datetime";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Supplier, SupplierLedgerEntry } from "@/models";
import { supplierLedgerChequeBounceSchema } from "@/schemas/domain";

type LedgerPaymentRow = {
  paymentMethod?: string | null;
  reference?: string | null;
  bankName?: string | null;
  chequeDate?: Date | string | null;
  credit?: number | null;
};

function isChequePayment(entry: LedgerPaymentRow) {
  if (entry.paymentMethod === "cheque") return true;
  if (entry.chequeDate) return true;
  if (entry.bankName && entry.reference) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("inventory:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = supplierLedgerChequeBounceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid cheque bounce payload." }, { status: 422 });
  }

  const body = parsed.data;

  try {
    await connectDb();
    const shopId = allowed.session.user.shopId!;
    const filter = withShopFilter(shopId, {
      _id: body.originalEntryId,
      supplier: body.supplierId,
      type: "payment",
      deletedAt: { $exists: false },
    });

    const original = await SupplierLedgerEntry.findOne(filter).lean();
    if (!original) {
      return NextResponse.json({ error: "Cheque payment not found for this vendor." }, { status: 404 });
    }
    if (!isChequePayment(original)) {
      return NextResponse.json({ error: "Only cheque payments can be marked as bounced." }, { status: 422 });
    }
    if ((original.credit ?? 0) <= 0) {
      return NextResponse.json({ error: "This payment has no amount to bounce." }, { status: 422 });
    }

    const alreadyBounced = await SupplierLedgerEntry.exists({
      shopId,
      type: "cheque_bounce",
      relatedEntry: original._id,
      deletedAt: { $exists: false },
    });
    if (alreadyBounced) {
      return NextResponse.json({ error: "This cheque payment has already been marked as bounced." }, { status: 422 });
    }

    const amount = original.credit ?? 0;
    const bounceDate = resolvePakistanEntryDate(formatPakistanDateInput(body.entryDate ?? new Date()));
    const chequeRef = original.reference?.trim();
    const bounceDescription =
      body.description?.trim() ||
      `Cheque bounced${chequeRef ? ` (#${chequeRef})` : ""}${original.bankName ? ` · ${original.bankName}` : ""}`;

    let supplier = await Supplier.findOneAndUpdate(
      withShopFilter(shopId, { _id: body.supplierId }),
      { $inc: { currentBalance: amount } },
      { new: true },
    );
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    const bounceEntry = await SupplierLedgerEntry.create({
      shopId,
      supplier: body.supplierId,
      type: "cheque_bounce",
      debit: amount,
      credit: 0,
      balance: supplier.currentBalance ?? 0,
      description: bounceDescription,
      entryDate: bounceDate,
      relatedEntry: original._id,
      paymentMethod: original.paymentMethod ?? "cheque",
      reference: original.reference,
      bankName: original.bankName,
      chequeDate: original.chequeDate,
      createdBy: allowed.session.user.id,
    });

    let repayEntry = null;
    if (body.recordRepayment && body.repay) {
      const repay = body.repay;
      const repayReference = repay.reference?.trim() ?? "";
      const repayBankName = repay.bankName?.trim() ?? "";
      const usesBankName = repay.paymentMethod === "bank" || repay.paymentMethod === "cheque";
      const repayDate = resolvePakistanEntryDate(formatPakistanDateInput(repay.entryDate ?? new Date()));
      const repayDescription =
        repay.description?.trim() ||
        `Repayment after cheque bounce${chequeRef ? ` (#${chequeRef})` : ""} via ${repay.paymentMethod}`;

      supplier = await Supplier.findOneAndUpdate(
        withShopFilter(shopId, { _id: body.supplierId }),
        { $inc: { currentBalance: -amount } },
        { new: true },
      );
      if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

      repayEntry = await SupplierLedgerEntry.create({
        shopId,
        supplier: body.supplierId,
        type: "payment",
        debit: 0,
        credit: amount,
        balance: supplier.currentBalance ?? 0,
        description: repayDescription,
        entryDate: repayDate,
        relatedEntry: bounceEntry._id,
        paymentMethod: repay.paymentMethod,
        reference: repayReference || undefined,
        bankName: usesBankName && repayBankName ? repayBankName : undefined,
        chequeDate: repay.paymentMethod === "cheque" ? repay.chequeDate ?? undefined : undefined,
        createdBy: allowed.session.user.id,
      });

      const { syncVendorPaymentAccounting } = await import("@/lib/accounting-sync");
      await syncVendorPaymentAccounting(
        shopId,
        allowed.session.user.id,
        String(repayEntry._id),
        supplier.supplierName ?? "Vendor",
        amount,
        repay.paymentMethod,
        repayReference,
        repayBankName,
        repay.paymentMethod === "cheque" ? repay.chequeDate ?? null : null,
        repayDate,
      );
    }

    return NextResponse.json({ bounceEntry, repayEntry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cheque bounce failed.";
    if (message.includes("cheque_bounce") && message.includes("enum")) {
      return NextResponse.json(
        { error: "Cheque bounce is not available yet. Restart the app server and try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
