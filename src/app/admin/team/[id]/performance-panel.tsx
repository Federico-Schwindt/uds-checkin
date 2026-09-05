"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flag, ThumbsUp, Trash2, SlidersHorizontal } from "lucide-react";
import { Button, Card, Field, Input, Select, SelectOptions, Spinner, Textarea } from "@/components/ui";
import { EventChip, PointsChip } from "@/components/performance-ui";
import { MISTAKE_CATEGORIES, PRAISE_CATEGORIES, SEVERITY_LABEL, SEVERITIES } from "@/lib/performance-config";
import { cn } from "@/lib/utils";

type EventRow = {
  id: number;
  entryId: number | null;
  type: string;
  severity: string;
  category: string;
  note: string;
  points: number;
  createdBy: string;
  createdAt: string;
};

type Defaults = { minor: number; major: number; critical: number; praise: number };

/** Logs mistakes / recognition against a technician and lists the resulting ledger. */
export function PerformancePanel({
  userId,
  userName,
  events,
  defaults,
  entryId,
  compact,
}: {
  userId: number;
  userName: string;
  events: EventRow[];
  defaults: Defaults;
  entryId?: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<"mistake" | "praise" | "adjustment">("mistake");
  const [severity, setSeverity] = useState<string>("minor");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [points, setPoints] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const defaultPoints =
    type === "praise"
      ? Math.abs(defaults.praise)
      : type === "adjustment"
        ? 0
        : -Math.abs(severity === "critical" ? defaults.critical : severity === "major" ? defaults.major : defaults.minor);

  const submit = async () => {
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/admin/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          entryId,
          type,
          severity: type === "mistake" ? severity : "",
          category,
          note,
          points: points === "" ? undefined : Number(points),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not save");
        return;
      }
      setCategory("");
      setNote("");
      setPoints("");
      setOkMsg(
        type === "mistake"
          ? `Mistake logged for ${userName}. Their score has been updated.`
          : `Saved for ${userName}.`
      );
      router.refresh();
      setTimeout(() => setOkMsg(""), 5000);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this record? The technician's score is recalculated.")) return;
    await fetch("/api/admin/performance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  };

  const categories = type === "praise" ? PRAISE_CATEGORIES : MISTAKE_CATEGORIES;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">
          <SlidersHorizontal className="w-4.5 h-4.5" />
        </span>
        <div>
          <h2 className="font-bold leading-tight">Performance record</h2>
          <p className="text-[13px] text-ink-500">
            {entryId ? `Flag an issue with this job, or credit good work` : `Log a mistake or recognize good work`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {(
          [
            { key: "mistake", label: "Mistake", icon: Flag },
            { key: "praise", label: "Recognition", icon: ThumbsUp },
            { key: "adjustment", label: "Adjustment", icon: SlidersHorizontal },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setType(key)}
            className={cn(
              "h-11 rounded-xl border font-semibold text-sm transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2",
              type === key
                ? key === "praise"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : key === "mistake"
                    ? "border-rose-400 bg-rose-50 text-rose-700"
                    : "border-ink-400 bg-ink-100 text-ink-800"
                : "border-ink-300 bg-white text-ink-600 hover:border-ink-400"
            )}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {type === "mistake" && (
          <Field label="Severity" required>
            <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="h-10">
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]} ({-Math.abs(s === "critical" ? defaults.critical : s === "major" ? defaults.major : defaults.minor)} pts)
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Category">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Choose a reason"
            className="h-10"
          >
            <SelectOptions options={categories} />
          </Select>
        </Field>
        <Field
          label="Points"
          hint={`Leave empty for the default (${defaultPoints > 0 ? "+" : ""}${defaultPoints})`}
        >
          <Input
            value={points}
            onChange={(e) => setPoints(e.target.value.replace(/[^0-9-]/g, ""))}
            placeholder={String(defaultPoints)}
            inputMode="numeric"
            className="h-10"
          />
        </Field>
        <Field label="What happened" className="sm:col-span-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              type === "mistake"
                ? "e.g. Driveshaft cut 1/2 inch short, customer had to come back."
                : "e.g. Finished three rush jobs before noon."
            }
            className="min-h-20"
          />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? <Spinner className="w-4 h-4" /> : <Flag className="w-4 h-4" />}
          Save to {userName.split(" ")[0]}&apos;s record
        </Button>
        {error && <span className="text-sm font-medium text-brand-700">{error}</span>}
        {okMsg && <span className="text-sm font-medium text-emerald-700">{okMsg}</span>}
      </div>

      {!compact && (
        <div className="mt-5 pt-4 border-t border-ink-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-2">
            History ({events.length})
          </p>
          <div className="divide-y divide-ink-100 -mx-5 max-h-96 overflow-y-auto">
            {events.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <EventChip type={e.type} severity={e.severity} />
                    <span className="text-sm font-semibold text-ink-900">{e.category || "General"}</span>
                    {e.entryId && (
                      <Link
                        href={`/admin/entries/${e.entryId}`}
                        className="text-[12px] font-semibold text-brand-700 hover:underline"
                      >
                        Entry #{e.entryId}
                      </Link>
                    )}
                  </div>
                  {e.note && <p className="text-[13px] text-ink-600 mt-1 break-words">{e.note}</p>}
                  <p className="text-[11px] text-ink-400 mt-1">
                    {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {e.createdBy ? ` · logged by ${e.createdBy}` : ""}
                  </p>
                </div>
                <PointsChip points={e.points} />
                <button
                  onClick={() => remove(e.id)}
                  className="text-ink-300 hover:text-rose-600 transition-colors shrink-0"
                  aria-label="Remove record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {events.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-ink-400">Nothing logged for this technician yet.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
