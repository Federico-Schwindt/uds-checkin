"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LogIn, ShieldCheck, Wrench } from "lucide-react";
import { Spinner } from "@/components/ui";
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
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

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
    setPassword("");
    setError("");
    setTimeout(() => passwordRef.current?.focus(), 50);
  };

  const back = () => {
    setSelected(null);
    setManual(false);
    setUsername("");
    setPassword("");
    setError("");
  };

  const submit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (busy || !username || !password) return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const next = params.get("next") || data.redirect || "/";
          router.replace(next.startsWith("/") ? next : "/");
          router.refresh();
          return;
        }
        setError(data.error || "Incorrect username or password");
        setPassword("");
        setShake(true);
        setTimeout(() => setShake(false), 450);
      } catch {
        setError("Connection error. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, params, password, router, username]
  );

  if (profiles === null) {
    return (
      <div className="py-14 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  /* ---------- step 2: password ---------- */
  if (selected || manual) {
    const locked = selected ? !selected.canSignIn : false;
    return (
      <form onSubmit={submit} className={cn("animate-fade-up", shake && "animate-shake")}>
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
          <label className="block mb-3">
            <span className="text-[13px] font-semibold text-ink-700">Username</span>
            <input
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

        <label className="block">
          <span className="text-[13px] font-semibold text-ink-700">Password</span>
          <div className="relative mt-1.5">
            <input
              ref={passwordRef}
              type={reveal ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={locked}
              className="w-full h-12 pl-3.5 pr-12 rounded-xl border border-ink-300 bg-white text-[15px] tracking-wide focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 disabled:bg-ink-100"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1.5 w-9 h-9 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 flex items-center justify-center"
            >
              {reveal ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          </div>
        </label>

        {locked && shop && (
          <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[13px] px-3.5 py-2.5">
            {shop.reason || "Sign-in is closed outside working hours."}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-[13px] px-3.5 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password || !username || locked}
          className="mt-5 w-full h-13 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 inline-flex items-center justify-center gap-2"
        >
          {busy ? <Spinner className="w-5 h-5" /> : <LogIn className="w-4.5 h-4.5" />}
          Sign in
        </button>
      </form>
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
