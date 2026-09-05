"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Info, Megaphone, Plus, Store, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, Spinner, Textarea, Toggle } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

type Announcement = {
  id: number;
  title: string;
  body: string;
  kind: string;
  expiresAt: string | null;
  pinned: boolean;
  createdBy: string;
  createdAt: string;
};

const KIND_META: Record<string, { label: string; icon: typeof Info; style: string }> = {
  info: { label: "Notice", icon: Info, style: "bg-brand-50 text-brand-700 border-brand-200" },
  warning: { label: "Heads up", icon: AlertTriangle, style: "bg-amber-50 text-amber-800 border-amber-200" },
  closure: { label: "Closing", icon: Store, style: "bg-rose-50 text-rose-700 border-rose-200" },
};

export function AnnouncementsManager() {
  const [rows, setRows] = useState<Announcement[] | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", kind: "info", expiresAt: "", pinned: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/announcements");
    const j = await res.json().catch(() => ({}));
    setRows(j.announcements || []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates happen after the fetch resolves
    load();
  }, [load]);

  const post = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not post the notice");
        return;
      }
      setDraft({ title: "", body: "", kind: "info", expiresAt: "", pinned: false });
      setComposing(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Remove this notice from everyone's panel?")) return;
    await fetch("/api/admin/announcements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  if (!rows) {
    return (
      <div className="py-24 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team notices</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Early closing, holiday hours, reminders — everyone sees these when they sign in
          </p>
        </div>
        <Button size="sm" variant={composing ? "outline" : "primary"} onClick={() => setComposing((v) => !v)}>
          {composing ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {composing ? "Cancel" : "Post a notice"}
        </Button>
      </div>

      {composing && (
        <Card className="p-5 border-brand-300 animate-fade-up">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Title" required className="sm:col-span-2">
              <Input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Closing at 2 PM this Friday"
                className="h-11"
              />
            </Field>
            <Field label="Kind">
              <Select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))} className="h-11">
                <option value="info">Notice</option>
                <option value="warning">Heads up</option>
                <option value="closure">Closing / hours change</option>
              </Select>
            </Field>
            <Field label="Hide after" hint="Leave empty to keep it up">
              <Input
                type="date"
                value={draft.expiresAt}
                onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))}
                className="h-11"
              />
            </Field>
            <Field label="Message" className="sm:col-span-2 lg:col-span-4">
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                placeholder="The detail your team needs — times, reasons, what to do."
                className="min-h-24"
              />
            </Field>
          </div>
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <Button onClick={post} disabled={busy || !draft.title.trim()}>
              {busy ? <Spinner className="w-4 h-4" /> : <Megaphone className="w-4 h-4" />} Post to the team
            </Button>
            <Toggle
              checked={draft.pinned}
              onChange={(v) => setDraft((d) => ({ ...d, pinned: v }))}
              label="Pin to the top"
            />
            {error && <span className="text-sm font-medium text-brand-700">{error}</span>}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {rows.map((a) => {
          const meta = KIND_META[a.kind] || KIND_META.info;
          const Icon = meta.icon;
          const expired = a.expiresAt ? new Date(a.expiresAt) < new Date() : false;
          return (
            <Card key={a.id} className={cn("p-4 flex items-start gap-3", expired && "opacity-60")}>
              <span className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0", meta.style)}>
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink-900 flex items-center gap-2 flex-wrap">
                  {a.title}
                  {a.pinned && <Badge tone="warning">Pinned</Badge>}
                  {expired && <Badge tone="neutral">Expired</Badge>}
                </p>
                {a.body && <p className="text-[13px] text-ink-600 mt-1 whitespace-pre-wrap break-words">{a.body}</p>}
                <p className="text-[11px] text-ink-400 mt-1.5">
                  {formatDateTime(a.createdAt)}
                  {a.createdBy ? ` · ${a.createdBy}` : ""}
                  {a.expiresAt ? ` · hides ${formatDateTime(a.expiresAt)}` : ""}
                </p>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="text-ink-300 hover:text-rose-600 transition-colors shrink-0"
                aria-label="Remove notice"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card className="p-10 text-center text-sm text-ink-400">
            <Megaphone className="w-7 h-7 mx-auto mb-2 text-ink-300" />
            No notices yet. Post one and it appears on every technician&apos;s panel.
          </Card>
        )}
      </div>
    </div>
  );
}
