"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { SessionTimeout } from "@/components/layout/session-timeout";
import { AppThemeProvider } from "@/components/layout/theme-provider";

function DeferredSessionTimeout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enable = () => setReady(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(enable, 500);
    return () => clearTimeout(timer);
  }, []);

  return ready ? <SessionTimeout /> : null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <DeferredSessionTimeout />
          {children}
          <Toaster richColors position="top-right" />
        </AppThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
