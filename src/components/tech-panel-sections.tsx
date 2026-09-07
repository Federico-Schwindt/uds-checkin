"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  ClipboardList,
  Info,
  Mail,
  MessageSquarePlus,
  Send,
  Store,
  User,
  Wrench,
  X,
} from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { REQUEST_STATUS_LABEL, REQUEST_TYPES, REQUEST_TYPE_LABEL } from "@/lib/request-types";
import { formatClock, formatDateKey, parseHhMm } from "@/lib/work-hours";
import { cn, formatDateTime } from "@/lib/utils";

/* ---------------- notices ---------------- */

export type NoticeRow = { id: number; title: string; body: string; kind: string; createdAt: string; createdBy: string };

const KIND_META: Record<string, { label: string; icon: typeof Info; style: string }> = {
  info: { label: "Notice", icon: Info, style: "border-brand-200 bg-brand-50 text-brand-800" },
  warning: { label: "Heads up", icon: AlertTriangle, style: "border-amber-200 bg-amber-50 text-amber-900" },
  closure: { label: "Closing", icon: Store, style: "border-rose-200 bg-rose-50 text-rose-900" },
};

/** Shop notices the technician has not acknowledged yet. */
export function NoticeBoard({ notices }: { notices: NoticeRow[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<number[]>([]);
  const visible = notices.filter((n) => !dismissed.includes(n.id));
  if (!visible.length) return null;

  const ack = async (id: number) => {
    setDismissed((d) => [...d, id]);
    await fetch("/api/tech/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId: id }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {visible.map((n) => {
        const meta = KIND_META[n.kind] || KIND_META.info;
        const Icon = meta.icon;
        return (
          <div key={n.id} className={cn("rounded-2xl border px-4 py-3.5 flex items-start gap-3", meta.style)}>
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{n.title}</p>
              {n.body && <p className="text-[13px] mt-0.5 whitespace-pre-wrap break-words opacity-90">{n.body}</p>}
              <p className="text-[11px] opacity-70 mt-1">
                {formatDateTime(n.createdAt)}
                {n.createdBy ? ` · ${n.createdBy}` : ""}
              </p>
            </div>
            <button
              onClick={() => ack(n.id)}
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/70 hover:bg-white text-[13px] font-semibold"
            >
              <Check className="w-3.5 h-3.5" /> Got it
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- my calendar ---------------- */

export type AssignmentRow = {
  id: number;
  workDate: string;
  startTime: string;
  type: string;
  title: string;
  customerName: string;
  details: string;
  entryId: number | null;
  status: string;
  isNew: boolean;
};

const TYPE_STYLE: Record<string, string> = {
  appointment: "bg-brand-50 text-brand-700 border-brand-200",
  work_order: "bg-emerald-50 text-emerald-700 border-emerald-200",
  task: "bg-amber-50 text-amber-700 border-amber-200",
  other: "bg-ink-100 text-ink-700 border-ink-300",
};

const TYPE_LABEL: Record<string, string> = {
  appointment: "Appointment",
  work_order: "Work order",
  task: "Task",
  other: "Other",
};

export function MyCalendar({ items, todayKey }: { items: AssignmentRow[]; todayKey: string }) {
  const acked = useRef(false);

  // Mark what is on screen as seen, so it is only flagged "New" once. This talks
  // to the server only; nothing in this component re-renders because of it.
  useEffect(() => {
    if (acked.current) return;
    const fresh = items.filter((a) => a.isNew).map((a) => a.id);
    if (!fresh.length) return;
    acked.current = true;
    fetch("/api/tech/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentIds: fresh }),
    }).catch(() => {});
  }, [items]);

  const grouped = items.reduce<Record<string, AssignmentRow[]>>((acc, a) => {
    (acc[a.workDate] ||= []).push(a);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <Card className="p-5">
      <h2 className="font-bold mb-1 flex items-center gap-2">
        <CalendarRange className="w-4.5 h-4.5 text-ink-400" /> My schedule
      </h2>
      <p className="text-[13px] text-ink-500 mb-4">What your manager has booked for you.</p>

      <div className="space-y-4">
        {dates.map((date) => (
          <div key={date}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-2">
              {date === todayKey
                ? "Today"
                : formatDateKey(date, { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <div className="space-y-2">
              {grouped[date].map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 flex items-start gap-3",
                    a.isNew ? "border-brand-400 bg-brand-50/40" : "border-ink-200 bg-white",
                    a.status === "cancelled" && "opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                      TYPE_STYLE[a.type] || TYPE_STYLE.other
                    )}
                  >
                    {a.type === "work_order" ? (
                      <Wrench className="w-4 h-4" />
                    ) : a.type === "appointment" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <ClipboardList className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold text-ink-900", a.status === "cancelled" && "line-through")}>
                      {a.title}
                      {a.isNew && <Badge tone="danger" className="ml-2">New</Badge>}
                    </p>
                    <p className="text-[13px] text-ink-500">
                      {a.startTime ? formatClock(parseHhMm(a.startTime)) : "All day"}
                      {a.customerName ? ` · ${a.customerName}` : ""}
                      {a.entryId ? ` · Entry #${a.entryId}` : ""}
                    </p>
                    {a.details && <p className="text-[13px] text-ink-600 mt-1 break-words">{a.details}</p>}
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 shrink-0 max-sm:hidden">
                    {TYPE_LABEL[a.type] || a.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {dates.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-400">Nothing on your calendar right now.</p>
        )}
      </div>
    </Card>
  );
}

/* ---------------- my requests ---------------- */

export type RequestSummary = {
  id: number;
  type: string;
  subject: string;
  status: string;
  requestedDate: string;
  lastMessageAt: string;
  unreadForUser: boolean;
};
type Message = { id: number; authorRole: string; authorName: string; body: string; viaEmail: boolean; createdAt: string };

const STATUS_TONE: Record<string, "neutral" | "success" | "danger" | "warning"> = {
  open: "warning",
  approved: "success",
  declined: "danger",
  closed: "neutral",
};

/** Where a technician asks for time off, extra hours, or raises a concern. */
export function MyRequests({ requests: initial }: { requests: RequestSummary[] }) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ type: "day_off", subject: "", body: "", requestedDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");

  const submit = async () => {
    if (!draft.subject.trim() || !draft.body.trim()) {
      setError("Add a short title and explain what you need.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not send your request");
        return;
      }
      setDraft({ type: "day_off", subject: "", body: "", requestedDate: "" });
      setComposing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setMessages([]);
    const res = await fetch(`/api/requests/${id}`);
    const j = await res.json().catch(() => null);
    if (j?.messages) setMessages(j.messages);
    router.refresh();
  };

  const sendReply = async () => {
    if (!openId || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/requests/${openId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.messages) setMessages(j.messages);
      setReply("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <MessageSquarePlus className="w-4.5 h-4.5 text-ink-400" /> My requests
          </h2>
          <p className="text-[13px] text-ink-500 mt-0.5">
            Ask for a day off, extra hours, or raise anything with the shop manager.
          </p>
        </div>
        <Button size="sm" variant={composing ? "outline" : "primary"} onClick={() => setComposing((v) => !v)}>
          {composing ? <X className="w-4 h-4" /> : <MessageSquarePlus className="w-4 h-4" />}
          {composing ? "Cancel" : "New request"}
        </Button>
      </div>

      {composing && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 mb-4 animate-fade-up">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="What is it about" required>
              <Select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} className="h-11">
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" required className="sm:col-span-2">
              <Input
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                placeholder="e.g. Day off for a doctor's appointment"
                className="h-11"
              />
            </Field>
            <Field label="Which day" hint="If it is about a specific date">
              <Input
                type="date"
                value={draft.requestedDate}
                onChange={(e) => setDraft((d) => ({ ...d, requestedDate: e.target.value }))}
                className="h-11"
              />
            </Field>
            <Field label="Details" required className="sm:col-span-3">
              <Textarea
                value={draft.body}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                placeholder="Tell your manager what you need and why, so they can answer quickly."
                className="min-h-24"
              />
            </Field>
          </div>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <Button onClick={submit} disabled={busy}>
              {busy ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />} Send to the manager
            </Button>
            {error && <span className="text-sm font-medium text-brand-700">{error}</span>}
          </div>
        </div>
      )}

      <div className="divide-y divide-ink-100 -mx-5">
        {initial.map((r) => (
          <div key={r.id}>
            <button
              onClick={() => open(r.id)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-ink-50 transition-colors text-left"
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", r.unreadForUser ? "bg-brand-600" : "bg-transparent")} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900 truncate">{r.subject}</span>
                <span className="block text-[13px] text-ink-500 truncate">
                  {REQUEST_TYPE_LABEL[r.type] || r.type}
                  {r.requestedDate ? ` · ${formatDateKey(r.requestedDate, { weekday: "short", month: "short", day: "numeric" })}` : ""}
                  {r.unreadForUser ? " · new reply" : ""}
                </span>
              </span>
              <Badge tone={STATUS_TONE[r.status] || "neutral"}>{REQUEST_STATUS_LABEL[r.status] || r.status}</Badge>
            </button>

            {openId === r.id && (
              <div className="px-5 pb-4 space-y-2 animate-fade-up">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5",
                      m.authorRole === "admin" ? "border-brand-200 bg-brand-50/60" : "border-ink-200 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-bold text-ink-900">{m.authorName}</span>
                      {m.viaEmail && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-500">
                          <Mail className="w-3 h-3" /> by email
                        </span>
                      )}
                      <span className="text-[11px] text-ink-400 ml-auto">{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-ink-700 whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                ))}
                {messages.length === 0 && <Spinner className="text-brand-600 w-4 h-4" />}
                <div className="flex gap-2 pt-1">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendReply()}
                    placeholder="Add a message…"
                    className="h-10"
                  />
                  <Button size="sm" className="h-10 shrink-0" onClick={sendReply} disabled={busy || !reply.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {initial.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-ink-400">
            Nothing yet. Use “New request” to ask for time off or raise anything with your manager.
          </p>
        )}
      </div>
    </Card>
  );
}
