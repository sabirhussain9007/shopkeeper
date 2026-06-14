import { Customer } from "@/models";
import { customerSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Customer,
  schema: customerSchema,
  permission: "ledger:write",
  searchFields: ["name","phone"],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
