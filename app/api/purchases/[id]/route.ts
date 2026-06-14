import { Purchase } from "@/models";
import { purchaseSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Purchase,
  schema: purchaseSchema,
  permission: "inventory:write",
  searchFields: ["status"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
