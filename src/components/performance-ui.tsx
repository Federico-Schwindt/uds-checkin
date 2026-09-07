import { cn } from "@/lib/utils";
import { gradeFor } from "@/lib/performance-config";

const TONE_TEXT: Record<string, string> = {
  good: "text-emerald-600",
  ok: "text-brand-600",
  warn: "text-amber-600",
  bad: "text-rose-600",
};

const TONE_STROKE: Record<string, string> = {
  good: "stroke-emerald-500",
  ok: "stroke-brand-500",
  warn: "stroke-amber-500",
  bad: "stroke-rose-500",
};

const TONE_CHIP: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ok: "bg-brand-50 text-brand-700 border-brand-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  bad: "bg-rose-50 text-rose-700 border-rose-200",
};

/** Circular score gauge — 0-100 with the letter grade underneath. */
export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const grade = gradeFor(score);
  const stroke = size >= 120 ? 10 : 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stroke-ink-200"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={cn(TONE_STROKE[grade.tone], "transition-all")}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold leading-none", TONE_TEXT[grade.tone])} style={{ fontSize: size * 0.29 }}>
          {score}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mt-1">
          Grade {grade.letter}
        </span>
      </div>
    </div>
  );
}

export function GradeChip({ score, className }: { score: number; className?: string }) {
  const grade = gradeFor(score);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap",
        TONE_CHIP[grade.tone],
        className
      )}
    >
      {grade.letter} · {grade.label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "good" | "ok" | "warn" | "bad";
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3">
      <p className={cn("text-2xl font-bold leading-tight", tone ? TONE_TEXT[tone] : "text-ink-900")}>{value}</p>
      <p className="text-[13px] font-medium text-ink-600 mt-0.5">{label}</p>
      {hint && <p className="text-[11px] text-ink-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const SEVERITY_CHIP: Record<string, string> = {
  minor: "bg-amber-50 text-amber-700 border-amber-200",
  major: "bg-orange-50 text-orange-700 border-orange-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

export function EventChip({ type, severity }: { type: string; severity: string }) {
  if (type === "praise") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
        Recognition
      </span>
    );
  }
  if (type === "adjustment") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-ink-100 text-ink-600 border-ink-300">
        Adjustment
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize",
        SEVERITY_CHIP[severity] || SEVERITY_CHIP.minor
      )}
    >
      {severity || "minor"} mistake
    </span>
  );
}

export function PointsChip({ points }: { points: number }) {
  return (
    <span
      className={cn(
        "font-mono text-sm font-bold tabular-nums",
        points > 0 ? "text-emerald-600" : points < 0 ? "text-rose-600" : "text-ink-400"
      )}
    >
      {points > 0 ? "+" : ""}
      {points}
    </span>
  );
}
