"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, RotateCcw, Search, UserPlus, X } from "lucide-react";
import { Spinner } from "@/components/ui";
import { cn, formatPhone } from "@/lib/utils";

const DRAFT_KEY = "uds-checkin-draft";

type CustomerHit = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  email: string;
  city: string;
  state: string;
};

type Draft = { name: string; step: number } | null;

/** Reads the autosaved wizard draft so a half-finished check-in is never lost. */
function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const name = `${saved?.data?.firstName ?? ""} ${saved?.data?.lastName ?? ""}`.trim();
    const hasContent = name || saved?.data?.phone || (saved?.step ?? 0) > 0;
    if (!hasContent) return null;
    return { name, step: (saved.step ?? 0) + 1 };
  } catch {
    return null;
  }
}

/**
 * The way every check-in starts. The button opens a quick-start: pick a returning
 * customer and the wizard opens with their details already in, start a clean one
 * for somebody new, or pick up the check-in that was left half-finished.
 */
export function NewCheckinButton({
  variant = "header",
  className,
}: {
  variant?: "header" | "hero" | "fab";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "fab" ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="New check-in"
          className={cn(
            "lg:hidden fixed bottom-5 right-5 z-30 h-16 w-16 rounded-2xl bg-brand-600 text-white shadow-pop",
            "flex items-center justify-center active:scale-95 transition-transform no-print",
            className
          )}
        >
          <Plus className="w-8 h-8" strokeWidth={2.5} />
        </button>
      ) : variant === "hero" ? (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "group w-full flex items-center gap-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white",
            "px-5 py-4 shadow-card active:scale-[0.99] transition-all text-left no-print",
            className
          )}
        >
          <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <ClipboardList className="w-6 h-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold leading-tight">Start a new check-in</span>
            <span className="block text-[13px] text-white/80">
              Look up a returning customer, or start fresh
            </span>
          </span>
          <Plus className="w-6 h-6 ml-auto shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white",
            "text-[15px] font-bold shadow-sm active:scale-[0.98] transition-all no-print",
            className
          )}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="max-sm:hidden">New check-in</span>
          <span className="sm:hidden">New</span>
        </button>
      )}

      {open && <QuickStart onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickStart({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  // Safe as a lazy initializer: this dialog only ever mounts after a click, so
  // localStorage is there and there is no server render to mismatch.
  const [draft] = useState<Draft>(readDraft);
  const [going, setGoing] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears results when the query is emptied
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const json = await res.json();
          setHits(json.customers || []);
        }
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback(
    (href: string, label: string) => {
      setGoing(label);
      router.push(href);
    },
    [router]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Start a check-in"
    >
      <button className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-pop border border-ink-200/70 overflow-hidden animate-fade-up mt-10 sm:mt-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <h2 className="font-bold text-lg">Start a check-in</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-ink-400 hover:text-ink-800 hover:bg-ink-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {draft && (
            <button
              onClick={() => go("/checkin", "draft")}
              className="w-full flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100/70 transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-amber-700 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-amber-900">
                  Continue the check-in in progress
                </span>
                <span className="block text-[13px] text-amber-800 truncate">
                  {draft.name ? `${draft.name} · ` : ""}stopped on step {draft.step}
                </span>
              </span>
              {going === "draft" && <Spinner className="w-4 h-4 text-amber-700" />}
            </button>
          )}

          <div>
            <label className="text-[13px] font-semibold text-ink-700">Returning customer</label>
            <div className="relative mt-1.5">
              <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Phone number or name…"
                inputMode="search"
                className="w-full h-13 py-3.5 pl-11 pr-10 rounded-xl border border-ink-300 bg-white text-[15px] placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
              />
              {searching && <Spinner className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />}
            </div>

            {query.trim().length >= 2 && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
                {hits.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => go(`/checkin?customer=${c.id}`, `c${c.id}`)}
                    className="w-full text-left px-4 py-3 hover:bg-ink-50 transition-colors flex items-center gap-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink-900 truncate">
                        {c.firstName} {c.lastName}
                        {c.companyName && <span className="font-normal text-ink-500"> · {c.companyName}</span>}
                      </span>
                      <span className="block text-[13px] text-ink-500 truncate">
                        {formatPhone(c.phone)}
                        {c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ""}` : ""}
                      </span>
                    </span>
                    {going === `c${c.id}` && <Spinner className="w-4 h-4 text-brand-600" />}
                  </button>
                ))}
                {!searching && hits.length === 0 && (
                  <p className="px-4 py-6 text-center text-[13px] text-ink-400">
                    Nobody matches. Start a new customer below.
                  </p>
                )}
              </div>
            )}
            {query.trim().length < 2 && (
              <p className="text-[12px] text-ink-400 mt-1.5">
                Their details fill in automatically — no need to type the address again.
              </p>
            )}
          </div>

          <button
            onClick={() => go("/checkin?fresh=1", "fresh")}
            className="w-full flex items-center gap-3 rounded-xl border border-ink-300 bg-white px-4 py-3.5 text-left hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
          >
            <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink-900">New customer</span>
              <span className="block text-[13px] text-ink-500">Start a blank check-in</span>
            </span>
            {going === "fresh" && <Spinner className="w-4 h-4 text-brand-600" />}
          </button>
        </div>
      </div>
    </div>
  );
}
