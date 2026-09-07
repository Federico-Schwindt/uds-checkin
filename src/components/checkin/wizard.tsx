"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Home, RotateCcw, X } from "lucide-react";
import { Button, Card, Spinner } from "@/components/ui";
import { Logo } from "@/components/logo";
import { normalizePhone, cn } from "@/lib/utils";
import { mergeOptions, type FormOptions } from "@/lib/form-options";
import {
  evaluateConditions,
  fieldLookup,
  type FormField,
  type FormSchema,
  type ValueBag,
} from "@/lib/form-schema";
import { resolveSchema } from "@/lib/form-schema-default";
import { FormRenderer, validateFields, type WidgetMap } from "@/components/form-renderer";
import { CustomerSearchWidget, DriveshaftDesignerWidget, PartsTableWidget, type CustomerHit } from "./widgets";
import { initialCheckinData, type CheckinData, type PartLine } from "./types";

const DRAFT_KEY = "uds-checkin-draft";

/** Split a step's fields into card groups, with widgets standing alone. */
type Group = { kind: "fields"; title?: string; fields: FormField[] } | { kind: "widget"; field: FormField };

function groupFields(fields: FormField[]): Group[] {
  const groups: Group[] = [];
  let current: { kind: "fields"; title?: string; fields: FormField[] } | null = null;

  const flush = () => {
    if (current && current.fields.length > 0) groups.push(current);
    current = null;
  };

  for (const f of fields) {
    if (f.type === "widget") {
      flush();
      groups.push({ kind: "widget", field: f });
      continue;
    }
    if (f.type === "heading") {
      flush();
      current = { kind: "fields", title: f.label, fields: [] };
      continue;
    }
    if (!current) current = { kind: "fields", fields: [] };
    current.fields.push(f);
  }
  flush();
  return groups;
}

export function CheckinWizard({
  turnaroundBanner,
  schema: schemaProp,
  options: optionOverrides,
  googleMapsKey,
  initialCustomer,
  fresh,
}: {
  turnaroundBanner: string;
  schema?: FormSchema | null;
  options?: FormOptions | null;
  googleMapsKey?: string;
  /** Customer chosen in the quick-start; their details start filled in. */
  initialCustomer?: CustomerHit | null;
  /** Deliberately starting a new one — any saved draft is dropped. */
  fresh?: boolean;
}) {
  const router = useRouter();
  const schema = useMemo(() => resolveSchema(schemaProp), [schemaProp]);
  const options = useMemo(() => mergeOptions(optionOverrides), [optionOverrides]);
  const lookup = useMemo(() => fieldLookup(schema), [schema]);
  const steps = useMemo(() => schema.steps.filter((s) => s.enabled !== false), [schema]);

  const [step, setStep] = useState(0);
  // A customer picked in the quick-start seeds the form at render — same output
  // on the server and the client, so there is nothing to reconcile afterwards.
  const [data, setData] = useState<CheckinData>(() =>
    initialCustomer
      ? {
          ...initialCheckinData,
          customerId: initialCustomer.id,
          firstName: initialCustomer.firstName,
          lastName: initialCustomer.lastName,
          phone: formatPhoneSafe(initialCustomer.phone),
          email: initialCustomer.email,
          street: initialCustomer.street,
          city: initialCustomer.city,
          state: initialCustomer.state,
          zip: initialCustomer.zip,
          smsConsent: initialCustomer.smsConsent,
        }
      : initialCheckinData
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState<{ id: number } | null>(null);
  const [restored, setRestored] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  /* ---------------- draft persistence ---------------- */

  useEffect(() => {
    // Starting deliberately (new customer, or one picked in the quick-start):
    // drop whatever was left over so two check-ins never bleed together.
    if (fresh) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.data?.firstName || saved?.data?.phone || (saved?.step ?? 0) > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time draft restore from localStorage after hydration
          setData({ ...initialCheckinData, ...saved.data });
          setStep(Math.min(saved.step ?? 0, Math.max(0, steps.length - 1)));
          setRestored(true);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data }));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [step, data]);

  /* ---------------- value plumbing ---------------- */

  const setValue = useCallback((field: FormField, value: unknown) => {
    setData((d) => {
      if (field.core) return { ...d, [field.key]: value } as CheckinData;
      return { ...d, custom: { ...(d.custom || {}), [field.key]: value } };
    });
    setErrors((e) => {
      if (!e[field.key]) return e;
      const next = { ...e };
      delete next[field.key];
      return next;
    });
  }, []);

  const setCore = useCallback(<K extends keyof CheckinData>(key: K, value: CheckinData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  const applyCustomer = useCallback((c: CustomerHit) => {
    setData((d) => ({
      ...d,
      customerId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: formatPhoneSafe(c.phone),
      email: c.email,
      street: c.street,
      city: c.city,
      state: c.state,
      zip: c.zip,
      smsConsent: c.smsConsent,
    }));
  }, []);

  const widgets: WidgetMap = useMemo(
    () => ({
      customerSearch: (
        <CustomerSearchWidget
          customerId={data.customerId}
          onPick={applyCustomer}
          onDetach={() => setCore("customerId", null)}
        />
      ),
      partsTable: <PartsTableWidget parts={data.parts} onChange={(p: PartLine[]) => setCore("parts", p)} />,
      driveshaftDesigner: (
        <DriveshaftDesignerWidget
          value={data.designerType}
          onChange={(v) => setCore("designerType", v)}
          options={options.designerTypes || []}
        />
      ),
    }),
    [data.customerId, data.parts, data.designerType, applyCustomer, setCore, options.designerTypes]
  );

  /* ---------------- navigation ---------------- */

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const validateCurrent = useCallback(() => {
    const current = steps[step];
    if (!current) return {};
    const errs = validateFields(current.fields, data as ValueBag, lookup);
    // Phone needs format validation beyond "not empty".
    const phoneField = current.fields.find((f) => f.key === "phone") || lookup.get("phone");
    const phoneVisible =
      phoneField && current.fields.some((f) => f.key === "phone" || f.children?.some((c) => c.key === "phone"));
    if (phoneVisible && phoneField?.required && normalizePhone(data.phone).length !== 10) {
      errs.phone = "A valid 10-digit phone is required";
    }
    return errs;
  }, [steps, step, data, lookup]);

  const goNext = () => {
    const errs = validateCurrent();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return scrollTop();
    if (step < steps.length - 1) {
      setStep(step + 1);
      scrollTop();
    }
  };

  const goBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollTop();
    }
  };

  const submit = async () => {
    const errs = validateCurrent();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      let locationId: number | null = null;
      try {
        const stored = localStorage.getItem("uds-location-id");
        locationId = stored ? parseInt(stored) : null;
      } catch {}
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, locationId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || "Something went wrong. Please try again.");
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      setDone({ id: json.id });
    } catch {
      setSubmitError("Connection error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setData(initialCheckinData);
    setStep(0);
    setErrors({});
    setRestored(false);
  };

  const isDirty = useMemo(
    () =>
      Boolean(
        data.firstName || data.lastName || normalizePhone(data.phone) || data.email || data.vehicleModel || data.parts.length
      ),
    [data]
  );

  const exit = () => {
    if (isDirty && !confirm("Leave this check-in? Unsaved progress is kept as a draft on this device.")) return;
    router.push("/");
  };

  /* ---------------- render ---------------- */

  if (done) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-up">
          <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-5" strokeWidth={1.5} />
          <h2 className="text-2xl font-bold text-ink-900 mb-2">Check-in complete!</h2>
          <p className="text-ink-600 mb-8">
            Entry <span className="font-semibold text-ink-900">#{done.id}</span> was saved. The customer will receive an
            SMS with the status of the order at every stage.
          </p>
          <div className="flex gap-3 justify-center">
            <Button size="lg" onClick={discardDraft}>
              New Check-In
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push("/")}>
              Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="py-24 text-center text-ink-500">
        No steps are enabled. Enable at least one in Admin → Form Builder.
      </div>
    );
  }

  const currentStep = steps[step];
  const groups = groupFields(currentStep.fields);
  const isLast = step === steps.length - 1;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-ink-200 no-print">
        <div className="mx-auto max-w-[1440px] px-3 sm:px-4 h-16 flex items-center justify-between gap-3">
          <button
            onClick={exit}
            className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 active:scale-95 font-semibold text-sm transition-all"
          >
            <ArrowLeft className="w-4.5 h-4.5" /> Exit
          </button>
          <Logo className="h-6 sm:h-7" />
          <button
            onClick={exit}
            className="w-11 h-11 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-600 active:scale-95 flex items-center justify-center transition-all"
            aria-label="Exit check-in"
            title="Exit"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div ref={topRef} className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-4 scroll-mt-20">
        {turnaroundBanner && (
          <div className="mb-4 rounded-xl bg-brand-600 text-white text-center font-bold py-2.5 px-4 text-sm shadow-sm">
            {turnaroundBanner}
          </div>
        )}

        {restored && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span>Restored an unfinished check-in draft.</span>
            <button onClick={discardDraft} className="inline-flex items-center gap-1.5 font-semibold hover:underline shrink-0">
              <RotateCcw className="w-3.5 h-3.5" /> Start fresh
            </button>
          </div>
        )}

        {/* Stepper */}
        <ol className="flex items-center gap-1 mb-6 overflow-x-auto no-scrollbar">
          {steps.map((s, i) => {
            const active = i === step;
            const complete = i < step;
            return (
              <li key={s.id} className="flex items-center gap-1 shrink-0">
                {i > 0 && <span className={cn("w-4 sm:w-7 h-px", complete || active ? "bg-brand-500" : "bg-ink-300")} />}
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  className={cn(
                    "flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors",
                    i < step && "cursor-pointer hover:bg-ink-200/50",
                    i > step && "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      active && "bg-brand-600 text-white",
                      complete && "bg-brand-100 text-brand-700",
                      !active && !complete && "bg-ink-200 text-ink-500"
                    )}
                  >
                    {complete ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-semibold whitespace-nowrap",
                      active ? "text-ink-900" : "text-ink-500",
                      !active && "max-sm:hidden"
                    )}
                  >
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Step body */}
        <div className="space-y-6 animate-fade-up" key={currentStep.id}>
          {groups.map((g, i) => {
            if (g.kind === "widget") {
              if (!evaluateConditions(g.field.conditions, data as ValueBag, lookup)) return null;
              return <div key={g.field.id}>{widgets[g.field.widget || ""] ?? null}</div>;
            }
            const anyVisible = g.fields.some((f) => evaluateConditions(f.conditions, data as ValueBag, lookup));
            if (!anyVisible) return null;
            return (
              <Card key={i} className="p-5 sm:p-6">
                {g.title && <SectionHeading>{g.title}</SectionHeading>}
                <FormRenderer
                  fields={g.fields}
                  values={data as ValueBag}
                  setValue={setValue}
                  errors={errors}
                  options={options}
                  lookup={lookup}
                  widgets={widgets}
                  googleMapsKey={googleMapsKey}
                />
              </Card>
            );
          })}
        </div>

        {submitError && (
          <div className="mt-4 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
            {submitError}
          </div>
        )}

        {/* Sticky nav */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur border-t border-ink-200 no-print">
          <div className="mx-auto max-w-[1440px] px-4 py-3 flex items-center justify-between gap-3">
            {step === 0 ? (
              <Button variant="outline" size="lg" onClick={exit} disabled={submitting}>
                <Home className="w-5 h-5" /> Cancel
              </Button>
            ) : (
              <Button variant="outline" size="lg" onClick={goBack} disabled={submitting}>
                <ArrowLeft className="w-5 h-5" /> Back
              </Button>
            )}
            <span className="text-sm text-ink-500 font-medium max-sm:hidden">
              Step {step + 1} of {steps.length} — {currentStep.title}
            </span>
            {isLast ? (
              <Button size="lg" onClick={submit} disabled={submitting} className="min-w-36">
                {submitting ? <Spinner /> : <Check className="w-5 h-5" />} Complete
              </Button>
            ) : (
              <Button size="lg" onClick={goNext} className="min-w-32">
                Next <ArrowRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-6 w-1.5 rounded-full bg-brand-600" />
      <h2 className="text-lg font-bold tracking-tight text-ink-900 uppercase">{children}</h2>
    </div>
  );
}

function formatPhoneSafe(p: string) {
  const d = (p || "").replace(/\D/g, "");
  if (d.length !== 10) return p || "";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
