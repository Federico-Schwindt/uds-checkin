"use client";

import { useMemo, useState } from "react";
import { Flag, Minus, Pencil, Plus, ThumbsUp } from "lucide-react";
import { Button, Field, Input, Select, SelectOptions, Spinner, Textarea } from "@/components/ui";
import {
  ALL_CATEGORIES,
  MISTAKE_CATEGORIES,
  PRAISE_CATEGORIES,
  SEVERITIES,
  SEVERITY_LABEL,
  type Severity,
} from "@/lib/performance-config";
import { cn } from "@/lib/utils";

export type SuggestedPoints = { minor: number; major: number; critical: number; praise: number };

type Mode = "deduct" | "add" | "set";

/**
 * The admin's one control for a technician's score. Nothing moves a score
 * except what is saved from here, so the panel always shows the score now, the
 * change being made, and the score that will result.
 */
export function ScoreEditor({
  userId,
  userName,
  currentScore,
  suggested,
  entryId,
  onSaved,
  compact,
}: {
  userId: number;
  userName: string;
  currentScore: number;
  suggested: SuggestedPoints;
  /** Ties the record to a specific job when opened from an entry. */
  entryId?: number;
  onSaved: (newScore: number | null) => void;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("deduct");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [amount, setAmount] = useState(Math.abs(suggested.minor));
  // Null until the admin types a target, so the box follows the live score
  // until they take it over.
  const [typedTarget, setTypedTarget] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const target = typedTarget ?? currentScore;

  const suggestionFor = (s: Severity) =>
    Math.abs(s === "critical" ? suggested.critical : s === "major" ? suggested.major : suggested.minor);

  const nextScore = useMemo(() => {
    const raw = mode === "set" ? target : mode === "add" ? currentScore + amount : currentScore - amount;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [amount, currentScore, mode, target]);

  const delta = nextScore - currentScore;

  const pickSeverity = (s: Severity) => {
    setSeverity(s);
    setAmount(suggestionFor(s));
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        userId,
        entryId,
        category,
        note,
      };
      if (mode === "set") {
        body.type = "adjustment";
        body.setScore = target;
      } else if (mode === "add") {
        body.type = "praise";
        body.points = Math.abs(amount);
      } else {
        body.type = "mistake";
        body.severity = severity;
        body.points = -Math.abs(amount);
      }
      const res = await fetch("/api/admin/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not save");
        return;
      }
      setCategory("");
      setNote("");
      setTypedTarget(null);
      onSaved(j.score ?? null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            { key: "deduct", label: "Deduct points", icon: Minus },
            { key: "add", label: "Add points", icon: ThumbsUp },
            { key: "set", label: "Set score", icon: Pencil },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              "h-11 rounded-xl border font-semibold text-sm transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2",
              mode === key
                ? key === "add"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : key === "deduct"
                    ? "border-rose-400 bg-rose-50 text-rose-700"
                    : "border-ink-400 bg-ink-100 text-ink-800"
                : "border-ink-300 bg-white text-ink-600 hover:border-ink-400"
            )}
          >
            <Icon className="w-4 h-4" /> <span className="max-sm:hidden">{label}</span>
          </button>
        ))}
      </div>

      {/* Live preview: score now → score after */}
      <div className="rounded-2xl border border-ink-200 bg-ink-50 p-4">
        <div className="flex items-center justify-center gap-4 sm:gap-7">
          <Reading label="Score now" value={currentScore} />
          <div className="text-center shrink-0">
            <span
              className={cn(
                "block text-xl font-bold tabular-nums",
                delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-ink-400"
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400">change</span>
          </div>
          <Reading label="After saving" value={nextScore} tone={nextScore >= 90 ? "good" : nextScore >= 70 ? "ok" : "bad"} />
        </div>

        {mode === "set" ? (
          <div className="mt-4 flex items-center gap-3 justify-center">
            <span className="text-[13px] font-semibold text-ink-700">Set the score to</span>
            <Input
              value={String(target)}
              onChange={(e) => setTypedTarget(clampScore(e.target.value))}
              inputMode="numeric"
              className="h-11 w-24 text-center text-lg font-bold"
            />
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAmount((a) => Math.max(0, a - 1))}
                className="w-10 h-10 shrink-0 rounded-xl border border-ink-300 bg-white text-ink-700 hover:bg-ink-100 flex items-center justify-center"
                aria-label="One point less"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={0}
                max={50}
                value={Math.min(50, amount)}
                onChange={(e) => setAmount(parseInt(e.target.value, 10))}
                aria-label="Points"
                className={cn(
                  "flex-1 h-2 rounded-full appearance-none cursor-pointer",
                  mode === "add" ? "accent-emerald-600 bg-emerald-100" : "accent-rose-600 bg-rose-100"
                )}
              />
              <button
                type="button"
                onClick={() => setAmount((a) => Math.min(100, a + 1))}
                className="w-10 h-10 shrink-0 rounded-xl border border-ink-300 bg-white text-ink-700 hover:bg-ink-100 flex items-center justify-center"
                aria-label="One point more"
              >
                <Plus className="w-4 h-4" />
              </button>
              <Input
                value={String(amount)}
                onChange={(e) => setAmount(clampScore(e.target.value))}
                inputMode="numeric"
                className="h-11 w-20 text-center text-lg font-bold shrink-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* How serious was it */}
      {mode === "deduct" && (
        <div>
          <p className="text-[13px] font-semibold text-ink-700 mb-2">How serious was it?</p>
          <div className="grid grid-cols-3 gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pickSeverity(s)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98]",
                  severity === s
                    ? s === "critical"
                      ? "border-rose-500 bg-rose-50"
                      : s === "major"
                        ? "border-orange-400 bg-orange-50"
                        : "border-amber-400 bg-amber-50"
                    : "border-ink-300 bg-white hover:border-ink-400"
                )}
              >
                <span className="block text-sm font-bold text-ink-900">{SEVERITY_LABEL[s]}</span>
                <span className="block text-[12px] text-ink-500">suggests −{suggestionFor(s)}</span>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-ink-400 mt-2">
            A suggestion only — set any amount above. Nothing is deducted unless you save it here.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Reason">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Choose a reason"
            className="h-11"
          >
            <SelectOptions
              options={mode === "add" ? PRAISE_CATEGORIES : mode === "set" ? ALL_CATEGORIES : MISTAKE_CATEGORIES}
            />
          </Select>
        </Field>
        <Field label="Note" className={compact ? "sm:col-span-2" : ""}>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              mode === "add"
                ? "e.g. Kept the station spotless all week and helped close on Saturday."
                : "e.g. Dropped the torque wrench, it had to be replaced."
            }
            className="min-h-20"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={save} disabled={busy || delta === 0}>
          {busy ? <Spinner className="w-4 h-4" /> : <Flag className="w-4 h-4" />}
          {delta === 0
            ? "No change to save"
            : `Save — ${userName.split(" ")[0]} goes to ${nextScore}`}
        </Button>
        {error && <span className="text-sm font-medium text-brand-700">{error}</span>}
      </div>
    </div>
  );
}

function clampScore(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

function Reading({ label, value, tone }: { label: string; value: number; tone?: "good" | "ok" | "bad" }) {
  return (
    <div className="text-center">
      <span
        className={cn(
          "block text-4xl font-bold tabular-nums leading-none",
          tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : tone === "ok" ? "text-amber-600" : "text-ink-900"
        )}
      >
        {value}
      </span>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-400 mt-1">{label}</span>
    </div>
  );
}
