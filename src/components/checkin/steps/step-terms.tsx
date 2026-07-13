"use client";

import { Card, Field, Input, SectionTitle } from "@/components/ui";
import { SignatureField } from "@/components/signature-pad";
import legalTexts from "@/lib/legal-texts.json";
import type { StepProps } from "../types";

export function StepTerms({ data, set, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <SectionTitle>Terms &amp; Conditions</SectionTitle>
        <div className="max-h-64 overflow-y-auto rounded-xl bg-ink-50 border border-ink-200 p-4 text-[13px] leading-relaxed text-ink-600 whitespace-pre-line">
          {legalTexts.terms}
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Payment</SectionTitle>
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <Field label="Payment Deposit" error={errors.deposit}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">$</span>
              <Input
                value={data.deposit}
                onChange={(e) => set("deposit", e.target.value)}
                inputMode="decimal"
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </Field>
          <Field label="Total" error={errors.total}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">$</span>
              <Input
                value={data.total}
                onChange={(e) => set("total", e.target.value)}
                inputMode="decimal"
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Signature</SectionTitle>
        <p className="text-sm text-ink-600 mb-3">
          By signing below I hereby acknowledge that I have completely read and fully understand the terms &amp;
          conditions above and agree to them.
        </p>
        <Field required error={errors.finalSignature}>
          <SignatureField value={data.finalSignature} onChange={(v) => set("finalSignature", v)} />
        </Field>
      </Card>
    </div>
  );
}
