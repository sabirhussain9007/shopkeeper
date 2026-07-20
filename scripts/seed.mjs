import nextEnv from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const rolePermissions = {
  super_admin: ["shops:manage"],
  admin: ["dashboard:read", "inventory:write", "pos:write", "ledger:write", "reports:read", "settings:write", "users:write"],
  manager: ["dashboard:read", "inventory:write", "pos:write", "ledger:write", "reports:read"],
  cashier: ["pos:write", "reports:read"],
};

const defaultSettings = {
  appName: process.env.DEFAULT_APP_NAME ?? "Shopkeeper",
  appTagline: process.env.DEFAULT_APP_TAGLINE ?? "Retail Command",
  dashboardTitle: process.env.DEFAULT_DASHBOARD_TITLE ?? "Enterprise Retail Management",
  businessName: process.env.DEFAULT_BUSINESS_NAME ?? "Shopkeeper",
  address: "",
  phone: "",
  email: "",
  gstVatNumber: "",
  ntn: "",
  logo: "",
  currency: "PKR",
  taxRate: 0,
  receiptSize: "80mm",
  receiptLogoAlign: "center",
  receiptHeader: "",
  receiptFooter: "",
  thankYouMessage: "Thank you for shopping with us.",
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const uri = requireEnv("MONGODB_URI");
  const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL ?? "admin@shop.local").toLowerCase();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!";
  const adminName = process.env.DEFAULT_ADMIN_NAME ?? "System Administrator";
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "superadmin@shop.local").toLowerCase();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const superAdminName = process.env.SUPER_ADMIN_NAME ?? "Platform Super Admin";
  const resetAdminPassword = process.env.SEED_RESET_ADMIN_PASSWORD === "true";
  const overwriteSettings = process.env.SEED_OVERWRITE_SETTINGS === "true";

  if (adminPassword.length < 8) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be at least 8 characters");
  }
  if (superAdminPassword.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters");
  }

  await mongoose.connect(uri, { bufferCommands: false, maxPoolSize: 5 });

  const users = mongoose.connection.collection("users");
  const roles = mongoose.connection.collection("roles");
  const settings = mongoose.connection.collection("settings");
  const shops = mongoose.connection.collection("shops");
  const now = new Date();

  // Super admin (platform)
  const existingSuper = await users.findOne({ email: superAdminEmail, deletedAt: { $exists: false } });
  if (existingSuper) {
    const update = {
      $set: {
        name: existingSuper.name || superAdminName,
        role: "super_admin",
        permissions: rolePermissions.super_admin,
        status: "active",
        updatedAt: now,
      },
      $unset: { shopId: "" },
    };
    if (resetAdminPassword) {
      update.$set.passwordHash = await bcrypt.hash(superAdminPassword, 12);
    }
    await users.updateOne({ _id: existingSuper._id }, update);
    console.log(`Super admin ready: ${superAdminEmail}${resetAdminPassword ? " (password reset)" : ""}`);
  } else {
    await users.insertOne({
      name: superAdminName,
      email: superAdminEmail,
      passwordHash: await bcrypt.hash(superAdminPassword, 12),
      role: "super_admin",
      permissions: rolePermissions.super_admin,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Super admin created: ${superAdminEmail}`);
  }

  // Demo shop + shop admin for local development
  let shop = await shops.findOne({ slug: "demo-shop", deletedAt: { $exists: false } });
  if (!shop) {
    const insert = await shops.insertOne({
      name: process.env.DEFAULT_BUSINESS_NAME ?? "Shopkeeper",
      slug: "demo-shop",
      ownerName: adminName,
      ownerEmail: adminEmail,
      ownerPhone: "",
      plan: "monthly",
      planAmount: 1000,
      paymentMethod: "bank",
      paymentReference: "SEED-DEMO",
      paymentStatus: "approved",
      status: "active",
      startsAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    shop = await shops.findOne({ _id: insert.insertedId });
    console.log("Demo shop created: demo-shop");
  } else {
    console.log("Demo shop already exists");
  }

  const shopId = shop._id;
  const existingAdmin = await users.findOne({ email: adminEmail, deletedAt: { $exists: false } });
  let adminId = existingAdmin?._id;

  if (existingAdmin) {
    const update = {
      $set: {
        name: existingAdmin.name || adminName,
        role: "admin",
        permissions: rolePermissions.admin,
        status: "active",
        shopId,
        updatedAt: now,
      },
    };

    if (resetAdminPassword) {
      update.$set.passwordHash = await bcrypt.hash(adminPassword, 12);
    }

    await users.updateOne({ _id: adminId }, update);
    console.log(`Shop admin ready: ${adminEmail}${resetAdminPassword ? " (password reset)" : ""}`);
  } else {
    const result = await users.insertOne({
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "admin",
      permissions: rolePermissions.admin,
      status: "active",
      shopId,
      createdAt: now,
      updatedAt: now,
    });
    adminId = result.insertedId;
    console.log(`Shop admin created: ${adminEmail}`);
  }

  for (const [name, permissions] of Object.entries(rolePermissions)) {
    await roles.updateOne(
      { name },
      {
        $set: {
          name,
          permissions,
          description: `${name} default role`,
          updatedBy: adminId,
          updatedAt: now,
        },
        $setOnInsert: {
          createdBy: adminId,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
  console.log("Default roles ready: super_admin, admin, manager, cashier");

  const existingSettings = await settings.findOne({ shopId, deletedAt: { $exists: false } });
  if (!existingSettings) {
    await settings.insertOne({
      ...defaultSettings,
      shopId,
      createdBy: adminId,
      updatedBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
    console.log("Demo shop settings created");
  } else if (overwriteSettings) {
    await settings.updateOne(
      { _id: existingSettings._id },
      {
        $set: {
          ...defaultSettings,
          shopId,
          updatedBy: adminId,
          updatedAt: now,
        },
      },
    );
    console.log("Demo shop settings overwritten");
  } else {
    console.log("Demo shop settings already exist");
  }

  // Attach orphaned records (pre-SaaS data) to the demo shop
  for (const collectionName of [
    "products",
    "categories",
    "customers",
    "suppliers",
    "sales",
    "saleitems",
    "purchases",
    "purchaseitems",
    "ledgerentries",
    "stockadjustments",
  ]) {
    const col = mongoose.connection.collection(collectionName);
    const result = await col.updateMany({ shopId: { $exists: false } }, { $set: { shopId } });
    if (result.modifiedCount > 0) {
      console.log(`Backfilled shopId on ${result.modifiedCount} ${collectionName}`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
