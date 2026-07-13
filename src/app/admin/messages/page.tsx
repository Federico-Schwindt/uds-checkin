"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Select, Spinner } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

type Row = {
  id: number;
  entryId: number | null;
  channel: string;
  recipient: string;
  templateKey: string;
  subject: string;
  body: string;
  status: string;
  providerId: string;
  error: string;
  createdAt: string;
};

function MessagesInner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the spinner while the fetch below runs
    setLoading(true);
    const usp = new URLSearchParams({ page: String(page) });
    if (channel) usp.set("channel", channel);
    if (status) usp.set("status", status);
    fetch(`/api/messages?${usp.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.rows || []);
        setTotal(j.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page, channel, status]);

  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Message Log</h1>
          <p className="text-sm text-ink-500 mt-0.5">{total} messages sent through Twilio and SMTP</p>
        </div>
        <div className="flex gap-2">
          <Select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} placeholder="All channels" className="h-10 w-36">
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} placeholder="All statuses" className="h-10 w-36">
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Spinner className="text-brand-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-20 text-center text-ink-400 text-sm">No messages logged yet.</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((m) => (
              <button
                key={m.id}
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                className="w-full text-left px-5 py-3.5 hover:bg-ink-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge tone={m.status === "sent" ? "success" : "danger"}>
                    {m.channel.toUpperCase()} {m.status}
                  </Badge>
                  <span className="font-semibold text-sm">{m.recipient}</span>
                  {m.templateKey && <span className="text-xs text-ink-400">({m.templateKey})</span>}
                  {m.entryId && (
                    <Link
                      href={`/admin/entries/${m.entryId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Entry #{m.entryId}
                    </Link>
                  )}
                  <span className="text-xs text-ink-400 ml-auto whitespace-nowrap">{formatDateTime(m.createdAt)}</span>
                </div>
                {m.error && <p className="text-xs text-brand-600 mt-1.5 font-medium">{m.error}</p>}
                <p className={"text-sm text-ink-600 mt-1.5 " + (expanded === m.id ? "whitespace-pre-wrap" : "line-clamp-1")}>
                  {m.subject ? `${m.subject} — ` : ""}
                  {m.body}
                </p>
              </button>
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-ink-200 bg-ink-50">
            <span className="text-xs text-ink-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesInner />
    </Suspense>
  );
}
