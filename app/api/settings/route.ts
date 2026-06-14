import { Setting } from "@/models";
import { settingsSchema } from "@/schemas/domain";
import { crudHandlers } from "@/lib/crud";

const handlers = crudHandlers({
  model: Setting,
  schema: settingsSchema,
  permission: "settings:write",
  searchFields: ["businessName","phone"],
});

export const GET = handlers.GET;
export const POST = handlers.POST;
