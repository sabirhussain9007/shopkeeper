import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f4ed] p-6 dark:bg-zinc-950">
      <ForgotPasswordForm />
    </main>
  );
}
