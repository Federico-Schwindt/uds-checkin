"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleAlert,
  FilePlus2,
  Flag,
  Mail,
  Pencil,
  RefreshCcw,
  ScrollText,
} from "lucide-react";
import { Card, Spinner } from "@/components/ui";
import { describeActivity, sortByNewest, type ActivityRow, type HistoryItem } from "@/lib/history";
import { cn, formatDateTime } from "@/lib/utils";

const ICON: Record<HistoryItem["kind"], React.ElementType> = {
  created: FilePlus2,
  status: RefreshCcw,
  edit: Pencil,
  quality: Flag,
  message: Mail,
  danger: CircleAlert,
  other: ScrollText,
};

const TONE: Record<HistoryItem["kind"], string> = {
  created: "bg-emerald-50 text-emerald-700 border-emerald-200",
  status: "bg-brand-50 text-brand-700 border-brand-200",
  edit: "bg-ink-100 text-ink-700 border-ink-300",
  quality: "bg-rose-50 text-rose-700 border-rose-200",
  message: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  other: "bg-ink-100 text-ink-600 border-ink-300",
};

/**
 * Everything that happened to one job, newest first, in plain language: who did
 * it, what they changed, and what it was before.
 */
export function EntryHistory({ entryId }: { entryId: number }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/activity?entity=entry&entityId=${entryId}&pageSize=100`);
      if (!res.ok) throw new Error();
      const j = await res.json();
      setItems(sortByNewest((j.rows as ActivityRow[]).map(describeActivity)));
    } catch {
      setItems([]);
    }
  }, [entryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates happen after the fetch resolves
    load();
  }, [load]);

  return (
    <Card className="p-5 no-print">
      <h2 className="font-bold flex items-center gap-2">
        <ScrollText className="w-4.5 h-4.5 text-ink-400" /> Who did what
      </h2>
      <p className="text-[13px] text-ink-500 mt-0.5 mb-4">
        Every change to this job, newest first, with the person who made it.
      </p>

      {items === null ? (
        <div className="py-8 text-center">
          <Spinner className="text-brand-600 w-5 h-5" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">
          Nothing recorded yet for this job.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((it) => {
            const Icon = ICON[it.kind];
            return (
              <li key={it.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                    TONE[it.kind]
                  )}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-900">
                    <span className="font-bold">{it.who || "Someone"}</span>{" "}
                    <span className="text-ink-700">{it.title.charAt(0).toLowerCase() + it.title.slice(1)}</span>
                  </p>
                  {it.detail && <p className="text-[13px] text-ink-500 mt-0.5 break-words">{it.detail}</p>}
                  {it.changes && it.changes.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {it.changes.map((c, i) => (
                        <li key={i} className="text-[13px] text-ink-600 flex items-start gap-1.5 flex-wrap">
                          <span className="font-semibold text-ink-700">{c.label}:</span>
                          <span className="line-through text-ink-400 break-all">{c.from}</span>
                          <span className="text-ink-400">→</span>
                          <span className="font-medium text-ink-900 break-all">{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-ink-400 mt-1">{formatDateTime(it.at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
