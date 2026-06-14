import { Suspense } from "react";
import { LoginForm } from "@/features/auth/login-form";
import { connectDb } from "@/lib/db";
import { Setting } from "@/models";

const fallbackBusinessName = "Shopkeeper";

export default async function LoginPage() {
  await connectDb();
  const settings = await Setting.findOne({ deletedAt: { $exists: false } }).sort({ updatedAt: -1 }).select("businessName").lean();
  const businessName = settings?.businessName || fallbackBusinessName;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f4ed] p-6 dark:bg-zinc-950">
      <Suspense>
        <LoginForm businessName={businessName} />
      </Suspense>
    </main>
  );
}
