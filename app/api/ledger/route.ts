import { LedgerEntry } from "@/models";
import { ledgerEntrySchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: LedgerEntry,
  schema: ledgerEntrySchema,
  permission: "ledger:write",
  searchFields: ["description"],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
