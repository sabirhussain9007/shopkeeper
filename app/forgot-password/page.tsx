import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { PageBackground } from "@/components/layout/page-background";

export default function ForgotPasswordPage() {
  return (
    <main className="relative grid min-h-screen place-items-center px-4 py-10 md:px-8">
      <PageBackground />
      <div className="relative w-full max-w-md">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
