import { Types } from "mongoose";
import { NextResponse, type NextRequest } from "next/server";
import type { Model } from "mongoose";
import type { z } from "zod";
import { logActivity } from "@/lib/activity";
import { connectDb } from "@/lib/db";
import { duplicateFieldMessage, duplicateKeyField, duplicateKeyMessage, isMongoDuplicateKeyError } from "@/lib/mongo-errors";
import { requireApiPermission } from "@/lib/rbac";
import { notDeletedFilter } from "@/lib/soft-delete";
import { withShopFilter } from "@/lib/tenant";
import { paginationSchema } from "@/schemas/domain";
import type { Permission } from "@/types";

type UniqueFieldCheck = {
  field: string;
  caseInsensitive?: boolean;
};

type CrudConfig = {
  model: Model<unknown>;
  schema: z.ZodTypeAny;
  permission: Permission;
  searchFields: string[];
  activityEntity?: string;
  uniqueFields?: UniqueFieldCheck[];
  includeDeleted?: boolean;
  listSort?: Record<string, 1 | -1>;
};

function buildListFilter(
  shopId: string | null | undefined,
  config: Pick<CrudConfig, "searchFields" | "includeDeleted">,
  params: { status?: "active" | "inactive"; q?: string },
) {
  const conditions: Record<string, unknown>[] = [withShopFilter(shopId, config.includeDeleted ? {} : notDeletedFilter)];
  if (params.status) conditions.push({ status: params.status });
  if (params.q) {
    const pattern = escapeRegex(params.q);
    conditions.push({ $or: config.searchFields.map((field) => ({ [field]: { $regex: pattern, $options: "i" } })) });
  }
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

function duplicateConflictResponse(field: string, value: string, entity?: string, deleted?: boolean) {
  const message = deleted
    ? `A deleted ${entity?.replace(/_/g, " ") ?? "record"} with this ${field} still exists (${value}). Use a different name.`
    : duplicateFieldMessage(field, value, entity);
  return NextResponse.json(
    {
      error: message,
      code: "DUPLICATE",
      fieldErrors: { [field]: [message] },
    },
    { status: 409 },
  );
}

async function findUniqueConflict(
  model: Model<unknown>,
  shopId: string,
  fields: UniqueFieldCheck[],
  data: Record<string, unknown>,
  excludeId?: string,
) {
  for (const { field, caseInsensitive } of fields) {
    const value = data[field];
    if (value === undefined || value === null || value === "") continue;

    const filter: Record<string, unknown> = withShopFilter(shopId, notDeletedFilter);
    if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };
    if (caseInsensitive && typeof value === "string") {
      filter[field] = { $regex: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };
    } else {
      filter[field] = value;
    }

    const existing = (await model.findOne(filter).lean()) as { deletedAt?: Date } | null;
    if (existing) {
      return { field, value: String(value), deleted: Boolean(existing.deletedAt) };
    }
  }
  return null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseListParams(query: Record<string, string>) {
  const parsed = paginationSchema.safeParse(query);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Invalid query parameters", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      ),
    };
  }
  return { ok: true as const, params: parsed.data };
}

function duplicateKeyResponse(error: Parameters<typeof isMongoDuplicateKeyError>[0], entity?: string) {
  if (!isMongoDuplicateKeyError(error)) return null;
  const message = duplicateKeyMessage(error, entity);
  const field = duplicateKeyField(error);
  return NextResponse.json(
    {
      error: message,
      code: "DUPLICATE",
      ...(field ? { fieldErrors: { [field]: [message] } } : {}),
    },
    { status: 409 },
  );
}

export function crudHandlers(config: CrudConfig) {
  return {
    async GET(req: NextRequest) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const shopId = allowed.session.user.shopId;
      const query = Object.fromEntries(req.nextUrl.searchParams.entries());
      const parsedParams = parseListParams(query);
      if (!parsedParams.ok) return parsedParams.response;
      const params = parsedParams.params;
      const filter = buildListFilter(shopId, config, params);
      const sort = config.listSort ?? { createdAt: -1 };
      const skip = (params.page - 1) * params.limit;
      const [items, total] = await Promise.all([
        config.model.find(filter).sort(sort).skip(skip).limit(params.limit).lean(),
        config.model.countDocuments(filter),
      ]);
      return NextResponse.json(
        serializeValue({ items, total, page: params.page, pages: Math.ceil(total / params.limit) }),
      );
    },
    async POST(req: NextRequest) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const payload = config.schema.safeParse(await req.json());
      if (!payload.success) return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
      const shopId = allowed.session.user.shopId;
      if (!shopId) {
        return NextResponse.json({ error: "No shop is linked to this account." }, { status: 403 });
      }
      if (config.uniqueFields?.length) {
        const conflict = await findUniqueConflict(config.model, shopId, config.uniqueFields, payload.data as Record<string, unknown>);
        if (conflict) return duplicateConflictResponse(conflict.field, conflict.value, config.activityEntity, conflict.deleted);
      }
      try {
        const created = await config.model.create({
          ...(payload.data as object),
          shopId: allowed.session.user.shopId,
          createdBy: allowed.session.user.id,
        });
        if (config.activityEntity) {
          await logActivity({
            shopId: allowed.session.user.shopId,
            userId: allowed.session.user.id,
            userName: allowed.session.user.name,
            userEmail: allowed.session.user.email,
            userRole: allowed.session.user.role,
            action: `${config.activityEntity}.created`,
            entity: config.activityEntity,
            entityId: String((created as { _id?: unknown })._id ?? ""),
            description: `Created ${config.activityEntity}`,
            req,
          });
        }
        return NextResponse.json(created, { status: 201 });
      } catch (error) {
        const duplicate = duplicateKeyResponse(error, config.activityEntity);
        if (duplicate) return duplicate;
        throw error;
      }
    },
  };
}

function itemFilter(shopId: string | null | undefined, id: string, includeDeleted?: boolean) {
  return withShopFilter(shopId, includeDeleted ? { _id: id } : { _id: id, ...notDeletedFilter });
}

export function crudItemHandlers(config: CrudConfig) {
  return {
    async GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const { id } = await params;
      const item = await config.model.findOne(itemFilter(allowed.session.user.shopId, id, config.includeDeleted)).lean();
      if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(item);
    },
    async PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const body = await req.json();
      const partialSchema =
        "partial" in config.schema && typeof config.schema.partial === "function"
          ? (config.schema as z.ZodObject<z.ZodRawShape>).partial()
          : config.schema;
      const payload = partialSchema.safeParse(body);
      if (!payload.success) return NextResponse.json({ error: "Validation failed", fieldErrors: payload.error.flatten().fieldErrors }, { status: 422 });
      const { id } = await params;
      const shopId = allowed.session.user.shopId;
      if (!shopId) {
        return NextResponse.json({ error: "No shop is linked to this account." }, { status: 403 });
      }
      if (config.uniqueFields?.length) {
        const conflict = await findUniqueConflict(
          config.model,
          shopId,
          config.uniqueFields,
          payload.data as Record<string, unknown>,
          id,
        );
        if (conflict) return duplicateConflictResponse(conflict.field, conflict.value, config.activityEntity, conflict.deleted);
      }
      try {
        const updated = await config.model.findOneAndUpdate(
          itemFilter(allowed.session.user.shopId, id, config.includeDeleted),
          { $set: { ...(payload.data as object), updatedBy: allowed.session.user.id } },
          { new: true },
        );
        if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (config.activityEntity) {
          await logActivity({
            shopId: allowed.session.user.shopId,
            userId: allowed.session.user.id,
            userName: allowed.session.user.name,
            userEmail: allowed.session.user.email,
            userRole: allowed.session.user.role,
            action: `${config.activityEntity}.updated`,
            entity: config.activityEntity,
            entityId: id,
            description: `Updated ${config.activityEntity}`,
            req,
          });
        }
        return NextResponse.json(updated);
      } catch (error) {
        const duplicate = duplicateKeyResponse(error, config.activityEntity);
        if (duplicate) return duplicate;
        throw error;
      }
    },
    async DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const allowed = await requireApiPermission(config.permission);
      if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: allowed.status });
      await connectDb();
      const { id } = await params;
      const deleted = await config.model.findOneAndDelete(withShopFilter(allowed.session.user.shopId, { _id: id }));
      if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (config.activityEntity) {
        await logActivity({
          shopId: allowed.session.user.shopId,
          userId: allowed.session.user.id,
          userName: allowed.session.user.name,
          userEmail: allowed.session.user.email,
          userRole: allowed.session.user.role,
          action: `${config.activityEntity}.deleted`,
          entity: config.activityEntity,
          entityId: id,
          description: `Deleted ${config.activityEntity}`,
          req,
        });
      }
      return NextResponse.json({ ok: true });
    },
  };
}
