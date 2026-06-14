"use server";

import { revalidatePath } from "next/cache";
import { connectDb } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { Customer, LedgerEntry } from "@/models";
import { ledgerEntrySchema } from "@/schemas/domain";

export async function recordLedgerEntry(input: unknown) {
  const session = await requirePermission("ledger:write");
  const parsed = ledgerEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  await connectDb();
  const delta = parsed.data.debit - parsed.data.credit;
  const customer = await Customer.findByIdAndUpdate(parsed.data.customer, { $inc: { currentBalance: delta } }, { new: true });
  if (!customer) return { ok: false, error: "Customer not found" };
  await LedgerEntry.create({ ...parsed.data, balance: customer.currentBalance, createdBy: session.user.id });
  revalidatePath("/ledger");
  return { ok: true };
}
