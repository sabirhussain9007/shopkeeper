import { Warehouse } from "@/models";
import { warehouseSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Warehouse,
  schema: warehouseSchema,
  permission: "inventory:write",
  searchFields: ["name", "code", "address"],
  activityEntity: "warehouse",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
