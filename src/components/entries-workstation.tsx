"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  MapPin,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { Card, Input, Select, Spinner } from "@/components/ui";
import {
  EntryRow,
  InlineChoice,
  InlineFields,
  InlineStatus,
  InlineText,
  RowEditButton,
  paymentBadge,
} from "@/components/quick-edit";
import { cn, formatDateTime, formatMoney, formatPhone } from "@/lib/utils";
import formOptions from "@/lib/form-options.json";

const LOCATION_KEY = "uds-location-id";

export type LocationOption = { id: number; name: string };

type Toast = { tone: "ok" | "err"; text: string };

export function getStoredLocation(): number | null {
  try {
    const v = localStorage.getItem(LOCATION_KEY);
    return v ? parseInt(v) : null;
  } catch {
    return null;
  }
}

/* ================= Location picker ================= */

export function LocationPicker({
  locations,
  value,
  onChange,
}: {
  locations: LocationOption[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  if (locations.length <= 1) return null;
  return (
    <div className="inline-flex items-center gap-2">
      <MapPin className="w-4 h-4 text-brand-600" />
      <Select
        value={value ? String(value) : ""}
        onChange={(e) => onChange(parseInt(e.target.value))}
        placeholder="Location…"
        className="h-12 w-44"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Full-screen overlay shown once per device when several locations exist and none is chosen. */
function LocationGate({ locations, onPick }: { locations: LocationOption[]; onPick: (id: number) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-pop p-8 w-full max-w-md text-center animate-fade-up">
        <MapPin className="w-10 h-10 text-brand-600 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-1">Which location is this station at?</h2>
        <p className="text-sm text-ink-500 mb-6">New check-ins from this device will be tagged with it.</p>
        <div className="grid gap-2.5">
          {locations.map((l) => (
            <button
              key={l.id}
              onClick={() => onPick(l.id)}
              className="h-14 rounded-xl border-2 border-ink-200 font-bold text-ink-800 hover:border-brand-500 hover:bg-brand-50 active:scale-[0.98] transition-all"
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= Column config ================= */

function ColumnsConfig({ cols, onChange }: { cols: ColumnPref[]; onChange: (next: ColumnPref[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    const next = [...cols];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const toggle = (i: number) => {
    if (cols[i].key === "customer") return;
    const next = cols.map((c, ix) => (ix === i ? { ...c, visible: !c.visible } : c));
    onChange(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="h-12 w-12 rounded-xl border border-ink-300 bg-white flex items-center justify-center text-ink-500 hover:border-ink-400 hover:text-ink-700 active:scale-95 transition-all"
        title="Configure columns"
        aria-label="Configure columns"
      >
        <Settings2 className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute z-40 right-0 top-full mt-1.5 bg-white rounded-xl border border-ink-200 shadow-pop p-2 w-64 animate-fade-up">
          <p className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">Table columns</p>
          {cols.map((c, i) => (
            <div key={c.key} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-ink-50">
              <button
                onClick={() => toggle(i)}
                disabled={c.key === "customer" || c.key === "jobNumber"}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                  c.key === "customer" || c.key === "jobNumber"
                    ? "text-ink-300"
                    : c.visible
                      ? "text-brand-600 hover:bg-brand-50"
                      : "text-ink-400 hover:bg-ink-100"
                )}
                aria-label={c.visible ? "Hide column" : "Show column"}
              >
                {c.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <span className={cn("flex-1 text-sm font-medium", !c.visible && "text-ink-400 line-through")}>
                {COLUMN_LABELS[c.key]}
              </span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0 || i === 1 || c.key === "jobNumber"}
                className="w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === cols.length - 1 || c.key === "jobNumber"}
                className="w-7 h-7 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= Workstation table ================= */

export type ColumnPref = { key: string; visible: boolean };

const COLUMN_LABELS: Record<string, string> = {
  jobNumber: "Job",
  customer: "Customer",
  phone: "Cell (texts)",
  companyPhone: "Company phone",
  vehicle: "Vehicle",
  status: "Status",
  payment: "Payment",
  total: "Total",
  eta: "ETA",
  createdBy: "Taken by",
  date: "Date",
};

const DEFAULT_COLUMNS: ColumnPref[] = Object.keys(COLUMN_LABELS).map((key) => ({ key, visible: true }));

/** Columns added after a layout was saved, and the column each one joins. */
const COLUMN_AFTER: Record<string, string> = { companyPhone: "phone" };

function normalizeColumns(prefs: ColumnPref[] | null | undefined): ColumnPref[] {
  const out: ColumnPref[] = [];
  for (const p of prefs || []) {
    if (COLUMN_LABELS[p.key] && !out.some((o) => o.key === p.key)) out.push({ key: p.key, visible: p.visible !== false });
  }
  for (const d of DEFAULT_COLUMNS) {
    if (out.some((o) => o.key === d.key)) continue;
    const at = COLUMN_AFTER[d.key] ? out.findIndex((o) => o.key === COLUMN_AFTER[d.key]) : -1;
    if (at >= 0) out.splice(at + 1, 0, { ...d });
    else out.push({ ...d });
  }
  // Job and customer identify the row, so neither can be hidden, and the job
  // leads the table even when the saved preference predates that.
  for (const key of ["jobNumber", "customer"]) {
    const col = out.find((o) => o.key === key);
    if (col) col.visible = true;
  }
  const jobAt = out.findIndex((o) => o.key === "jobNumber");
  if (jobAt > 0) out.unshift(out.splice(jobAt, 1)[0]);
  return out;
}

export function EntriesWorkstation({
  locations,
  initialColumns,
}: {
  locations: LocationOption[];
  initialColumns?: ColumnPref[] | null;
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [cols, setCols] = useState<ColumnPref[]>(() => normalizeColumns(initialColumns));
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const pageSize = 15;

  const pickLocation = useCallback((id: number, resetPage = true) => {
    setLocationId(id);
    try {
      localStorage.setItem(LOCATION_KEY, String(id));
    } catch {}
    if (resetPage) setPage(1);
  }, []);

  // Device location: restore, validate, or ask.
  useEffect(() => {
    const stored = getStoredLocation();
    const valid = stored != null && locations.some((l) => l.id === stored);
    if (locations.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time device-location restore after hydration
      pickLocation(locations[0].id, false);
    } else if (valid) {
       
      setLocationId(stored);
    }
    setLocationReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qLive);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [qLive]);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const usp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (q) usp.set("q", q);
      if (status) usp.set("status", status);
      if (locationId != null && locations.length > 1) usp.set("locationId", String(locationId));
      const res = await fetch(`/api/entries?${usp.toString()}`);
      const j = await res.json();
      setRows(j.rows || []);
      setTotal(j.total || 0);
      setStatusCounts(j.statusCounts || {});
    } finally {
      setLoading(false);
    }
  }, [page, q, status, locationId, locations.length]);

  useEffect(() => {
    if (locationReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load() flips the loading flag for the fetch it starts
      load();
    }
  }, [load, locationReady]);

  /** PATCH helper for inline edits; merges the row locally on success. */
  const patchRow = useCallback(
    async (row: EntryRow, body: Record<string, unknown>, okText?: string) => {
      const res = await fetch(`/api/entries/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast({ tone: "err", text: j.error || "Failed to save" });
        return;
      }
      setRows((rs) =>
        rs.map((r) =>
          r.id === row.id
            ? {
                ...r,
                ...(j.entry
                  ? {
                      jobNumber: j.entry.jobNumber,
                      jobStatus: j.entry.jobStatus,
                      payment: j.entry.payment,
                      total: j.entry.total,
                      deposit: j.entry.deposit,
                      etaJob: j.entry.etaJob,
                      onHoldReason: j.entry.onHoldReason,
                      assignedEmployee: j.entry.assignedEmployee,
                      vehicleYear: j.entry.vehicleYear,
                      vehicleMake: j.entry.vehicleMake,
                      vehicleModel: j.entry.vehicleModel,
                      laborRequest: j.entry.laborRequest,
                    }
                  : {}),
                ...(j.customer
                  ? {
                      phone: j.customer.phone,
                      companyPhone: j.customer.companyPhone,
                      firstName: j.customer.firstName,
                      lastName: j.customer.lastName,
                    }
                  : {}),
              }
            : r
        )
      );
      if (j.statusChanged) {
        const sent: string[] = [];
        if (j.notified?.sms) sent.push("SMS");
        if (j.notified?.email) sent.push("email");
        showToast({
          tone: "ok",
          text:
            `Status → ${j.entry.jobStatus}.` +
            (body.skipNotify
              ? " Notification skipped."
              : sent.length
                ? ` Customer notified by ${sent.join(" + ")}.`
                : " No notification sent (check settings/consent)."),
        });
      } else if (okText) {
        showToast({ tone: "ok", text: okText });
      }
    },
    [showToast]
  );

  const saveColumns = useCallback((next: ColumnPref[]) => {
    setCols(next);
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kioskColumns: next }),
    }).catch(() => {});
  }, []);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const needsGate = locationReady && locations.length > 1 && locationId == null;
  const visibleCols = cols.filter((c) => c.visible);

  const headerFor = (key: string) => {
    const right = key === "total" || key === "date";
    return (
      <th key={key} className={cn("px-3 py-3 font-semibold whitespace-nowrap", right && "text-right", key === "customer" && "px-4")}>
        {COLUMN_LABELS[key]}
      </th>
    );
  };

  const cellFor = (key: string, r: EntryRow) => {
    switch (key) {
      case "customer":
        return (
          <td key={key} className="px-2.5 py-2">
            <div className="flex items-center gap-1">
              <InlineFields
                title="Customer name"
                display={`${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()}
                placeholder="No customer"
                className="font-semibold text-ink-900"
                fields={[
                  { key: "firstName", label: "First name", value: r.firstName || "" },
                  { key: "lastName", label: "Last name", value: r.lastName || "" },
                ]}
                onSave={(v) => patchRow(r, { customer: v }, "Customer name updated.")}
              />
              <button
                onClick={() => router.push(`/entry/${r.id}`)}
                title="Open entry"
                aria-label="Open entry"
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-ink-300 hover:bg-ink-100 hover:text-brand-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        );
      case "phone":
        return (
          <td key={key} className="px-1.5 py-2 w-36">
            <InlineText
              value={formatPhone(r.phone || "")}
              onSave={(v) => patchRow(r, { customer: { phone: v } }, "Cell phone updated.")}
              inputMode="tel"
              placeholder="No phone"
              className="font-bold text-ink-900"
            />
          </td>
        );
      case "companyPhone":
        return (
          <td key={key} className="px-1.5 py-2 w-36">
            <InlineText
              value={formatPhone(r.companyPhone || "")}
              onSave={(v) => patchRow(r, { customer: { companyPhone: v } }, "Company phone updated.")}
              inputMode="tel"
              placeholder="—"
              className="text-ink-900"
            />
          </td>
        );
      case "vehicle":
        return (
          <td key={key} className="px-1.5 py-2 w-48">
            <InlineFields
              title="Vehicle"
              display={[r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(" ")}
              placeholder="No vehicle"
              fields={[
                { key: "vehicleYear", label: "Year", value: r.vehicleYear || "", inputMode: "numeric" },
                { key: "vehicleMake", label: "Make", value: r.vehicleMake || "" },
                { key: "vehicleModel", label: "Model", value: r.vehicleModel || "" },
              ]}
              onSave={(v) => patchRow(r, { entry: v }, "Vehicle updated.")}
            />
          </td>
        );
      case "jobNumber":
        return (
          <td key={key} className="px-2 py-2 min-w-[10.5rem]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => router.push(`/entry/${r.id}`)}
                className="group px-2 py-1 rounded-lg text-left transition-colors hover:bg-brand-50 flex-1 min-w-0"
                title="Open this job"
              >
                <span className="block font-bold text-brand-700 group-hover:underline break-words">
                  {r.jobNumber || `Entry #${r.id}`}
                </span>
                {r.jobNumber && <span className="block text-[11px] text-ink-400">#{r.id}</span>}
              </button>
              <InlineFields
                as="pencil"
                title="Job name / number"
                fields={[{ key: "jobNumber", label: "Job name / number", value: r.jobNumber || "" }]}
                onSave={(v) => patchRow(r, { entry: v }, "Job name updated.")}
              />
            </div>
          </td>
        );
      case "status":
        return (
          <td key={key} className="px-1.5 py-2">
            <InlineStatus row={r} onApply={(patch, skipNotify) => patchRow(r, { entry: patch, skipNotify })} />
          </td>
        );
      case "payment":
        return (
          <td key={key} className="px-1.5 py-2">
            <InlineChoice
              value={r.payment}
              options={formOptions.payments}
              title="Payment"
              onSave={(v) => patchRow(r, { entry: { payment: v } }, "Payment updated.")}
              render={(v) => paymentBadge(v)}
            />
          </td>
        );
      case "total":
        return (
          <td key={key} className="px-1.5 py-2 text-right w-28">
            <InlineText
              value={r.total ?? ""}
              display={r.total ? formatMoney(r.total) : ""}
              onSave={(v) => patchRow(r, { entry: { total: v.replace(/[^0-9.]/g, "") || null } }, "Total updated.")}
              align="right"
              inputMode="decimal"
              placeholder="—"
            />
          </td>
        );
      case "eta":
        return (
          <td key={key} className="px-1.5 py-2 w-36">
            <InlineText
              value={r.etaJob}
              onSave={(v) => patchRow(r, { entry: { etaJob: v } }, "ETA updated.")}
              placeholder="—"
            />
          </td>
        );
      case "createdBy":
        return (
          <td key={key} className="px-3 py-2 text-ink-600 whitespace-nowrap">
            {r.createdByName || <span className="text-ink-300">—</span>}
          </td>
        );
      case "date":
        return (
          <td key={key} className="px-3 py-2 text-right text-ink-500 whitespace-nowrap text-xs">
            {formatDateTime(r.createdAt)}
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {needsGate && <LocationGate locations={locations} onPick={pickLocation} />}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0 order-1">
          <Search className="w-4.5 h-4.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <Input
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            placeholder="Search name, phone, job #, vehicle…"
            className="pl-10 h-12 bg-white"
          />
          {qLive && (
            <button
              onClick={() => setQLive("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar order-3 sm:order-2 basis-full sm:basis-auto -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
          {["", "New", "Confirmed", "Ongoing", "On hold", "Completed"].map((st) => {
            const n = statusCounts[st || "All"] ?? 0;
            const active = status === st;
            return (
              <button
                key={st || "all"}
                onClick={() => {
                  setStatus(st);
                  setPage(1);
                }}
                className={cn(
                  "h-12 px-4 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all active:scale-[0.97] inline-flex items-center gap-2",
                  active
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-ink-300 bg-white text-ink-600 hover:border-ink-400"
                )}
              >
                {st || "All"}
                <span
                  className={cn(
                    "min-w-6 px-1.5 h-6 rounded-full text-xs font-bold inline-flex items-center justify-center",
                    active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <div className="order-2 sm:order-3 flex items-center gap-2 shrink-0">
          <LocationPicker locations={locations} value={locationId} onChange={pickLocation} />
          <ColumnsConfig cols={cols} onChange={saveColumns} />
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2.5 pb-2">
        {loading ? (
          <div className="py-16 text-center">
            <Spinner className="text-brand-600" />
          </div>
        ) : rows.length === 0 ? (
          <Card className="py-14 text-center text-ink-400 text-sm">No entries yet. Start a new check-in above.</Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => router.push(`/entry/${r.id}`)}
                    className="font-bold text-brand-700 hover:underline flex items-center gap-1.5 text-left"
                    title="Open entry"
                  >
                    {r.jobNumber ? `Job ${r.jobNumber}` : `Entry #${r.id}`}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <button
                    onClick={() => router.push(`/entry/${r.id}`)}
                    className="block text-left font-semibold text-ink-900 truncate max-w-full"
                  >
                    {r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() : `Entry #${r.id}`}
                  </button>
                </div>
                <InlineStatus row={r} onApply={(patch, skipNotify) => patchRow(r, { entry: patch, skipNotify })} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                <button onClick={() => router.push(`/entry/${r.id}`)} className="text-ink-600 truncate text-left">
                  {[r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(" ") || "No vehicle"}
                </button>
                <span className="text-ink-400 text-xs whitespace-nowrap">{formatDateTime(r.createdAt)}</span>
              </div>
              {r.createdByName && (
                <p className="mt-1 text-[11px] text-ink-400">Checked in by {r.createdByName}</p>
              )}
              {r.companyPhone && (
                <p className="mt-1 text-[13px] text-ink-500">
                  Company:{" "}
                  <a href={`tel:${r.companyPhone.replace(/\D/g, "")}`} className="text-brand-700 font-semibold">
                    {formatPhone(r.companyPhone)}
                  </a>
                </p>
              )}
              <div className="mt-2.5 pt-2.5 border-t border-ink-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <a href={`tel:${(r.phone || "").replace(/\D/g, "")}`} className="text-brand-700 font-bold text-sm">
                    {formatPhone(r.phone || "") || "—"}
                  </a>
                  {/* Left of centre, so the floating New button never sits on it. */}
                  <RowEditButton
                    row={r}
                    variant="button"
                    onSave={(patch) => patchRow(r, patch, "Job updated.")}
                    onOpenEntry={() => router.push(`/entry/${r.id}`)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <InlineChoice
                    value={r.payment}
                    options={formOptions.payments}
                    title="Payment"
                    onSave={(v) => patchRow(r, { entry: { payment: v } }, "Payment updated.")}
                    render={(v) => paymentBadge(v, "Payment")}
                  />
                  <span className="font-semibold text-ink-900 text-sm">{r.total ? formatMoney(r.total) : ""}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Mobile pagination */}
      {rows.length > 0 && (
        <div className="sm:hidden flex items-center justify-between px-1 pb-20">
          <span className="text-xs text-ink-500">
            {total} entries · page {page}/{pages}
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="w-10 h-10 rounded-lg border border-ink-300 bg-white flex items-center justify-center disabled:opacity-35 active:scale-95"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="w-10 h-10 rounded-lg border border-ink-300 bg-white flex items-center justify-center disabled:opacity-35 active:scale-95"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table (tablet & up) */}
      <Card className="overflow-hidden max-sm:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500 border-b border-ink-200 bg-ink-50">
                {visibleCols.map((c) => headerFor(c.key))}
                <th className="px-2 py-3 font-semibold text-right whitespace-nowrap w-14">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="px-4 py-16 text-center">
                    <Spinner className="text-brand-600" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="px-4 py-16 text-center text-ink-400">
                    No entries yet. Start a new check-in above.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="group/row hover:bg-ink-50/60 transition-colors">
                    {visibleCols.map((c) => cellFor(c.key, r))}
                    <td className="px-2 py-2 text-right">
                      <RowEditButton
                        row={r}
                        onSave={(patch) => patchRow(r, patch, "Job updated.")}
                        onOpenEntry={() => router.push(`/entry/${r.id}`)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-ink-200 bg-ink-50">
          <span className="text-xs text-ink-500">
            {total} entries · page {page} of {pages}
          </span>
          <div className="flex gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="w-9 h-9 rounded-lg border border-ink-300 bg-white flex items-center justify-center disabled:opacity-35 hover:border-ink-400 active:scale-95 transition-all"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="w-9 h-9 rounded-lg border border-ink-300 bg-white flex items-center justify-center disabled:opacity-35 hover:border-ink-400 active:scale-95 transition-all"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-5 py-3 rounded-xl shadow-pop text-sm font-semibold animate-fade-up",
            toast.tone === "ok" ? "bg-ink-900 text-white" : "bg-brand-600 text-white"
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
