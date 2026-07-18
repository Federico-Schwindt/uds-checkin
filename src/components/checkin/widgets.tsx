"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { Button, Card, Field, Input, SectionTitle } from "@/components/ui";
import { cn, formatPhone } from "@/lib/utils";
import type { PartLine } from "./types";

/* ---------------- customer search ---------------- */

export type CustomerHit = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  smsConsent: boolean;
};

export function CustomerSearchWidget({
  customerId,
  onPick,
  onDetach,
}: {
  customerId: number | null;
  onPick: (c: CustomerHit) => void;
  onDetach: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears results when the query is emptied
      setHits([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setHits(json.customers || []);
          setOpen(true);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Search Existing Customer</SectionTitle>
      <div className="relative" ref={boxRef}>
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by phone number or name…"
          className="pl-11"
          inputMode="search"
        />
        {searching && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">Searching…</span>}
        {open && hits.length > 0 && (
          <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-ink-200 shadow-pop overflow-hidden max-h-72 overflow-y-auto">
            {hits.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onPick(c);
                  setQuery("");
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ink-50 border-b border-ink-100 last:border-0"
              >
                <span className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center shrink-0">
                  <UserRound className="w-4.5 h-4.5 text-ink-500" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink-900 truncate">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="block text-sm text-ink-500 truncate">
                    {formatPhone(c.phone)}
                    {c.email ? ` · ${c.email}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        {open && hits.length === 0 && !searching && (
          <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-ink-200 shadow-pop px-4 py-3 text-sm text-ink-500">
            No customers found — fill in the details below to create a new one.
          </div>
        )}
      </div>
      {customerId && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            Existing customer #{customerId} loaded
            <button type="button" onClick={onDetach} className="hover:text-emerald-900" aria-label="Detach customer">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}
    </Card>
  );
}

/* ---------------- parts table ---------------- */

export function PartsTableWidget({
  parts,
  onChange,
  label = "Parts Used on This Order",
}: {
  parts: PartLine[];
  onChange: (p: PartLine[]) => void;
  label?: string;
}) {
  const update = (i: number, patch: Partial<PartLine>) =>
    onChange(parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>{label}</SectionTitle>
      <div className="space-y-3">
        {parts.length === 0 && <p className="text-sm text-ink-500">No parts added yet.</p>}
        {parts.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_84px_110px_44px] max-sm:grid-cols-[1fr_84px_44px] gap-2 items-end">
            <Field label={i === 0 ? "Part SKU" : undefined}>
              <Input value={p.sku} onChange={(e) => update(i, { sku: e.target.value })} placeholder="Scan or type SKU" />
            </Field>
            <Field label={i === 0 ? "Part name" : undefined} className="max-sm:hidden">
              <Input value={p.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Description" />
            </Field>
            <Field label={i === 0 ? "Qty" : undefined}>
              <Input
                value={String(p.qty)}
                onChange={(e) => update(i, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                inputMode="numeric"
                className="text-center"
              />
            </Field>
            <Field label={i === 0 ? "Price" : undefined} className="max-sm:hidden">
              <Input value={p.price} onChange={(e) => update(i, { price: e.target.value })} inputMode="decimal" placeholder="$" />
            </Field>
            <Button
              variant="danger"
              type="button"
              className="w-11 px-0"
              onClick={() => onChange(parts.filter((_, idx) => idx !== i))}
              aria-label="Remove part"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => onChange([...parts, { sku: "", name: "", qty: 1, price: "" }])}>
          <Plus className="w-4.5 h-4.5" /> Add part
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- driveshaft designer ---------------- */

function ShaftDiagram({ pieces }: { pieces: 1 | 2 }) {
  return (
    <svg viewBox="0 0 240 60" className="w-full h-16">
      {pieces === 1 ? (
        <g fill="none" stroke="currentColor" strokeWidth="3">
          <rect x="14" y="22" width="24" height="16" rx="3" />
          <line x1="38" y1="30" x2="202" y2="30" strokeWidth="10" strokeLinecap="round" />
          <rect x="202" y="22" width="24" height="16" rx="3" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="3">
          <rect x="10" y="22" width="22" height="16" rx="3" />
          <line x1="32" y1="30" x2="105" y2="30" strokeWidth="10" strokeLinecap="round" />
          <circle cx="120" cy="30" r="9" strokeWidth="4" />
          <line x1="135" y1="30" x2="208" y2="30" strokeWidth="10" strokeLinecap="round" />
          <rect x="208" y="22" width="22" height="16" rx="3" />
        </g>
      )}
    </svg>
  );
}

export function DriveshaftDesignerWidget({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Driveshaft Designer</SectionTitle>
      <Field label="Type of Driveshaft" hint="Select the configuration for this job">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
          {options.map((t) => {
            const active = value === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange(active ? "" : t)}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all text-left active:scale-[0.99]",
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-500/25"
                    : "border-ink-300 bg-white text-ink-500 hover:border-ink-400"
                )}
              >
                <ShaftDiagram pieces={t.toLowerCase().includes("one") ? 1 : 2} />
                <span className={cn("block text-center font-bold mt-2", active ? "text-brand-800" : "text-ink-700")}>{t}</span>
              </button>
            );
          })}
        </div>
      </Field>
    </Card>
  );
}
