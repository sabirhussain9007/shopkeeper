import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBackground } from "@/components/layout/page-background";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-10 md:px-8">
      <PageBackground />
      <div className="relative w-full max-w-md">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
