import { Setting } from "@/models";
import { settingsSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Setting,
  schema: settingsSchema,
  permission: "settings:write",
  searchFields: ["businessName","phone"],
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
