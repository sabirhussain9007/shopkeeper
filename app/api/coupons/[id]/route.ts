import { Coupon } from "@/models";
import { couponSchema } from "@/schemas/domain";
import { crudItemHandlers } from "@/lib/crud";

const handlers = crudItemHandlers({
  model: Coupon,
  schema: couponSchema,
  permission: "pos:write",
  searchFields: ["code"],
  activityEntity: "coupon",
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
