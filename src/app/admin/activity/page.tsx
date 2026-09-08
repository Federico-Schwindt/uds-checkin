"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CircleAlert,
  FilePlus2,
  Flag,
  Mail,
  Pencil,
  RefreshCcw,
  ScrollText,
  Search,
  Undo2,
  X,
} from "lucide-react";
import { Button, Card, Input, Select, Spinner } from "@/components/ui";
import { describeActivity, type ActivityRow, type HistoryItem } from "@/lib/history";
import { cn, formatDateTime } from "@/lib/utils";

type Row = ActivityRow & { ip: string };

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

const WHAT = [
  { value: "", label: "Everything" },
  { value: "entry", label: "Jobs and check-ins" },
  { value: "user", label: "Staff" },
  { value: "request", label: "Staff requests" },
  { value: "assignment", label: "Calendar" },
  { value: "settings", label: "Settings" },
  { value: "auth", label: "Sign-ins" },
];

function ActivityInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  // Debounce the text box so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const usp = new URLSearchParams({ page: String(page) });
    if (entity) usp.set("entity", entity);
    if (actor) usp.set("actor", actor);
    if (from) usp.set("from", from);
    if (to) usp.set("to", to);
    if (q) usp.set("q", q);
    fetch(`/api/activity?${usp.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.rows || []);
        setTotal(j.total || 0);
        setPeople(j.people || []);
      })
      .finally(() => setLoading(false));
  }, [page, entity, actor, from, to, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() flips the loading flag for the fetch it starts
    load();
  }, [load]);

  const restore = async (entryId: number) => {
    setRestoring(entryId);
    try {
      const res = await fetch(`/api/entries/${entryId}/restore`, { method: "POST" });
      if (res.ok) load();
    } finally {
      setRestoring(null);
    }
  };

  const clearFilters = () => {
    setEntity("");
    setActor("");
    setFrom("");
    setTo("");
    setSearch("");
    setPage(1);
  };
  const filtered = !!(entity || actor || from || to || q);
  const pages = Math.max(1, Math.ceil(total / 40));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Who did what</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Every check-in, edit, status change and sign-in — {total.toLocaleString()} recorded
          {filtered ? " matching these filters" : ""}.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Who</span>
            <Select
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
              placeholder="Anyone"
              className="h-11 mt-1"
            >
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">What</span>
            <Select
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value);
                setPage(1);
              }}
              className="h-11 mt-1"
            >
              {WHAT.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">From</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-11 mt-1"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">To</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-11 mt-1"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Search</span>
            <div className="relative mt-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Job, name…"
                className="h-11 pl-9"
              />
            </div>
          </label>
        </div>
        {filtered && (
          <button
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-800"
          >
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Spinner className="text-brand-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-20 text-center text-ink-400 text-sm">
            {filtered ? "Nothing matches these filters." : "No activity recorded yet."}
          </p>
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((row) => {
              const it = describeActivity(row);
              const Icon = ICON[it.kind];
              const isDeleted = row.action === "entry.delete";
              return (
                <div key={row.id} className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
                  <span
                    className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0", TONE[it.kind])}
                  >
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-900">
                      <span className="font-bold">{it.who || "Someone"}</span>{" "}
                      <span className="text-ink-700">{it.title.charAt(0).toLowerCase() + it.title.slice(1)}</span>
                      {row.entity === "entry" && row.entityId ? (
                        <>
                          {" "}
                          <Link
                            href={isDeleted ? "#" : `/admin/entries/${row.entityId}`}
                            className={cn(
                              "font-semibold",
                              isDeleted ? "text-ink-400 pointer-events-none" : "text-brand-700 hover:underline"
                            )}
                          >
                            (entry #{row.entityId})
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {it.detail && <p className="text-[13px] text-ink-500 mt-0.5 break-words">{it.detail}</p>}
                    {it.changes && it.changes.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {it.changes.slice(0, expanded === row.id ? 99 : 3).map((c, i) => (
                          <li key={i} className="text-[13px] text-ink-600 flex items-start gap-1.5 flex-wrap">
                            <span className="font-semibold text-ink-700">{c.label}:</span>
                            <span className="line-through text-ink-400 break-all">{c.from}</span>
                            <span className="text-ink-400">→</span>
                            <span className="font-medium text-ink-900 break-all">{c.to}</span>
                          </li>
                        ))}
                        {it.changes.length > 3 && expanded !== row.id && (
                          <li>
                            <button
                              onClick={() => setExpanded(row.id)}
                              className="text-[13px] font-semibold text-brand-700 hover:underline"
                            >
                              +{it.changes.length - 3} more
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                    <p className="text-[11px] text-ink-400 mt-1">
                      {formatDateTime(row.createdAt as string)}
                      {row.ip ? ` · ${row.ip}` : ""}
                    </p>
                  </div>
                  {isDeleted && row.entityId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restore(row.entityId!)}
                      disabled={restoring === row.entityId}
                    >
                      {restoring === row.entityId ? <Spinner className="w-4 h-4" /> : <Undo2 className="w-4 h-4" />}{" "}
                      Restore
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-200 bg-ink-50">
            <span className="text-xs text-ink-500">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityInner />
    </Suspense>
  );
}
