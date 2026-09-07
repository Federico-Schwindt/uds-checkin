"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Delete, LogIn, ShieldCheck, Wrench } from "lucide-react";
import { Spinner } from "@/components/ui";
import { PIN_MAX } from "@/lib/password-rules";
import { cn } from "@/lib/utils";

type Profile = {
  name: string;
  username: string;
  role: string;
  title: string;
  canSignIn: boolean;
};

type Shop = {
  open: boolean;
  signInAllowed: boolean;
  reason: string;
  schedule: string[];
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [manual, setManual] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/profiles")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setProfiles(j.profiles || []);
        setShop(j.shop || null);
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pick = (p: Profile) => {
    setSelected(p);
    setUsername(p.username);
    setPin("");
    setError("");
  };

  const back = () => {
    setSelected(null);
    setManual(false);
    setUsername("");
    setPin("");
    setError("");
  };

  const submit = useCallback(
    async (value: string) => {
      if (busy || !username || !value) return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password: value }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const next = params.get("next") || data.redirect || "/";
          router.replace(next.startsWith("/") ? next : "/");
          router.refresh();
          return;
        }
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
    [busy, params, router, username]
  );

  const press = useCallback((digit: string) => {
    setError("");
    setPin((p) => (p.length >= PIN_MAX ? p : p + digit));
  }, []);

  // A physical keyboard works too, for anyone signing in from a desk.
  useEffect(() => {
    if (!selected && !manual) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === usernameRef.current) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter") submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manual, pin, press, selected, submit]);

  if (profiles === null) {
    return (
      <div className="py-14 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  /* ---------- step 2: PIN ---------- */
  if (selected || manual) {
    const locked = selected ? !selected.canSignIn : false;
    return (
      <div className="animate-fade-up">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> All profiles
        </button>

        {selected && (
          <div className="flex items-center gap-3 mb-5">
            <Avatar name={selected.name} role={selected.role} />
            <div className="min-w-0">
              <p className="font-bold text-ink-900 leading-tight truncate">{selected.name}</p>
              <p className="text-[13px] text-ink-500 truncate">{selected.title || roleLabel(selected.role)}</p>
            </div>
          </div>
        )}

        {manual && (
          <label className="block mb-4">
            <span className="text-[13px] font-semibold text-ink-700">Username</span>
            <input
              ref={usernameRef}
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1.5 w-full h-12 px-3.5 rounded-xl border border-ink-300 bg-white text-[15px] focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
            />
          </label>
        )}

        <p className="text-center text-[13px] font-semibold text-ink-600 mb-3">Enter your PIN</p>

        {/* One dot per digit entered */}
        <div className={cn("flex justify-center items-center gap-3 h-6 mb-2", shake && "animate-shake")}>
          {pin.length === 0 ? (
            <span className="text-ink-400 text-sm select-none tracking-widest">• • • •</span>
          ) : (
            Array.from({ length: pin.length }).map((_, i) => (
              <span key={i} className="w-3.5 h-3.5 rounded-full bg-brand-600 inline-block" />
            ))
          )}
        </div>

        <p className={cn("text-center text-sm h-5 mb-3", error ? "text-brand-600 font-medium" : "text-transparent")}>
          {error || "."}
        </p>

        {locked && shop ? (
          <p className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[13px] px-3.5 py-2.5">
            {shop.reason || "Sign-in is closed outside working hours."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <Key key={d} onClick={() => press(d)} disabled={busy}>
                {d}
              </Key>
            ))}
            <Key onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy} aria-label="Delete">
              <Delete className="w-6 h-6 mx-auto" />
            </Key>
            <Key onClick={() => press("0")} disabled={busy}>
              0
            </Key>
            <button
              type="button"
              onClick={() => submit(pin)}
              disabled={busy || !pin || !username}
              className={cn(
                "h-16 rounded-2xl text-lg font-semibold transition-all select-none",
                "bg-brand-600 text-white active:scale-95 hover:bg-brand-700",
                "disabled:opacity-40 disabled:active:scale-100 inline-flex items-center justify-center gap-2"
              )}
            >
              {busy ? <Spinner className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ---------- step 1: pick a profile ---------- */
  return (
    <div className="animate-fade-up">
      {shop && (
        <div
          className={cn(
            "mb-5 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium border",
            shop.open
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-ink-100 border-ink-200 text-ink-600"
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", shop.open ? "bg-emerald-500" : "bg-ink-400")} />
          {shop.open ? "Shop is open" : "Shop is closed"}
          <span className="ml-auto text-ink-500 font-normal">{shop.schedule[0]}</span>
        </div>
      )}

      <div className="space-y-2">
        {profiles.map((p) => (
          <button
            key={p.username}
            onClick={() => pick(p)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-[0.99]",
              p.canSignIn
                ? "border-ink-200 bg-white hover:border-brand-400 hover:shadow-card"
                : "border-ink-200 bg-ink-50"
            )}
          >
            <Avatar name={p.name} role={p.role} muted={!p.canSignIn} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink-900 leading-tight truncate">{p.name}</span>
              <span className="block text-[13px] text-ink-500 truncate">{p.title || roleLabel(p.role)}</span>
            </span>
            {!p.canSignIn && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 shrink-0">
                Off shift
              </span>
            )}
          </button>
        ))}
        {profiles.length === 0 && (
          <p className="text-center text-sm text-ink-500 py-6">
            No staff profiles found. Sign in with the admin account below.
          </p>
        )}
      </div>

      <button
        onClick={() => {
          setManual(true);
          setUsername("");
        }}
        className="mt-4 w-full text-center text-[13px] font-semibold text-brand-700 hover:text-brand-800"
      >
        Sign in with a username instead
      </button>

      {shop && shop.schedule.length > 0 && (
        <div className="mt-6 pt-4 border-t border-ink-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">Working hours</p>
          <ul className="text-[13px] text-ink-600 space-y-0.5">
            {shop.schedule.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function roleLabel(role: string): string {
  return role === "admin" ? "Administrator" : "Technician";
}

function Avatar({ name, role, muted }: { name: string; role: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm relative",
        muted ? "bg-ink-200 text-ink-500" : role === "admin" ? "bg-ink-900 text-white" : "bg-brand-600 text-white"
      )}
    >
      {initials(name)}
      <span
        className={cn(
          "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center",
          role === "admin" ? "bg-ink-700" : "bg-brand-500"
        )}
      >
        {role === "admin" ? (
          <ShieldCheck className="w-3 h-3 text-white" />
        ) : (
          <Wrench className="w-3 h-3 text-white" />
        )}
      </span>
    </span>
  );
}

function Key({
  children,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-16 rounded-2xl bg-ink-100 border border-ink-200 text-ink-800 text-2xl font-semibold transition-all select-none active:scale-95 active:bg-ink-200 hover:bg-ink-200/70 disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}
