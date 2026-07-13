"use client";

import { Card, Field, SectionTitle } from "@/components/ui";
import formOptions from "@/lib/form-options.json";
import type { StepProps } from "../types";
import { cn } from "@/lib/utils";

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

export function StepDesigner({ data, set }: StepProps) {
  return (
    <Card className="p-5 sm:p-6">
      <SectionTitle>Driveshaft Designer</SectionTitle>
      <Field label="Type of Driveshaft" hint="Select the configuration for this job">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
          {formOptions.designerTypes.map((t) => {
            const active = data.designerType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => set("designerType", active ? "" : t)}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all text-left active:scale-[0.99]",
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-500/25"
                    : "border-ink-300 bg-white text-ink-500 hover:border-ink-400"
                )}
              >
                <ShaftDiagram pieces={t === "One Piece" ? 1 : 2} />
                <span className={cn("block text-center font-bold mt-2", active ? "text-brand-800" : "text-ink-700")}>
                  {t}
                </span>
              </button>
            );
          })}
        </div>
      </Field>
    </Card>
  );
}
