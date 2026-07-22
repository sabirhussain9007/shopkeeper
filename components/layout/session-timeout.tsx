"use client";

import { useCallback, useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_MS = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES ?? 30) * 60 * 1000;
const RESET_THROTTLE_MS = 1000;

export function SessionTimeout() {
  const { status } = useSession();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReset = useRef(0);

  const resetTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void signOut({ callbackUrl: "/login?timeout=1" });
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset.current < RESET_THROTTLE_MS) return;
      lastReset.current = now;
      resetTimer();
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    resetTimer();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [status, resetTimer]);

  return null;
}
