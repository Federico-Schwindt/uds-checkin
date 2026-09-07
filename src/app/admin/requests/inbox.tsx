"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Inbox,
  Mail,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { Badge, Button, Card, Spinner, Textarea } from "@/components/ui";
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL } from "@/lib/request-types";
import { cn, formatDateTime } from "@/lib/utils";
import { formatDateKey } from "@/lib/work-hours";

type RequestRow = {
  id: number;
  userId: number;
  type: string;
  subject: string;
  requestedDate: string;
  requestedEndDate: string;
  status: string;
  token: string;
  lastMessageAt: string;
  unreadForAdmin: boolean;
  createdAt: string;
};
type Row = { request: RequestRow; userName: string | null; userTitle: string | null };
type Message = {
  id: number;
  authorRole: string;
  authorName: string;
  body: string;
  viaEmail: boolean;
  createdAt: string;
};

const STATUS_TONE: Record<string, "neutral" | "success" | "danger" | "warning"> = {
  open: "warning",
  approved: "success",
  declined: "danger",
  closed: "neutral",
};

export function RequestsInbox({
  inboxEmail,
  emailEnabled,
  replyPollEnabled,
}: {
  inboxEmail: string;
  emailEnabled: boolean;
  replyPollEnabled: boolean;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [thread, setThread] = useState<{ row: Row; messages: Message[] } | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests${filter ? `?status=${filter}` : ""}`);
    const j = await res.json().catch(() => ({}));
    setRows(j.requests || []);
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates happen after the fetch resolves
    load();
  }, [load]);

  const openThread = async (id: number) => {
    setOpenId(id);
    setThread(null);
    const res = await fetch(`/api/requests/${id}`);
    const j = await res.json().catch(() => null);
    if (j?.request) {
      setThread({ row: { request: j.request, userName: j.userName, userTitle: j.userTitle }, messages: j.messages || [] });
      load();
    }
  };

  const send = async (status?: string) => {
    if (!openId || (!reply.trim() && !status)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/requests/${openId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim(), status }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(j.error || "Could not send the reply");
        return;
      }
      setReply("");
      setThread({ row: { request: j.request, userName: j.userName, userTitle: j.userTitle }, messages: j.messages || [] });
      load();
    } finally {
      setBusy(false);
      setTimeout(() => setNotice(""), 5000);
    }
  };

  const checkEmail = async () => {
    setPolling(true);
    setNotice("");
    try {
      const res = await fetch("/api/inbound/poll", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (j.error) setNotice(j.error);
      else setNotice(`Checked ${j.checked} message${j.checked === 1 ? "" : "s"} · imported ${j.imported}`);
      load();
      if (openId) openThread(openId);
    } finally {
      setPolling(false);
      setTimeout(() => setNotice(""), 8000);
    }
  };

  if (!rows) {
    return (
      <div className="py-24 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  const unread = rows.filter((r) => r.request.unreadForAdmin).length;

  /* ---------- one thread ---------- */
  if (openId && thread) {
    const r = thread.row.request;
    return (
      <div className="space-y-5">
        <button
          onClick={() => {
            setOpenId(null);
            setThread(null);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800"
        >
          <ArrowLeft className="w-4 h-4" /> All requests
        </button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{r.subject}</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {thread.row.userName} · {REQUEST_TYPE_LABEL[r.type] || r.type}
            {r.requestedDate ? ` · for ${formatDateKey(r.requestedDate, { weekday: "short", month: "short", day: "numeric" })}` : ""}
            {r.requestedEndDate ? ` → ${formatDateKey(r.requestedEndDate, { month: "short", day: "numeric" })}` : ""}
            {" · "}
            <span className="font-mono text-[12px]">{r.token}</span>
          </p>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge tone={STATUS_TONE[r.status] || "neutral"}>{REQUEST_STATUS_LABEL[r.status] || r.status}</Badge>
            <span className="text-[13px] text-ink-400">Set the outcome:</span>
            {(["approved", "declined", "closed"] as const).map((st) => (
              <Button
                key={st}
                size="sm"
                variant={r.status === st ? "primary" : "outline"}
                className="h-9"
                onClick={() => send(st)}
                disabled={busy}
              >
                {st === "approved" ? <Check className="w-4 h-4" /> : st === "declined" ? <X className="w-4 h-4" /> : null}
                {REQUEST_STATUS_LABEL[st]}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {thread.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-xl border px-4 py-3",
                  m.authorRole === "admin" ? "border-brand-200 bg-brand-50/60 ml-auto max-w-[85%]" : "border-ink-200 bg-white max-w-[85%]"
                )}
              >
                <div className="flex items-center gap-2 flex-wrap mb-1">
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
          </div>

          <div className="mt-5 pt-4 border-t border-ink-100">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={`Reply to ${thread.row.userName?.split(" ")[0] || "the team"}…`}
              className="min-h-24"
            />
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <Button onClick={() => send()} disabled={busy || !reply.trim()}>
                {busy ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />} Send reply
              </Button>
              <span className="text-[13px] text-ink-500">
                They see it on their panel{emailEnabled && inboxEmail ? `, and a copy goes to ${inboxEmail}` : ""}.
              </span>
              {notice && <span className="text-sm font-medium text-brand-700">{notice}</span>}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  /* ---------- inbox ---------- */
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Staff requests {unread > 0 && <span className="text-brand-600">({unread} new)</span>}
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Time off, extra hours, concerns — everything the team raises
            {inboxEmail ? `, also emailed to ${inboxEmail}` : ""}.
          </p>
        </div>
        {replyPollEnabled && (
          <Button variant="outline" size="sm" onClick={checkEmail} disabled={polling}>
            {polling ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />} Check for email replies
          </Button>
        )}
      </div>

      {notice && (
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-700">
          {notice}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {["", "open", "approved", "declined", "closed"].map((st) => (
          <button
            key={st || "all"}
            onClick={() => setFilter(st)}
            className={cn(
              "h-9 px-3.5 rounded-xl border text-sm font-semibold transition-colors",
              filter === st ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white text-ink-700 hover:border-brand-400"
            )}
          >
            {st ? REQUEST_STATUS_LABEL[st] : "All"}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="divide-y divide-ink-100">
          {rows.map(({ request: r, userName }) => (
            <button
              key={r.id}
              onClick={() => openThread(r.id)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-ink-50 transition-colors text-left"
            >
              <span
                className={cn("w-2 h-2 rounded-full shrink-0", r.unreadForAdmin ? "bg-brand-600" : "bg-transparent")}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink-900 truncate">
                  {r.subject}
                  <span className="text-ink-400 font-normal"> · {userName}</span>
                </span>
                <span className="block text-[13px] text-ink-500 truncate">
                  {REQUEST_TYPE_LABEL[r.type] || r.type}
                  {r.requestedDate ? ` · ${formatDateKey(r.requestedDate, { weekday: "short", month: "short", day: "numeric" })}` : ""}
                </span>
              </span>
              <span className="text-[12px] text-ink-400 whitespace-nowrap max-sm:hidden">
                {formatDateTime(r.lastMessageAt)}
              </span>
              <Badge tone={STATUS_TONE[r.status] || "neutral"}>{REQUEST_STATUS_LABEL[r.status] || r.status}</Badge>
            </button>
          ))}
          {rows.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-ink-400">
              <Inbox className="w-7 h-7 mx-auto mb-2 text-ink-300" />
              Nothing here. Requests your team submits show up in this list.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
