import { CustomerGroup } from "@/models";
import { customerGroupSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: CustomerGroup,
  schema: customerGroupSchema,
  permission: "ledger:write",
  searchFields: ["name", "description"],
  activityEntity: "customer_group",
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
