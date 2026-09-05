"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Plus, ShieldCheck, UserPlus, Wrench, X } from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, Spinner, Toggle } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";

type StaffUser = {
  id: number;
  username: string;
  name: string;
  role: "admin" | "tech";
  title: string;
  phone: string;
  email: string;
  active: boolean;
  bypassWorkHours: boolean;
  lastLoginAt: string | null;
};

/** A generated password, shown once and never retrievable again. */
type Credential = { name: string; username: string; password: string };

export function TeamAccounts() {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", role: "tech", title: "Driveshaft Technician" });

  const load = () =>
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((j) => setUsers(j.users || []))
      .catch(() => setUsers([]));

  useEffect(() => {
    load();
  }, []);

  const patch = async (id: number, body: Record<string, unknown>) => {
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error || "Could not save the change");
      await load();
      return null;
    }
    setUsers((list) => (list || []).map((u) => (u.id === id ? { ...u, ...j.user } : u)));
    return j;
  };

  const create = async () => {
    if (!draft.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not create the account");
        return;
      }
      setUsers((list) => [...(list || []), j.user]);
      setCredential({ name: j.user.name, username: j.user.username, password: j.password });
      setDraft({ name: "", role: "tech", title: "Driveshaft Technician" });
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (u: StaffUser) => {
    if (!confirm(`Generate a new password for ${u.name}? The current one stops working immediately.`)) return;
    const j = await patch(u.id, { resetPassword: true });
    if (j?.password) setCredential({ name: u.name, username: u.username, password: j.password });
  };

  if (!users) {
    return (
      <Card className="p-8 text-center">
        <Spinner className="text-brand-600" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">
            <KeyRound className="w-4.5 h-4.5" />
          </span>
          <div>
            <h2 className="font-bold leading-tight">Staff accounts</h2>
            <p className="text-[13px] text-ink-500">Who can sign in, with which role, and their passwords</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {adding ? "Cancel" : "Add person"}
        </Button>
      </div>

      {credential && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 animate-fade-up">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-emerald-900">Password for {credential.name}</p>
              <p className="text-[13px] text-emerald-800 mt-0.5">
                Write it down now — it is stored encrypted and cannot be shown again.
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <code className="px-3 py-2 rounded-lg bg-white border border-emerald-200 font-mono text-sm">
                  {credential.username}
                </code>
                <code className="px-3 py-2 rounded-lg bg-white border border-emerald-200 font-mono text-sm font-bold tracking-wide">
                  {credential.password}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigator.clipboard?.writeText(`${credential.username} / ${credential.password}`)
                  }
                >
                  <Copy className="w-4 h-4" /> Copy
                </Button>
              </div>
            </div>
            <button
              onClick={() => setCredential(null)}
              className="text-emerald-700 hover:text-emerald-900 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          {error}
        </div>
      )}

      {adding && (
        <div className="mb-5 rounded-xl border border-ink-200 bg-ink-50 p-4 animate-fade-up">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Full name" required>
              <Input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Jane Miller"
                className="h-10"
              />
            </Field>
            <Field label="Role">
              <Select
                value={draft.role}
                onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                className="h-10"
              >
                <option value="tech">Technician</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            <Field label="Job title">
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="h-10"
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" onClick={create} disabled={busy || !draft.name.trim()}>
              {busy ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Create account
            </Button>
            <p className="text-[13px] text-ink-500">A random password is generated and shown once.</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-5">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400 border-b border-ink-200">
              <th className="px-5 py-2">Person</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Last sign-in</th>
              <th className="px-3 py-2">Any hours</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-5 py-2 text-right">Password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {users.map((u) => (
              <tr key={u.id} className={cn("align-middle", !u.active && "opacity-55")}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        u.role === "admin" ? "bg-ink-900 text-white" : "bg-brand-600 text-white"
                      )}
                    >
                      {u.role === "admin" ? <ShieldCheck className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900 truncate">{u.name}</p>
                      <p className="text-[12px] text-ink-500 truncate">{u.title || "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-[13px] text-ink-600">{u.username}</td>
                <td className="px-3 py-3">
                  <Badge tone={u.role === "admin" ? "neutral" : "success"}>
                    {u.role === "admin" ? "Admin" : "Technician"}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-[13px] text-ink-500 whitespace-nowrap">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                </td>
                <td className="px-3 py-3">
                  <Toggle
                    checked={u.role === "admin" || u.bypassWorkHours}
                    disabled={u.role === "admin"}
                    onChange={(v) => {
                      setUsers((list) => list!.map((x) => (x.id === u.id ? { ...x, bypassWorkHours: v } : x)));
                      patch(u.id, { bypassWorkHours: v });
                    }}
                  />
                </td>
                <td className="px-3 py-3">
                  <Toggle
                    checked={u.active}
                    onChange={(v) => {
                      setUsers((list) => list!.map((x) => (x.id === u.id ? { ...x, active: v } : x)));
                      patch(u.id, { active: v });
                    }}
                  />
                </td>
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="outline" className="h-9" onClick={() => resetPassword(u)}>
                    <KeyRound className="w-4 h-4" /> Reset
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-ink-400 mt-4">
        “Any hours” lets someone sign in outside the posted working hours. Administrators always can.
      </p>
    </Card>
  );
}
