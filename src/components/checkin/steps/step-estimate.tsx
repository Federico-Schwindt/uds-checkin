"use client";

import { Card, Field, Input, SectionTitle } from "@/components/ui";
import { SignatureField } from "@/components/signature-pad";
import legalTexts from "@/lib/legal-texts.json";
import formOptions from "@/lib/form-options.json";
import type { StepProps } from "../types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const AMOUNT_OPTION = "I DO NOT REQUEST A WRITTEN ESTIMATE AS LONG AS THE REPAIR COSTS DO NOT EXCEED_______.";

export function StepEstimate({ data, set, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <SectionTitle>Written Estimate Authorization</SectionTitle>
        <p className="font-bold text-ink-900 mb-1">
          PLEASE READ CAREFULLY, CHECK ONE OF THE STATEMENTS BELOW, AND SIGN:
        </p>
        <p className="text-ink-700 mb-5">
          I understand that, under state law, I am entitled to a <strong>written estimate</strong> if my final bill
          will exceed <strong>$150</strong>.
        </p>

        <Field error={errors.estimateChoice}>
          <div className="space-y-2.5">
            {formOptions.estimateOptions.map((opt) => {
              const active = data.estimateChoice === opt;
              const isAmount = opt === AMOUNT_OPTION;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set("estimateChoice", opt)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all active:scale-[0.995]",
                    active
                      ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/25"
                      : "border-ink-300 bg-white hover:border-ink-400"
                  )}
                >
                  <span
                    className={cn(
                      "w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center mt-0.5",
                      active ? "border-brand-600 bg-brand-600" : "border-ink-300 bg-white"
                    )}
                  >
                    {active && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                  </span>
                  <span className="text-sm font-medium text-ink-800 leading-relaxed">
                    {isAmount ? "I DO NOT REQUEST A WRITTEN ESTIMATE AS LONG AS THE REPAIR COSTS DO NOT EXCEED THE AMOUNT BELOW." : opt}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {data.estimateChoice === AMOUNT_OPTION && (
          <div className="mt-4 animate-fade-up">
            <Field label="Amount" required error={errors.estimateAmount}>
              <div className="relative max-w-56">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">$</span>
                <Input
                  value={data.estimateAmount}
                  onChange={(e) => set("estimateAmount", e.target.value)}
                  inputMode="decimal"
                  className="pl-8"
                  placeholder="Amount here"
                />
              </div>
            </Field>
          </div>
        )}

        <p className="text-[13px] text-ink-500 leading-relaxed mt-6 border-t border-ink-200 pt-4">
          {legalTexts.estimateDisclosure}
        </p>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Signature</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
          <Field label="Customer Signature" required error={errors.estimateSignature}>
            <SignatureField value={data.estimateSignature} onChange={(v) => set("estimateSignature", v)} />
          </Field>
          <Field label="Date">
            <Input type="date" value={data.estimateDate} onChange={(e) => set("estimateDate", e.target.value)} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
