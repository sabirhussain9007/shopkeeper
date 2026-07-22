import { NextResponse, type NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { formatPakistanDateInput, resolvePakistanEntryDate } from "@/lib/datetime";
import { requireApiPermission } from "@/lib/rbac";
import { withShopFilter } from "@/lib/tenant";
import { Customer, LedgerEntry, Sale } from "@/models";
import { saleChequeBounceSchema } from "@/schemas/domain";

export async function POST(req: NextRequest) {
  const allowed = await requireApiPermission("pos:write");
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });

  const parsed = saleChequeBounceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid cheque bounce payload." }, { status: 422 });
  }

  const body = parsed.data;

  try {
    await connectDb();
    const shopId = allowed.session.user.shopId!;
    const sale = await Sale.findOne(
      withShopFilter(shopId, { _id: body.saleId, deletedAt: { $exists: false } }),
    ).lean();
    if (!sale) return NextResponse.json({ error: "Sale not found." }, { status: 404 });
    if (sale.paymentMethod !== "cheque") {
      return NextResponse.json({ error: "Only cheque sales can be marked as bounced." }, { status: 422 });
    }
    if (sale.status !== "completed") {
      return NextResponse.json({ error: "Only completed sales can be marked as bounced." }, { status: 422 });
    }
    if (!sale.customer) {
      return NextResponse.json({ error: "This sale has no customer on file for cheque bounce." }, { status: 422 });
    }

    const alreadyBounced = await LedgerEntry.exists({
      shopId,
      type: "cheque_bounce",
      sale: sale._id,
      deletedAt: { $exists: false },
    });
    if (alreadyBounced) {
      return NextResponse.json({ error: "This cheque sale has already been marked as bounced." }, { status: 422 });
    }

    const amount = sale.grandTotal ?? 0;
    if (amount <= 0) {
      return NextResponse.json({ error: "This sale has no amount to bounce." }, { status: 422 });
    }

    const chequeRef = sale.chequeNumber?.trim();
    const bounceDate = resolvePakistanEntryDate(formatPakistanDateInput(body.entryDate ?? new Date()));
    const bounceDescription =
      body.description?.trim() ||
      `Cheque bounced for ${sale.invoiceNumber}${chequeRef ? ` (#${chequeRef})` : ""}${sale.bankName ? ` · ${sale.bankName}` : ""}`;

    let customer = await Customer.findOneAndUpdate(
      withShopFilter(shopId, { _id: sale.customer }),
      { $inc: { currentBalance: amount } },
      { new: true },
    );
    if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

    const bounceEntry = await LedgerEntry.create({
      shopId,
      customer: sale.customer,
      sale: sale._id,
      type: "cheque_bounce",
      debit: amount,
      credit: 0,
      balance: customer.currentBalance ?? 0,
      description: bounceDescription,
      entryDate: bounceDate,
      paymentMethod: "cheque",
      reference: sale.chequeNumber,
      bankName: sale.bankName,
      chequeDate: sale.chequeDate,
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
        `Repayment after cheque bounce for ${sale.invoiceNumber}${chequeRef ? ` (#${chequeRef})` : ""} via ${repay.paymentMethod}`;

      customer = await Customer.findOneAndUpdate(
        withShopFilter(shopId, { _id: sale.customer }),
        { $inc: { currentBalance: -amount } },
        { new: true },
      );
      if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

      repayEntry = await LedgerEntry.create({
        shopId,
        customer: sale.customer,
        sale: sale._id,
        type: "payment_received",
        debit: 0,
        credit: amount,
        balance: customer.currentBalance ?? 0,
        description: repayDescription,
        entryDate: repayDate,
        relatedEntry: bounceEntry._id,
        paymentMethod: repay.paymentMethod,
        reference: repayReference || undefined,
        bankName: usesBankName && repayBankName ? repayBankName : undefined,
        chequeDate: repay.paymentMethod === "cheque" ? repay.chequeDate ?? undefined : undefined,
        createdBy: allowed.session.user.id,
      });

      const { syncChequeBounceRepayAccounting } = await import("@/lib/accounting-sync");
      await syncChequeBounceRepayAccounting(
        shopId,
        allowed.session.user.id,
        String(repayEntry._id),
        amount,
        repay.paymentMethod,
        repayDescription,
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
