import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f4ed] p-6 dark:bg-zinc-950">
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
