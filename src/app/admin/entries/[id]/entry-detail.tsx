"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  MessageSquareText,
  Pencil,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  SelectOptions,
  Spinner,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { cn, formatDateTime, formatMoney, formatPhone } from "@/lib/utils";
import formOptions from "@/lib/form-options.json";

/* ---------------- field definitions ---------------- */

type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "select" | "date" | "datetime" | "textarea" | "money";
  options?: string[];
  span2?: boolean;
};

const VEHICLE_FIELDS: FieldDef[] = [
  { key: "vehicleYear", label: "Year", type: "select", options: formOptions.years },
  { key: "vehicleMake", label: "Make", type: "select", options: formOptions.makes },
  { key: "vehicleModel", label: "Model" },
  { key: "drive", label: "Drive", type: "select", options: formOptions.drives },
  { key: "axleLocation", label: "Location", type: "select", options: formOptions.axleLocations },
  { key: "cab", label: "Cab", type: "select", options: formOptions.cabs },
  { key: "transmission", label: "Transmission", type: "select", options: formOptions.transmissions },
  { key: "transmissionSpeed", label: "Trans. Speed", type: "select", options: formOptions.transmissionSpeeds },
  { key: "engineSize", label: "Engine Size" },
  { key: "bedSize", label: "Bed Size", type: "select", options: formOptions.bedSizes },
  { key: "bedSizeOther", label: "Other Bed Size" },
  { key: "wheelbase", label: "Wheelbase" },
  { key: "horsePower", label: "Horse Power" },
  { key: "mileage", label: "Mileage" },
  { key: "stockVehicle", label: "Stock Vehicle", type: "select", options: formOptions.core },
  { key: "stockVehicleExplain", label: "Not Stock — Explain", span2: true },
  { key: "vin", label: "VIN" },
  { key: "saveOldParts", label: "Save Old Parts", type: "select", options: formOptions.core },
  { key: "complaint", label: "Complaint", type: "select", options: formOptions.complaints },
  { key: "complaintOther", label: "Complaint (other)", span2: true },
];

const JOB_FIELDS: FieldDef[] = [
  { key: "notes", label: "Notes / Reason of coming", type: "textarea", span2: true },
  { key: "laborRequest", label: "Labor Request", type: "select", options: formOptions.laborRequests },
  { key: "laborOther", label: "Other Labor" },
  { key: "driveshaftPieces", label: "Type of Driveshaft", type: "select", options: formOptions.driveshaftPieces },
  { key: "driveshaftMaterial", label: "Material", type: "select", options: formOptions.driveshaftMaterials },
  { key: "uJointSerial", label: "U-Joint Serial" },
  { key: "driveshaftTypeChoice", label: "Driveshaft Type", type: "select", options: formOptions.driveshaftTypes },
  { key: "measurementA", label: "A Measurement" },
  { key: "measurementB", label: "B Measurement" },
  { key: "measurementC", label: "C Measurement" },
  { key: "designerType", label: "Designer Type", type: "select", options: formOptions.designerTypes },
  { key: "howHeard", label: "How did they hear about us", type: "select", options: formOptions.howHeard },
];

const STAFF_FIELDS: FieldDef[] = [
  { key: "jobNumber", label: "Job Number" },
  { key: "employeeName", label: "Employee Name" },
  { key: "core", label: "Core", type: "select", options: formOptions.core },
  { key: "payment", label: "Payment", type: "select", options: formOptions.payments },
  { key: "deposit", label: "Deposit", type: "money" },
  { key: "total", label: "Total", type: "money" },
  { key: "confirmationDate", label: "Confirmation Date", type: "datetime" },
  { key: "timeOfJob", label: "Time of Job", type: "datetime" },
  { key: "signingDate", label: "Signing Date", type: "datetime" },
  { key: "etaJob", label: "ETA Job", type: "date" },
];

const CUSTOMER_FIELDS: FieldDef[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "street", label: "Street", span2: true },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
];

/* ---------------- types ---------------- */

type EntryData = Record<string, string | number | null>;
type CustomerData = Record<string, string | number | boolean | null> | null;
type PartRow = { id?: number; sku: string; name: string; qty: number; price: string | null };
type HistoryRow = { id: number; fromStatus: string; toStatus: string; note: string; createdAt: string };
type MessageRow = {
  id: number;
  channel: string;
  recipient: string;
  templateKey: string;
  status: string;
  error: string;
  createdAt: string;
  body: string;
};

export function EntryDetail({ id }: { id: number }) {
  const router = useRouter();
  const [entry, setEntry] = useState<EntryData | null>(null);
  const [customer, setCustomer] = useState<CustomerData>(null);
  const [partRows, setPartRows] = useState<PartRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftEntry, setDraftEntry] = useState<EntryData>({});
  const [draftCustomer, setDraftCustomer] = useState<Record<string, unknown>>({});
  const [draftParts, setDraftParts] = useState<PartRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [pendingReason, setPendingReason] = useState("");
  const [pendingEmployee, setPendingEmployee] = useState("");
  const [skipNotify, setSkipNotify] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/entries/${id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const j = await res.json();
    setEntry(j.entry);
    setCustomer(j.customer);
    setPartRows(j.parts || []);
    setHistory(j.history || []);
    setMessages(j.messages || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates happen after the fetch resolves
    load();
  }, [load]);

  const startEdit = () => {
    setDraftEntry({ ...entry! });
    setDraftCustomer({ ...(customer || {}) });
    setDraftParts(partRows.map((p) => ({ ...p, price: p.price ?? "" })));
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: draftEntry, customer: draftCustomer, parts: draftParts, skipNotify: true }),
      });
      if (res.ok) {
        const j = await res.json();
        setEntry(j.entry);
        setCustomer(j.customer);
        setPartRows(j.parts || []);
        setHistory(j.history || []);
        setEditing(false);
        setBanner({ tone: "ok", text: "Changes saved." });
      } else {
        setBanner({ tone: "err", text: "Failed to save changes." });
      }
    } finally {
      setSaving(false);
      setTimeout(() => setBanner(null), 4000);
    }
  };

  const applyStatus = async () => {
    if (!pendingStatus) return;
    setStatusBusy(true);
    try {
      const patch: Record<string, unknown> = { jobStatus: pendingStatus };
      if (pendingStatus === "On hold") patch.onHoldReason = pendingReason;
      if (pendingStatus === "Ongoing") patch.assignedEmployee = pendingEmployee;
      const res = await fetch(`/api/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: patch, skipNotify }),
      });
      const j = await res.json();
      if (res.ok) {
        setEntry(j.entry);
        setHistory(j.history || []);
        setMessages(j.messages || []);
        const sent: string[] = [];
        if (j.notified?.sms) sent.push("SMS");
        if (j.notified?.email) sent.push("email");
        setBanner({
          tone: "ok",
          text:
            `Status changed to ${pendingStatus}.` +
            (skipNotify
              ? " Notifications skipped."
              : sent.length
                ? ` Customer notified by ${sent.join(" + ")}.`
                : " No notification was sent (check Notifications settings / consent)."),
        });
      } else {
        setBanner({ tone: "err", text: j.error || "Failed to change status." });
      }
    } finally {
      setStatusBusy(false);
      setPendingStatus(null);
      setPendingReason("");
      setPendingEmployee("");
      setSkipNotify(false);
      setTimeout(() => setBanner(null), 6000);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete entry #${id}? This cannot be undone.`)) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    router.push("/admin/entries");
  };

  const vehicleLabel = useMemo(() => {
    if (!entry) return "";
    return [entry.vehicleYear, entry.vehicleMake, entry.vehicleModel].filter(Boolean).join(" ");
  }, [entry]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }
  if (!entry) {
    return (
      <div className="py-24 text-center text-ink-500">
        Entry not found.{" "}
        <Link className="text-brand-700 font-semibold" href="/admin/entries">
          Back to entries
        </Link>
      </div>
    );
  }

  const data = editing ? draftEntry : entry;
  const custData = (editing ? draftCustomer : customer) as Record<string, unknown> | null;

  const renderField = (f: FieldDef, source: "entry" | "customer") => {
    const obj = source === "entry" ? data : custData;
    const raw = obj?.[f.key];
    const value = raw == null ? "" : String(raw);
    if (!editing) {
      const display =
        f.type === "money"
          ? formatMoney(value)
          : f.key === "phone"
            ? formatPhone(value)
            : value || "—";
      return (
        <div key={f.key} className={cn("min-w-0", f.span2 && "sm:col-span-2")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{f.label}</p>
          <p className={cn("text-sm text-ink-900 mt-0.5 break-words", !value && "text-ink-300")}>{display}</p>
        </div>
      );
    }
    const setVal = (v: string) => {
      if (source === "entry") setDraftEntry((d) => ({ ...d, [f.key]: v }));
      else setDraftCustomer((d) => ({ ...d, [f.key]: v }));
    };
    return (
      <Field key={f.key} label={f.label} className={cn(f.span2 && "sm:col-span-2")}>
        {f.type === "select" ? (
          <Select value={value} onChange={(e) => setVal(e.target.value)} placeholder="—" className="h-10">
            <SelectOptions options={f.options || []} />
          </Select>
        ) : f.type === "textarea" ? (
          <Textarea value={value} onChange={(e) => setVal(e.target.value)} className="min-h-20" />
        ) : (
          <Input
            type={f.type === "datetime" ? "datetime-local" : f.type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => setVal(e.target.value)}
            className="h-10"
          />
        )}
      </Field>
    );
  };

  const grid = "grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <div>
          <Link
            href="/admin/entries"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-1"
          >
            <ArrowLeft className="w-4 h-4" /> Entries
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
            {custData?.firstName as string} {custData?.lastName as string}
            <StatusBadge status={String(entry.jobStatus)} />
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Entry #{entry.id}
            {entry.jobNumber ? ` · Job ${entry.jobNumber}` : ""} · {vehicleLabel || "No vehicle"} ·{" "}
            {formatDateTime(entry.createdAt as string)}
          </p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                <X className="w-4 h-4" /> Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={saving}>
                {saving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />} Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={startEdit}>
                <Pencil className="w-4 h-4" /> Edit
              </Button>
              <Button variant="danger" size="sm" onClick={remove}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm font-medium no-print",
            banner.tone === "ok"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-brand-50 border border-brand-200 text-brand-700"
          )}
        >
          {banner.text}
        </div>
      )}

      {/* Status changer */}
      {!editing && (
        <Card className="p-5 no-print">
          <h2 className="font-bold mb-3">Job status</h2>
          <div className="flex flex-wrap gap-2">
            {formOptions.jobStatuses.map((st) => {
              const active = entry.jobStatus === st;
              return (
                <button
                  key={st}
                  onClick={() => !active && setPendingStatus(st)}
                  className={cn(
                    "h-11 px-4 rounded-xl border font-semibold text-sm transition-all active:scale-[0.98]",
                    active
                      ? "border-brand-600 bg-brand-600 text-white cursor-default"
                      : "border-ink-300 bg-white text-ink-700 hover:border-brand-400"
                  )}
                >
                  {st}
                </button>
              );
            })}
          </div>

          {pendingStatus && (
            <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50 p-4 animate-fade-up space-y-4">
              <p className="text-sm font-semibold text-ink-800">
                Change status to <StatusBadge status={pendingStatus} /> ?
              </p>
              {pendingStatus === "On hold" && (
                <Field label="On Hold Reason">
                  <Select value={pendingReason} onChange={(e) => setPendingReason(e.target.value)} placeholder="Select reason" className="h-10 max-w-sm">
                    <SelectOptions options={formOptions.onHoldReasons} />
                  </Select>
                </Field>
              )}
              {pendingStatus === "Ongoing" && (
                <Field label="Assigned Employee">
                  <Select value={pendingEmployee} onChange={(e) => setPendingEmployee(e.target.value)} placeholder="Select employee" className="h-10 max-w-sm">
                    <SelectOptions options={formOptions.assignedEmployees} />
                  </Select>
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipNotify}
                  onChange={(e) => setSkipNotify(e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                Don&apos;t notify the customer for this change
              </label>
              <div className="flex gap-2">
                <Button size="sm" onClick={applyStatus} disabled={statusBusy}>
                  {statusBusy ? <Spinner className="w-4 h-4" /> : <MessageSquareText className="w-4 h-4" />}
                  Confirm{skipNotify ? "" : " & notify"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPendingStatus(null)} disabled={statusBusy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Customer */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Customer</h2>
          {custData?.smsConsent ? <Badge tone="success">SMS consent given</Badge> : <Badge tone="danger">No SMS consent</Badge>}
        </div>
        <div className={grid}>{CUSTOMER_FIELDS.map((f) => renderField(f, "customer"))}</div>
      </Card>

      {/* Vehicle */}
      <Card className="p-5">
        <h2 className="font-bold mb-4">Vehicle</h2>
        <div className={grid}>{VEHICLE_FIELDS.map((f) => renderField(f, "entry"))}</div>
        {!editing && (entry.vinPhoto as string) && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">VIN Photo</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.vinPhoto as string} alt="VIN" className="max-h-48 rounded-xl border border-ink-200" />
          </div>
        )}
      </Card>

      {/* Job */}
      <Card className="p-5">
        <h2 className="font-bold mb-4">Job details</h2>
        <div className={grid}>{JOB_FIELDS.map((f) => renderField(f, "entry"))}</div>
        {!editing && (entry.productImage as string) && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">Product Image</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.productImage as string} alt="Product" className="max-h-48 rounded-xl border border-ink-200" />
          </div>
        )}
      </Card>

      {/* Parts */}
      <Card className="p-5">
        <h2 className="font-bold mb-4">Parts used</h2>
        {editing ? (
          <div className="space-y-2">
            {draftParts.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_80px_100px_40px] gap-2">
                <Input value={p.sku} onChange={(e) => setDraftParts((ps) => ps.map((x, ix) => (ix === i ? { ...x, sku: e.target.value } : x)))} placeholder="SKU" className="h-10" />
                <Input value={p.name} onChange={(e) => setDraftParts((ps) => ps.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" className="h-10" />
                <Input value={String(p.qty)} onChange={(e) => setDraftParts((ps) => ps.map((x, ix) => (ix === i ? { ...x, qty: parseInt(e.target.value) || 1 } : x)))} className="h-10 text-center" />
                <Input value={p.price ?? ""} onChange={(e) => setDraftParts((ps) => ps.map((x, ix) => (ix === i ? { ...x, price: e.target.value } : x)))} placeholder="$" className="h-10" />
                <Button variant="danger" size="sm" className="h-10 w-10 px-0" onClick={() => setDraftParts((ps) => ps.filter((_, ix) => ix !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setDraftParts((ps) => [...ps, { sku: "", name: "", qty: 1, price: "" }])}>
              Add part
            </Button>
          </div>
        ) : partRows.length === 0 ? (
          <p className="text-sm text-ink-400">No parts recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500 border-b border-ink-200">
                <th className="py-2 font-semibold">SKU</th>
                <th className="py-2 font-semibold">Name</th>
                <th className="py-2 font-semibold text-center">Qty</th>
                <th className="py-2 font-semibold text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {partRows.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 font-mono text-xs">{p.sku || "—"}</td>
                  <td className="py-2.5">{p.name || "—"}</td>
                  <td className="py-2.5 text-center">{p.qty}</td>
                  <td className="py-2.5 text-right">{formatMoney(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Estimate & signatures */}
      <Card className="p-5">
        <h2 className="font-bold mb-4">Estimate authorization &amp; signatures</h2>
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Selected option</p>
            <p className="text-sm text-ink-900 mt-0.5">{(entry.estimateChoice as string) || "—"}</p>
            {(entry.estimateAmount as string) && (
              <p className="text-sm text-ink-600 mt-1">Max amount: ${entry.estimateAmount}</p>
            )}
          </div>
          <SignatureBox label={`Estimate signature ${entry.estimateDate ? `(${entry.estimateDate})` : ""}`} src={entry.estimateSignature as string} />
          <SignatureBox label="Terms & conditions signature" src={entry.finalSignature as string} />
        </div>
      </Card>

      {/* Staff */}
      <Card className="p-5">
        <h2 className="font-bold mb-4">Staff &amp; payment</h2>
        <div className={grid}>{STAFF_FIELDS.map((f) => renderField(f, "entry"))}</div>
        {!editing && String(entry.jobStatus) === "On hold" && (entry.onHoldReason as string) && (
          <p className="mt-3 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 inline-block">
            On hold: {entry.onHoldReason}
          </p>
        )}
        {!editing && String(entry.jobStatus) === "Ongoing" && (entry.assignedEmployee as string) && (
          <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
            Assigned to: {entry.assignedEmployee}
          </p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 no-print">
        {/* History */}
        <Card className="p-5">
          <h2 className="font-bold mb-4">Status history</h2>
          <ol className="space-y-3">
            {history.length === 0 && <p className="text-sm text-ink-400">No history.</p>}
            {[...history].reverse().map((h) => (
              <li key={h.id} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                <span className="text-ink-500 whitespace-nowrap">{formatDateTime(h.createdAt)}</span>
                <span className="font-medium">
                  {h.fromStatus ? `${h.fromStatus} → ` : ""}
                  {h.toStatus}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        {/* Messages */}
        <Card className="p-5">
          <h2 className="font-bold mb-4">Messages sent</h2>
          <ol className="space-y-3">
            {messages.length === 0 && <p className="text-sm text-ink-400">No messages for this entry.</p>}
            {[...messages].reverse().map((m) => (
              <li key={m.id} className="text-sm border-b border-ink-100 pb-3 last:border-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={m.status === "sent" ? "success" : "danger"}>
                    {m.channel.toUpperCase()} {m.status}
                  </Badge>
                  <span className="text-ink-500">{m.recipient}</span>
                  <span className="text-ink-400 text-xs ml-auto">{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="text-ink-600 mt-1.5 line-clamp-2">{m.error || m.body}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function SignatureBox({ label, src }: { label: string; src: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1.5">{label}</p>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-28 w-full object-contain rounded-xl border border-ink-200 bg-white" />
      ) : (
        <div className="h-28 rounded-xl border border-dashed border-ink-200 flex items-center justify-center text-xs text-ink-400">
          Not signed
        </div>
      )}
    </div>
  );
}
