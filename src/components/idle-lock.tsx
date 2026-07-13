"use client";

import { useEffect } from "react";

/** Locks the station after N minutes without interaction. Disabled when minutes <= 0. */
export function IdleLock({ minutes }: { minutes: number }) {
  useEffect(() => {
    if (!minutes || minutes <= 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const lock = async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        window.location.href = "/lock";
      }
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, minutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes]);
  return null;
}
