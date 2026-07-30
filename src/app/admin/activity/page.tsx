"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  FileEdit,
  FilePlus2,
  Copy,
  LogIn,
  RefreshCcw,
  Settings2,
  Trash2,
  Undo2,
  UserCog,
} from "lucide-react";
import { Badge, Button, Card, Select, Spinner } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

type Row = {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  summary: string;
  details: unknown;
  actor: string;
  ip: string;
  createdAt: string;
};

const ICONS: Record<string, React.ElementType> = {
  "entry.create": FilePlus2,
  "entry.update": FileEdit,
  "entry.delete": Trash2,
  "entry.restore": Undo2,
  "entry.duplicate": Copy,
  "status.change": RefreshCcw,
  "settings.update": Settings2,
  "employee.create": UserCog,
  "employee.update": UserCog,
  "employee.delete": UserCog,
  "auth.failed": LogIn,
  "entry.create.error": AlertTriangle,
};

function tone(action: string): "neutral" | "success" | "danger" | "warning" {
  if (action.endsWith(".error") || action === "auth.failed") return "danger";
  if (action === "entry.delete") return "warning";
  if (action === "entry.create" || action === "entry.restore") return "success";
  return "neutral";
}

function ActivityInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const usp = new URLSearchParams({ page: String(page) });
    if (entity) usp.set("entity", entity);
    fetch(`/api/activity?${usp.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.rows || []);
        setTotal(j.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page, entity]);

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

  const pages = Math.max(1, Math.ceil(total / 40));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-sm text-ink-500 mt-0.5">{total} recorded events — check-ins, edits, deletions and more</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            placeholder="All types"
            className="h-10 w-40"
          >
            <option value="entry">Entries</option>
            <option value="employee">Employees</option>
            <option value="settings">Settings</option>
            <option value="auth">Security</option>
          </Select>
          <Button variant="outline" size="sm" onClick={load} className="h-10">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Spinner className="text-brand-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-20 text-center text-ink-400 text-sm">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((m) => {
              const Icon = ICONS[m.action] || ClipboardList;
              const t = tone(m.action);
              const isDeleted = m.action === "entry.delete";
              return (
                <div key={m.id} className="px-4 sm:px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        t === "danger" && "bg-brand-50 text-brand-600",
                        t === "warning" && "bg-amber-50 text-amber-600",
                        t === "success" && "bg-emerald-50 text-emerald-600",
                        t === "neutral" && "bg-ink-100 text-ink-500"
                      )}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                          className="font-semibold text-sm text-ink-900 text-left"
                        >
                          {m.summary || m.action}
                        </button>
                        <Badge tone={t}>{m.action}</Badge>
                        {m.entity === "entry" && m.entityId && !isDeleted && (
                          <Link href={`/entry/${m.entityId}`} className="text-xs font-semibold text-brand-700 hover:underline">
                            Open entry
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-ink-400 mt-0.5">
                        {formatDateTime(m.createdAt)}
                        {m.ip ? ` · ${m.ip}` : ""}
                      </p>
                      {expanded === m.id && m.details != null && (
                        <pre className="mt-2 text-[11px] bg-ink-50 border border-ink-200 rounded-lg p-3 overflow-x-auto max-h-64">
                          {JSON.stringify(m.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    {isDeleted && m.entityId && (
                      <Button size="sm" variant="outline" onClick={() => restore(m.entityId!)} disabled={restoring === m.entityId}>
                        {restoring === m.entityId ? <Spinner className="w-4 h-4" /> : <Undo2 className="w-4 h-4" />} Restore
                      </Button>
                    )}
                  </div>
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
