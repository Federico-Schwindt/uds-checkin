"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_LEN = 8;

export function PinPad() {
  const router = useRouter();
  const params = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      if (busy || !value) return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: value }),
        });
        if (res.ok) {
          const next = params.get("next") || "/";
          router.replace(next.startsWith("/") ? next : "/");
          router.refresh();
          return;
        }
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Incorrect PIN");
        setPin("");
        setShake(true);
        setTimeout(() => setShake(false), 450);
      } catch {
        setError("Connection error. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, params, router]
  );

  const press = useCallback(
    (d: string) => {
      setError("");
      setPin((p) => (p.length >= MAX_LEN ? p : p + d));
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter") submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pin, press, submit]);

  return (
    <div>
      <div className={cn("flex justify-center gap-3 h-6 mb-2", shake && "animate-shake")}>
        {pin.length === 0 ? (
          <span className="text-ink-600 text-sm select-none">• • • •</span>
        ) : (
          Array.from({ length: pin.length }).map((_, i) => (
            <span key={i} className="w-3.5 h-3.5 rounded-full bg-brand-500 inline-block" />
          ))
        )}
      </div>
      <p className={cn("text-center text-sm h-5 mb-4", error ? "text-brand-400" : "text-transparent")}>
        {error || "."}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        <Key onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">
          <Delete className="w-6 h-6 mx-auto" />
        </Key>
        <Key onClick={() => press("0")}>0</Key>
        <button
          onClick={() => submit(pin)}
          disabled={busy || !pin}
          className={cn(
            "h-16 rounded-2xl text-lg font-semibold transition-all select-none",
            "bg-brand-600 text-white active:scale-95 hover:bg-brand-500",
            "disabled:opacity-40 disabled:active:scale-100"
          )}
        >
          {busy ? "…" : "Enter"}
        </button>
      </div>
    </div>
  );
}

function Key({ children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className="h-16 rounded-2xl bg-ink-800 text-white text-2xl font-medium transition-all select-none active:scale-95 active:bg-ink-700 hover:bg-ink-700"
      {...rest}
    >
      {children}
    </button>
  );
}
