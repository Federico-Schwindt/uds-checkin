"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { Card } from "@/components/ui";
import { EventChip, PointsChip } from "@/components/performance-ui";
import { ScoreEditor, type SuggestedPoints } from "@/components/score-editor";

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

/** The score control plus the full history of what moved it and who moved it. */
export function PerformancePanel({
  userId,
  userName,
  currentScore,
  events,
  suggested,
}: {
  userId: number;
  userName: string;
  currentScore: number;
  events: EventRow[];
  suggested: SuggestedPoints;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState("");

  const afterChange = (score: number | null) => {
    setSaved(score === null ? "Saved." : `Saved — ${userName.split(" ")[0]} is now at ${score}.`);
    router.refresh();
    setTimeout(() => setSaved(""), 6000);
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this record? The points go back onto the score.")) return;
    const res = await fetch("/api/admin/performance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const j = await res.json().catch(() => ({}));
    afterChange(j.score ?? null);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">
          <SlidersHorizontal className="w-4.5 h-4.5" />
        </span>
        <div>
          <h2 className="font-bold leading-tight">Adjust the score</h2>
          <p className="text-[13px] text-ink-500">
            Scores only change from here — nothing is deducted automatically
          </p>
        </div>
      </div>

      <ScoreEditor
        userId={userId}
        userName={userName}
        currentScore={currentScore}
        suggested={suggested}
        onSaved={afterChange}
      />

      {saved && <p className="mt-3 text-sm font-medium text-emerald-700">{saved}</p>}

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
            <p className="px-5 py-8 text-center text-sm text-ink-400">
              Nothing logged — {userName.split(" ")[0]} is on the starting score.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
