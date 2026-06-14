import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

loadEnvConfig(process.cwd());

const rolePermissions = {
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
  const resetAdminPassword = process.env.SEED_RESET_ADMIN_PASSWORD === "true";
  const overwriteSettings = process.env.SEED_OVERWRITE_SETTINGS === "true";

  if (adminPassword.length < 8) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be at least 8 characters");
  }

  await mongoose.connect(uri, { bufferCommands: false, maxPoolSize: 5 });

  const users = mongoose.connection.collection("users");
  const roles = mongoose.connection.collection("roles");
  const settings = mongoose.connection.collection("settings");
  const now = new Date();

  const existingAdmin = await users.findOne({ email: adminEmail, deletedAt: { $exists: false } });
  let adminId = existingAdmin?._id;

  if (existingAdmin) {
    const update = {
      $set: {
        name: existingAdmin.name || adminName,
        role: "admin",
        permissions: rolePermissions.admin,
        status: "active",
        updatedAt: now,
      },
    };

    if (resetAdminPassword) {
      update.$set.passwordHash = await bcrypt.hash(adminPassword, 12);
    }

    await users.updateOne({ _id: adminId }, update);
    console.log(`Admin ready: ${adminEmail}${resetAdminPassword ? " (password reset)" : ""}`);
  } else {
    const result = await users.insertOne({
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "admin",
      permissions: rolePermissions.admin,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    adminId = result.insertedId;
    console.log(`Admin created: ${adminEmail}`);
  }

  for (const [name, permissions] of Object.entries(rolePermissions)) {
    await roles.updateOne(
      { name },
      {
        $set: {
          name,
          permissions,
          description: `${name[0].toUpperCase()}${name.slice(1)} default role`,
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
  console.log("Default roles ready: admin, manager, cashier");

  const existingSettings = await settings.findOne({ deletedAt: { $exists: false } });
  if (!existingSettings) {
    await settings.insertOne({
      ...defaultSettings,
      createdBy: adminId,
      updatedBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
    console.log("Default settings created");
  } else if (overwriteSettings) {
    await settings.updateOne(
      { _id: existingSettings._id },
      {
        $set: {
          ...defaultSettings,
          updatedBy: adminId,
          updatedAt: now,
        },
      },
    );
    console.log("Default settings overwritten");
  } else {
    const missingSettings = Object.fromEntries(Object.entries(defaultSettings).filter(([key]) => existingSettings[key] === undefined));
    if (Object.keys(missingSettings).length > 0) {
      await settings.updateOne(
        { _id: existingSettings._id },
        {
          $set: {
            ...missingSettings,
            updatedBy: adminId,
            updatedAt: now,
          },
        },
      );
      console.log("Default settings backfilled");
    } else {
      console.log("Settings already exist");
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
