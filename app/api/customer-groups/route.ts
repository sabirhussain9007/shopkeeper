import { CustomerGroup } from "@/models";
import { customerGroupSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: CustomerGroup,
  schema: customerGroupSchema,
  permission: "ledger:write",
  searchFields: ["name", "description"],
  activityEntity: "customer_group",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
