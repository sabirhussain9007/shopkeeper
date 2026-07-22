import { Warehouse } from "@/models";
import { warehouseSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Warehouse,
  schema: warehouseSchema,
  permission: "inventory:write",
  searchFields: ["name", "code", "address"],
  activityEntity: "warehouse",
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
