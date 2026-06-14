import { LedgerEntry } from "@/models";
import { ledgerEntrySchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: LedgerEntry,
  schema: ledgerEntrySchema,
  permission: "ledger:write",
  searchFields: ["description"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
