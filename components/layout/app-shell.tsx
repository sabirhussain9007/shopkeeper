import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ResponsiveNavbar } from "@/components/layout/responsive-navbar";
import { authOptions } from "@/lib/auth";
import { getActiveSettings } from "@/lib/settings";
import type { Role } from "@/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const settings = await getActiveSettings();

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <ResponsiveNavbar role={session.user.role as Role} email={session.user.email} appName={settings.appName} appTagline={settings.appTagline} logo={settings.logo ?? undefined} />
      <main className="mx-auto min-w-0 max-w-7xl p-4 md:p-8">
        <header className="mb-6 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Signed in as {session.user.email}</p>
          <h1 className="text-2xl font-semibold">{settings.dashboardTitle}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}
