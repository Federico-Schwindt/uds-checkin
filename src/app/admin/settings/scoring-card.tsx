"use client";

import { Gauge } from "lucide-react";
import { Card, Field, Input, Toggle } from "@/components/ui";
import { normalizeScoring, type ScoringConfig } from "@/lib/performance-config";

/** Every number behind the technician scores, in one place. */
export function ScoringCard({
  scoring,
  onChange,
}: {
  scoring: unknown;
  onChange: (value: ScoringConfig) => void;
}) {
  const s = normalizeScoring(scoring);
  const set = (key: keyof ScoringConfig, value: number | boolean) => onChange({ ...s, [key]: value });
  const numField = (key: keyof ScoringConfig, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input
        value={String(s[key] as number)}
        onChange={(e) => set(key, parseInt(e.target.value.replace(/[^0-9-]/g, "")) || 0)}
        inputMode="numeric"
        className="h-11"
      />
    </Field>
  );

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">
          <Gauge className="w-4.5 h-4.5" />
        </span>
        <div>
          <h2 className="font-bold leading-tight">Performance &amp; bonus</h2>
          <p className="text-[13px] text-ink-500">
            Points each event is worth, and what a technician needs for the monthly bonus
          </p>
        </div>
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-3">Score</p>
      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {numField("baseScore", "Starting score", "Everyone begins each month here")}
        {numField("minorMistake", "Minor mistake", "Negative number")}
        {numField("majorMistake", "Major mistake")}
        {numField("criticalMistake", "Critical mistake")}
        {numField("praise", "Recognition", "Positive number")}
        {numField("latePenalty", "Per late arrival")}
        {numField("absentPenalty", "Per missed shift")}
        {numField("lateGraceMinutes", "Late grace (minutes)", "Arriving within this is still on time")}
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mt-6 mb-3">Monthly bonus</p>
      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {numField("bonusScore", "Minimum score")}
        {numField("bonusPunctuality", "Minimum punctuality %")}
        {numField("bonusAmount", "Bonus amount ($)")}
        <div className="flex items-end pb-3">
          <Toggle
            checked={s.bonusBlockOnCritical}
            onChange={(v) => set("bonusBlockOnCritical", v)}
            label="A critical mistake blocks the bonus"
          />
        </div>
      </div>
    </Card>
  );
}
