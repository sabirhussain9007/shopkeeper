import { Suspense } from "react";
import { PageBackground } from "@/components/layout/page-background";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-10 md:px-8 md:py-14">
      <PageBackground />
      <div className="relative grid min-h-[calc(100vh-5rem)] place-items-center">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
