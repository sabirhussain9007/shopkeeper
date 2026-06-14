import { Customer } from "@/models";
import { customerSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Customer,
  schema: customerSchema,
  permission: "ledger:write",
  searchFields: ["name","phone"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
