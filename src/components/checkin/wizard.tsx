"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, RotateCcw } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { normalizePhone, cn } from "@/lib/utils";
import { initialCheckinData, type CheckinData } from "./types";
import { StepCustomer } from "./steps/step-customer";
import { StepEstimate } from "./steps/step-estimate";
import { StepVehicle } from "./steps/step-vehicle";
import { StepDesigner } from "./steps/step-designer";
import { StepTerms } from "./steps/step-terms";
import { StepStaff } from "./steps/step-staff";

const DRAFT_KEY = "uds-checkin-draft";
const AMOUNT_OPTION = "I DO NOT REQUEST A WRITTEN ESTIMATE AS LONG AS THE REPAIR COSTS DO NOT EXCEED_______.";

const STEPS = [
  { title: "Customer", component: StepCustomer },
  { title: "Estimate", component: StepEstimate },
  { title: "Vehicle & Job", component: StepVehicle },
  { title: "Designer", component: StepDesigner },
  { title: "Terms & Sign", component: StepTerms },
  { title: "Staff", component: StepStaff },
] as const;

function validateStep(step: number, d: CheckinData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (!d.firstName.trim()) errors.firstName = "First name is required";
    if (!d.lastName.trim()) errors.lastName = "Last name is required";
    if (normalizePhone(d.phone).length !== 10) errors.phone = "A valid 10-digit phone is required";
    if (!d.smsConsent) errors.smsConsent = "The customer must agree to receive SMS updates";
  }
  if (step === 1) {
    if (!d.estimateChoice) errors.estimateChoice = "Please select one option";
    if (d.estimateChoice === AMOUNT_OPTION && !d.estimateAmount.trim())
      errors.estimateAmount = "Enter the maximum amount";
    if (!d.estimateSignature) errors.estimateSignature = "Customer signature is required";
  }
  if (step === 4) {
    if (!d.finalSignature) errors.finalSignature = "Customer signature is required";
  }
  return errors;
}

export function CheckinWizard({ turnaroundBanner }: { turnaroundBanner: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<CheckinData>(initialCheckinData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState<{ id: number } | null>(null);
  const [restored, setRestored] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.data?.firstName || saved?.data?.phone || (saved?.step ?? 0) > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time draft restore from localStorage after hydration
          setData({ ...initialCheckinData, ...saved.data });
          setStep(Math.min(saved.step ?? 0, STEPS.length - 1));
          setRestored(true);
        }
      }
    } catch {}
  }, []);

  // Autosave draft (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data }));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [step, data]);

  const set = useCallback(<K extends keyof CheckinData>(key: K, value: CheckinData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const goNext = () => {
    const errs = validateStep(step, data);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollTop();
      return;
    }
    if (step < STEPS.length - 1) {
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
    const errs = validateStep(step, data);
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

  if (done) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-up">
          <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-5" strokeWidth={1.5} />
          <h2 className="text-2xl font-bold text-ink-900 mb-2">Check-in complete!</h2>
          <p className="text-ink-600 mb-8">
            Entry <span className="font-semibold text-ink-900">#{done.id}</span> was saved. The customer will receive
            an SMS with the status of the order at every stage.
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

  const StepComponent = STEPS[step].component;
  const isLast = step === STEPS.length - 1;

  return (
    <div ref={topRef} className="mx-auto w-full max-w-3xl px-4 pb-32 pt-4 scroll-mt-4">
      {/* Turnaround banner */}
      <div className="mb-4 rounded-xl bg-brand-600 text-white text-center font-bold py-2.5 px-4 text-sm shadow-sm">
        {turnaroundBanner}
      </div>

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
        {STEPS.map((s, i) => {
          const active = i === step;
          const complete = i < step;
          return (
            <li key={s.title} className="flex items-center gap-1 shrink-0">
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
      <div className="animate-fade-up" key={step}>
        <StepComponent data={data} set={set} errors={errors} />
      </div>

      {submitError && (
        <div className="mt-4 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          {submitError}
        </div>
      )}

      {/* Sticky nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur border-t border-ink-200 no-print">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <Button variant="outline" size="lg" onClick={goBack} disabled={step === 0 || submitting}>
            <ArrowLeft className="w-5 h-5" /> Previous
          </Button>
          <span className="text-sm text-ink-500 font-medium max-sm:hidden">
            Step {step + 1} of {STEPS.length} — {STEPS[step].title}
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
  );
}
