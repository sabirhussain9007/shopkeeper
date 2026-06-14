import { Suspense } from "react";
import { SignupForm } from "@/features/auth/signup-form";
import { connectDb } from "@/lib/db";
import { Setting, User } from "@/models";

const fallbackBusinessName = "Shopkeeper";

export default async function SignupPage() {
  await connectDb();
  const [adminExists, settings] = await Promise.all([
    User.exists({ role: "admin", status: "active", deletedAt: { $exists: false } }),
    Setting.findOne({ deletedAt: { $exists: false } }).sort({ updatedAt: -1 }).select("businessName").lean(),
  ]);
  const businessName = settings?.businessName || fallbackBusinessName;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f4ed] p-6 dark:bg-zinc-950">
      <Suspense>
        <SignupForm canSignup={!adminExists} businessName={businessName} />
      </Suspense>
    </main>
  );
}
