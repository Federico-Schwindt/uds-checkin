"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Mail, Save } from "lucide-react";
import { Badge, Button, Card, Field, Input, Spinner, Textarea, Toggle } from "@/components/ui";
import { cn } from "@/lib/utils";

type Template = {
  id: number;
  key: string;
  channel: string;
  name: string;
  subject: string;
  body: string;
  enabled: boolean;
};

const GROUPS: Array<{ key: string; title: string; description: string }> = [
  { key: "submission", title: "Check-in received", description: "Sent immediately after a new check-in is completed" },
  { key: "confirmed", title: "Status → Confirmed", description: "Sent when the job status changes to Confirmed" },
  { key: "ongoing", title: "Status → Ongoing", description: "Sent when work begins on the order" },
  { key: "on_hold", title: "Status → On hold", description: "Sent when the order is placed on hold" },
  { key: "completed", title: "Status → Completed", description: "Sent when the order is ready for pickup" },
  { key: "admin_submission", title: "Admin notification", description: "Sent to the shop email on every new check-in" },
];

const VARIABLES = [
  "{first_name}", "{last_name}", "{full_name}", "{phone}", "{email}", "{job_number}",
  "{status}", "{on_hold_reason}", "{assigned_employee}", "{eta}", "{vehicle}",
  "{deposit}", "{total}", "{business_name}",
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((j) => setTemplates(j.templates || []))
      .finally(() => setLoading(false));
  }, []);

  const update = (id: number, patch: Partial<Template>) => {
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const save = async (t: Template, patch?: Partial<Template>) => {
    setSavingId(t.id);
    try {
      const res = await fetch("/api/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, subject: t.subject, body: t.body, enabled: t.enabled, ...patch }),
      });
      if (res.ok) {
        setSavedId(t.id);
        setTimeout(() => setSavedId(null), 2000);
      }
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Templates for customer SMS and email at every stage. Toggle any template off to stop sending it.
        </p>
      </div>

      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-2">Available variables</p>
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map((v) => (
            <code key={v} className="px-2 py-1 rounded-md bg-ink-100 text-[12px] font-mono text-ink-700">
              {v}
            </code>
          ))}
        </div>
      </Card>

      {GROUPS.map((g) => {
        const groupTemplates = templates.filter((t) => t.key === g.key);
        if (!groupTemplates.length) return null;
        return (
          <Card key={g.key} className="p-5">
            <div className="mb-4">
              <h2 className="font-bold">{g.title}</h2>
              <p className="text-sm text-ink-500">{g.description}</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-5">
              {groupTemplates.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "rounded-xl border p-4 transition-colors",
                    t.enabled ? "border-ink-200 bg-white" : "border-ink-200 bg-ink-50 opacity-75"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-2 font-semibold text-sm">
                      {t.channel === "sms" ? (
                        <MessageSquareText className="w-4 h-4 text-brand-600" />
                      ) : (
                        <Mail className="w-4 h-4 text-blue-600" />
                      )}
                      {t.channel === "sms" ? "SMS" : "Email"}
                      {savedId === t.id && <Badge tone="success">Saved</Badge>}
                    </span>
                    <Toggle
                      checked={t.enabled}
                      onChange={(v) => {
                        update(t.id, { enabled: v });
                        save({ ...t, enabled: v });
                      }}
                    />
                  </div>
                  {t.channel === "email" && (
                    <Field label="Subject" className="mb-3">
                      <Input value={t.subject} onChange={(e) => update(t.id, { subject: e.target.value })} className="h-10" />
                    </Field>
                  )}
                  <Field label={t.channel === "sms" ? "Message (keep it short — SMS)" : "Body"}>
                    <Textarea
                      value={t.body}
                      onChange={(e) => update(t.id, { body: e.target.value })}
                      className={t.channel === "sms" ? "min-h-28" : "min-h-40"}
                    />
                  </Field>
                  {t.channel === "sms" && (
                    <p className="text-xs text-ink-400 mt-1.5">{t.body.length} characters</p>
                  )}
                  <div className="mt-3">
                    <Button size="sm" onClick={() => save(t)} disabled={savingId === t.id}>
                      {savingId === t.id ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />} Save
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
