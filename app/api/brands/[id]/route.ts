import { Brand } from "@/models";
import { brandSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Brand,
  schema: brandSchema,
  permission: "inventory:write",
  searchFields: ["name", "description"],
  activityEntity: "brand",
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
