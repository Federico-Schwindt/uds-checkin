"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import { Card, Field, Input, CheckboxRow, ChoiceChips, SectionTitle } from "@/components/ui";
import { formatPhone } from "@/lib/utils";
import formOptions from "@/lib/form-options.json";
import legalTexts from "@/lib/legal-texts.json";
import type { StepProps } from "../types";

type CustomerHit = {
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

export function StepCustomer({ data, set, errors }: StepProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear results when the query is emptied
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

  const applyCustomer = (c: CustomerHit) => {
    set("customerId", c.id);
    set("firstName", c.firstName);
    set("lastName", c.lastName);
    set("phone", formatPhone(c.phone));
    set("email", c.email);
    set("street", c.street);
    set("city", c.city);
    set("state", c.state);
    set("zip", c.zip);
    set("smsConsent", c.smsConsent);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Existing customer search */}
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
          {searching && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">Searching…</span>
          )}
          {open && hits.length > 0 && (
            <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-ink-200 shadow-pop overflow-hidden max-h-72 overflow-y-auto">
              {hits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => applyCustomer(c)}
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
        {data.customerId && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              Existing customer #{data.customerId} loaded
              <button
                type="button"
                onClick={() => set("customerId", null)}
                className="hover:text-emerald-900"
                aria-label="Detach customer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        )}
      </Card>

      {/* Customer information */}
      <Card className="p-5 sm:p-6">
        <SectionTitle>Customer Information</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name" required error={errors.firstName}>
            <Input
              value={data.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              autoComplete="off"
              placeholder="First"
            />
          </Field>
          <Field label="Last Name" required error={errors.lastName}>
            <Input
              value={data.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              autoComplete="off"
              placeholder="Last"
            />
          </Field>
          <Field label="Phone" required error={errors.phone}>
            <Input
              value={data.phone}
              onChange={(e) => set("phone", e.target.value)}
              onBlur={(e) => set("phone", formatPhone(e.target.value) || e.target.value)}
              inputMode="tel"
              placeholder="(123) 123-1233"
            />
          </Field>
          <Field label="Email">
            <Input
              value={data.email}
              onChange={(e) => set("email", e.target.value)}
              inputMode="email"
              autoComplete="off"
              placeholder="customer@email.com"
            />
          </Field>
          <Field label="Street Address" className="sm:col-span-2">
            <Input value={data.street} onChange={(e) => set("street", e.target.value)} placeholder="Address" />
          </Field>
          <Field label="City">
            <Input value={data.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <Input value={data.state} onChange={(e) => set("state", e.target.value)} placeholder="State" />
            </Field>
            <Field label="ZIP">
              <Input value={data.zip} onChange={(e) => set("zip", e.target.value)} inputMode="numeric" placeholder="ZIP" />
            </Field>
          </div>
          <Field label="How did you hear about us?" className="sm:col-span-2">
            <ChoiceChips
              options={formOptions.howHeard}
              value={data.howHeard}
              onChange={(v) => set("howHeard", v)}
              columns={4}
            />
          </Field>
        </div>
      </Card>

      {/* SMS consent */}
      <Card className="p-5 sm:p-6">
        <SectionTitle>SMS Notifications</SectionTitle>
        <Field error={errors.smsConsent}>
          <CheckboxRow checked={data.smsConsent} onChange={(v) => set("smsConsent", v)}>
            {legalTexts.consent}
          </CheckboxRow>
        </Field>
      </Card>
    </div>
  );
}
