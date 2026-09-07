"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, KeyRound, Mail, MessageSquareText, Plus, Save, Send, Store, Trash2, Users } from "lucide-react";
import { Badge, Button, Card, Field, Input, Spinner, Toggle } from "@/components/ui";
import { ScheduleCard } from "./schedule-card";
import { ScoringCard } from "./scoring-card";
import type { DaySchedule } from "@/lib/work-hours";
import type { ScoringConfig } from "@/lib/performance-config";

type Settings = Record<string, unknown>;
type Employee = { id: number; name: string; active: boolean };
type Location = { id: number; name: string; twilioFrom: string | null; active: boolean };

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locationsList, setLocationsList] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [newEmployee, setNewEmployee] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ kind: string; ok: boolean; msg: string } | null>(null);
  const [testBusy, setTestBusy] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/admin/employees").then((r) => r.json()),
      fetch("/api/admin/locations").then((r) => r.json()),
    ]).then(([a, b, c]) => {
      setS(a.settings);
      setEmployees(b.employees || []);
      setLocationsList(c.locations || []);
    });
  }, []);

  const set = (key: string, value: unknown) => setS((prev) => ({ ...prev!, [key]: value }));

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const j = await res.json();
      if (res.ok) {
        setS(j.settings);
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(0), 2500);
      } else {
        alert(j.error || "Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (kind: "sms" | "email") => {
    setTestBusy(kind);
    setTestResult(null);
    try {
      // Save first so the test uses what's on screen.
      await save();
      const res = await fetch(`/api/test/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "sms" ? { to: testPhone } : { to: testEmail }),
      });
      const j = await res.json();
      setTestResult({
        kind,
        ok: res.ok && j.ok,
        msg: res.ok && j.ok ? `Test ${kind === "sms" ? "SMS" : "email"} sent successfully!` : j.error || "Failed to send",
      });
    } finally {
      setTestBusy("");
    }
  };

  const addEmployee = async () => {
    if (!newEmployee.trim()) return;
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newEmployee }),
    });
    const j = await res.json();
    if (res.ok) {
      setEmployees((e) => [...e, j.employee]);
      setNewEmployee("");
    }
  };

  const addLocation = async () => {
    if (!newLocation.trim()) return;
    const res = await fetch("/api/admin/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLocation }),
    });
    const j = await res.json();
    if (res.ok) {
      setLocationsList((l) => [...l, j.location]);
      setNewLocation("");
    }
  };

  if (!s) {
    return (
      <div className="py-24 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  const str = (k: string) => String(s[k] ?? "");
  const num = (k: string) => Number(s[k] ?? 0);
  const bool = (k: string) => Boolean(s[k]);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-ink-500 mt-0.5">Station, notifications and integration configuration</p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          Save changes
          {savedAt > 0 && <Badge tone="success" className="ml-1">Saved</Badge>}
        </Button>
      </div>

      {/* General */}
      <Card className="p-5">
        <SectionHeader icon={<Store className="w-4.5 h-4.5" />} title="General" subtitle="Business identity and check-in station behavior" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Business name">
            <Input value={str("businessName")} onChange={(e) => set("businessName", e.target.value)} />
          </Field>
          <Field label="Admin email" hint="Receives a notification for every new check-in">
            <Input value={str("adminEmail")} onChange={(e) => set("adminEmail", e.target.value)} inputMode="email" />
          </Field>
          <Field label="Turnaround banner" className="sm:col-span-2" hint="Shown at the top of the check-in form">
            <Input value={str("turnaroundBanner")} onChange={(e) => set("turnaroundBanner", e.target.value)} />
          </Field>
          <Field label="Help phone (shown in SMS consent text)">
            <Input value={str("helpPhone")} onChange={(e) => set("helpPhone", e.target.value)} inputMode="tel" />
          </Field>
          <div className="flex items-end pb-2">
            <Toggle
              checked={bool("adminNotifyEnabled")}
              onChange={(v) => set("adminNotifyEnabled", v)}
              label="Email admin on every new check-in"
            />
          </div>
          <Field label="Logo URL (email branding)" hint="Public image URL, e.g. your website logo. Shown in the email header">
            <Input value={str("logoUrl")} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://universaldriveshafts.com/…/logo.png" />
          </Field>
          <Field label="Brand color" hint="Accent color used in branded emails">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={str("brandColor") || "#dc2626"}
                onChange={(e) => set("brandColor", e.target.value)}
                className="w-12 h-12 rounded-xl border border-ink-300 bg-white p-1 cursor-pointer"
              />
              <Input value={str("brandColor")} onChange={(e) => set("brandColor", e.target.value)} placeholder="#dc2626" className="font-mono w-32" />
            </div>
          </Field>
          <Field
            label="Google Maps API key"
            hint="Enables address autocomplete on the check-in form. Needs the Places API enabled."
            className="sm:col-span-2"
          >
            <Input
              value={str("googleMapsKey")}
              onChange={(e) => set("googleMapsKey", e.target.value)}
              placeholder="AIza…"
              className="font-mono text-sm"
            />
          </Field>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-5">
        <SectionHeader
          icon={<KeyRound className="w-4.5 h-4.5" />}
          title="Security"
          subtitle="Session behavior for the station and the admin panel"
        />
        <p className="text-[13px] text-ink-600 mb-4">
          Everyone signs in with their own account. Passwords are created and reset in{" "}
          <Link href="/admin/team" className="font-semibold text-brand-700 hover:underline">
            Team → Staff accounts
          </Link>
          .
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Auto-lock after inactivity (minutes)" hint="0 disables auto-lock">
            <Input
              value={String(num("idleLockMinutes"))}
              onChange={(e) => set("idleLockMinutes", parseInt(e.target.value) || 0)}
              inputMode="numeric"
            />
          </Field>
          <Field label="Session duration (days)" hint="How long a device stays unlocked">
            <Input
              value={String(num("sessionDays"))}
              onChange={(e) => set("sessionDays", parseInt(e.target.value) || 30)}
              inputMode="numeric"
            />
          </Field>
        </div>
      </Card>

      <ScheduleCard
        hours={s.workHours}
        onChange={(v: DaySchedule[]) => set("workHours", v)}
        timezone={str("timezone")}
        onTimezoneChange={(v) => set("timezone", v)}
        early={num("earlyLoginMinutes")}
        onEarlyChange={(v) => set("earlyLoginMinutes", v)}
        late={num("lateLoginMinutes")}
        onLateChange={(v) => set("lateLoginMinutes", v)}
        grace={num("shiftSessionGraceMinutes")}
        onGraceChange={(v) => set("shiftSessionGraceMinutes", v)}
      />

      <ScoringCard scoring={s.scoring} onChange={(v: ScoringConfig) => set("scoring", v)} />

      {/* Staff requests */}
      <Card className="p-5">
        <SectionHeader
          icon={<Inbox className="w-4.5 h-4.5" />}
          title="Staff requests"
          subtitle="Where time-off and other staff requests are emailed, and how replies come back"
          right={
            <Toggle
              checked={bool("requestsEmailEnabled")}
              onChange={(v) => set("requestsEmailEnabled", v)}
              label={bool("requestsEmailEnabled") ? "Emailing" : "App only"}
            />
          }
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Send requests to" hint="Every new request and reply is emailed here">
            <Input value={str("requestsEmail")} onChange={(e) => set("requestsEmail", e.target.value)} inputMode="email" />
          </Field>
          <Field label="Celebration reminder (days ahead)" hint="How early birthdays and anniversaries appear">
            <Input
              value={String(num("celebrationLeadDays") || 7)}
              onChange={(e) => set("celebrationLeadDays", parseInt(e.target.value) || 0)}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="mt-5 pt-4 border-t border-ink-100">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-[15px]">Pull replies back in</h3>
              <p className="text-[13px] text-ink-500">
                Reads the mailbox that sends the emails, and files any reply carrying a request code onto the right
                thread. Leave it off to reply only from this panel.
              </p>
            </div>
            <Toggle
              checked={bool("imapEnabled")}
              onChange={(v) => set("imapEnabled", v)}
              label={bool("imapEnabled") ? "On" : "Off"}
            />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="IMAP host">
              <Input value={str("imapHost")} onChange={(e) => set("imapHost", e.target.value)} placeholder="imap.hostinger.com" />
            </Field>
            <Field label="Port">
              <Input
                value={String(num("imapPort") || 993)}
                onChange={(e) => set("imapPort", parseInt(e.target.value) || 993)}
                inputMode="numeric"
              />
            </Field>
            <Field label="Mailbox" hint="Defaults to the SMTP user">
              <Input value={str("imapUser")} onChange={(e) => set("imapUser", e.target.value)} inputMode="email" />
            </Field>
            <Field label="Password" hint="Defaults to the SMTP password">
              <Input type="password" value={str("imapPass")} onChange={(e) => set("imapPass", e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {/* Twilio */}
      <Card className="p-5">
        <SectionHeader
          icon={<MessageSquareText className="w-4.5 h-4.5" />}
          title="SMS — Twilio"
          subtitle="Customer SMS notifications on job status changes"
          right={<Toggle checked={bool("smsEnabled")} onChange={(v) => set("smsEnabled", v)} label={bool("smsEnabled") ? "Enabled" : "Disabled"} />}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Account SID">
            <Input value={str("twilioAccountSid")} onChange={(e) => set("twilioAccountSid", e.target.value)} placeholder="AC…" className="font-mono text-sm" />
          </Field>
          <Field label="Auth Token">
            <Input
              type="password"
              value={str("twilioAuthToken")}
              onChange={(e) => set("twilioAuthToken", e.target.value)}
              placeholder="Auth token"
              className="font-mono text-sm"
            />
          </Field>
          <Field label="From number" hint="E.164 format, e.g. +18135188438">
            <Input value={str("twilioFrom")} onChange={(e) => set("twilioFrom", e.target.value)} placeholder="+1…" className="font-mono text-sm" />
          </Field>
          <Field label="Messaging Service SID (optional)" hint="If set, used instead of the From number">
            <Input value={str("twilioMessagingServiceSid")} onChange={(e) => set("twilioMessagingServiceSid", e.target.value)} placeholder="MG…" className="font-mono text-sm" />
          </Field>
        </div>
        <TestRow
          label="Send test SMS to"
          placeholder="(813) 555-0123"
          value={testPhone}
          onChange={setTestPhone}
          onSend={() => runTest("sms")}
          busy={testBusy === "sms"}
          result={testResult?.kind === "sms" ? testResult : null}
        />
      </Card>

      {/* SMTP */}
      <Card className="p-5">
        <SectionHeader
          icon={<Mail className="w-4.5 h-4.5" />}
          title="Email — Hostinger SMTP"
          subtitle="Customer email notifications sent through your Hostinger mailbox"
          right={<Toggle checked={bool("emailEnabled")} onChange={(v) => set("emailEnabled", v)} label={bool("emailEnabled") ? "Enabled" : "Disabled"} />}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="SMTP host">
            <Input value={str("smtpHost")} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.hostinger.com" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Port">
              <Input value={String(num("smtpPort") || 465)} onChange={(e) => set("smtpPort", parseInt(e.target.value) || 465)} inputMode="numeric" />
            </Field>
            <div className="flex items-end pb-2">
              <Toggle checked={bool("smtpSecure")} onChange={(v) => set("smtpSecure", v)} label="SSL/TLS" />
            </div>
          </div>
          <Field label="Username (mailbox)" hint="Full email address, e.g. orders@universaldriveshafts.com">
            <Input value={str("smtpUser")} onChange={(e) => set("smtpUser", e.target.value)} inputMode="email" />
          </Field>
          <Field label="Password">
            <Input type="password" value={str("smtpPass")} onChange={(e) => set("smtpPass", e.target.value)} placeholder="Mailbox password" />
          </Field>
          <Field label="From name">
            <Input value={str("smtpFromName")} onChange={(e) => set("smtpFromName", e.target.value)} />
          </Field>
          <Field label="From email" hint="Usually the same as the username">
            <Input value={str("smtpFromEmail")} onChange={(e) => set("smtpFromEmail", e.target.value)} inputMode="email" />
          </Field>
        </div>
        <TestRow
          label="Send test email to"
          placeholder="you@email.com"
          value={testEmail}
          onChange={setTestEmail}
          onSend={() => runTest("email")}
          busy={testBusy === "email"}
          result={testResult?.kind === "email" ? testResult : null}
        />
      </Card>

      {/* Employees */}
      <Card className="p-5">
        <SectionHeader icon={<Users className="w-4.5 h-4.5" />} title="Employees" subtitle="Shown in the staff section dropdowns" />
        <div className="space-y-2 max-w-lg">
          {employees.map((e) => (
            <div key={e.id} className="flex items-center gap-3">
              <Input
                value={e.name}
                onChange={(ev) => setEmployees((list) => list.map((x) => (x.id === e.id ? { ...x, name: ev.target.value } : x)))}
                onBlur={(ev) =>
                  fetch("/api/admin/employees", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: e.id, name: ev.target.value }),
                  })
                }
                className="h-10"
              />
              <Toggle
                checked={e.active}
                onChange={(v) => {
                  setEmployees((list) => list.map((x) => (x.id === e.id ? { ...x, active: v } : x)));
                  fetch("/api/admin/employees", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: e.id, active: v }),
                  });
                }}
              />
              <Button
                variant="danger"
                size="sm"
                className="h-10 w-10 px-0 shrink-0"
                onClick={() => {
                  if (!confirm(`Remove ${e.name}?`)) return;
                  setEmployees((list) => list.filter((x) => x.id !== e.id));
                  fetch("/api/admin/employees", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: e.id }),
                  });
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <Input
              value={newEmployee}
              onChange={(e) => setNewEmployee(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEmployee()}
              placeholder="New employee name"
              className="h-10"
            />
            <Button size="sm" variant="outline" className="h-10 shrink-0" onClick={addEmployee}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>
      </Card>

      {/* Locations */}
      <Card className="p-5">
        <SectionHeader icon={<Store className="w-4.5 h-4.5" />} title="Locations" subtitle="Shops using this check-in (each can have its own Twilio number)" />
        <div className="space-y-2 max-w-2xl">
          {locationsList.map((l) => (
            <div key={l.id} className="flex items-center gap-3">
              <Input
                value={l.name}
                onChange={(ev) => setLocationsList((list) => list.map((x) => (x.id === l.id ? { ...x, name: ev.target.value } : x)))}
                onBlur={(ev) =>
                  fetch("/api/admin/locations", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: l.id, name: ev.target.value }),
                  })
                }
                className="h-10"
              />
              <Input
                value={l.twilioFrom || ""}
                placeholder="Twilio number (optional)"
                onChange={(ev) => setLocationsList((list) => list.map((x) => (x.id === l.id ? { ...x, twilioFrom: ev.target.value } : x)))}
                onBlur={(ev) =>
                  fetch("/api/admin/locations", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: l.id, twilioFrom: ev.target.value }),
                  })
                }
                className="h-10 font-mono text-sm"
              />
              <Toggle
                checked={l.active}
                onChange={(v) => {
                  setLocationsList((list) => list.map((x) => (x.id === l.id ? { ...x, active: v } : x)));
                  fetch("/api/admin/locations", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: l.id, active: v }),
                  });
                }}
              />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <Input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
              placeholder="New location name"
              className="h-10"
            />
            <Button size="sm" variant="outline" className="h-10 shrink-0" onClick={addLocation}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>
      </Card>

      {/* Sticky save on mobile */}
      <div className="fixed bottom-4 right-4 lg:hidden no-print">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-pop">
          {saving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />} Save
        </Button>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">{icon}</span>
        <div>
          <h2 className="font-bold leading-tight">{title}</h2>
          <p className="text-[13px] text-ink-500">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function TestRow({
  label,
  placeholder,
  value,
  onChange,
  onSend,
  busy,
  result,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  result: { ok: boolean; msg: string } | null;
}) {
  return (
    <div className="mt-5 pt-4 border-t border-ink-100">
      <div className="flex items-end gap-3 flex-wrap">
        <Field label={label} className="w-64 max-w-full">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10" />
        </Field>
        <Button size="sm" variant="secondary" className="h-10" onClick={onSend} disabled={busy || !value}>
          {busy ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />} Send test
        </Button>
        {result && (
          <Badge tone={result.ok ? "success" : "danger"} className="mb-2.5">
            {result.msg}
          </Badge>
        )}
      </div>
    </div>
  );
}
