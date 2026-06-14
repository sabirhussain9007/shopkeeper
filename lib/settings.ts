import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Setting } from "@/models";
import { settingsSchema } from "@/schemas/domain";
import type { SettingsInput } from "@/types";

export const defaultSettings: SettingsInput = {
  appName: "Shopkeeper",
  appTagline: "Retail Command",
  dashboardTitle: "Enterprise Retail Management",
  businessName: "Shopkeeper",
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

export async function getActiveSettings() {
  await connectDb();
  const setting = await Setting.findOne({ deletedAt: { $exists: false } }).sort({ updatedAt: -1 }).lean();
  if (!setting) return { ...defaultSettings, _id: null as string | null };
  const { _id, ...rest } = setting;
  const settings = { ...defaultSettings, ...rest, _id: _id.toString() };
  if (settings.phone === defaultSettings.thankYouMessage) settings.phone = "";
  return settings;
}

export async function upsertSettings(input: SettingsInput, userId: string) {
  const parsed = settingsSchema.parse(input);
  await connectDb();
  const existing = await Setting.findOne({ deletedAt: { $exists: false } }).sort({ updatedAt: -1 });

  if (existing) {
    Object.assign(existing, parsed, { updatedBy: new Types.ObjectId(userId) });
    await existing.save();
    return existing;
  }

  return Setting.create({ ...parsed, createdBy: userId, updatedBy: userId });
}
