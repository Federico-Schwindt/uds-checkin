"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ExternalLink, MapPin, Search, X } from "lucide-react";
import { Badge, Card, Input, Select, Spinner, StatusBadge } from "@/components/ui";
import { cn, formatDateTime, formatMoney, formatPhone } from "@/lib/utils";
import formOptions from "@/lib/form-options.json";

const LOCATION_KEY = "uds-location-id";

export type LocationOption = { id: number; name: string };

type Row = {
  id: number;
  jobNumber: string;
  jobStatus: string;
  payment: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  laborRequest: string;
  total: string | null;
  deposit: string | null;
  createdAt: string;
  etaJob: string;
  locationId: number | null;
  onHoldReason: string;
  assignedEmployee: string;
  customerId: number | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

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

/* ================= Inline editable cells ================= */

function InlineText({
  value,
  display,
  onSave,
  placeholder,
  align = "left",
  inputMode,
}: {
  value: string;
  display?: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  align?: "left" | "right";
  inputMode?: "tel" | "decimal" | "numeric" | "text";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  const commit = async () => {
    setEditing(false);
    if (draft === value) return;
    setBusy(true);
    try {
      await onSave(draft);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
        inputMode={inputMode}
        className={cn(
          "w-full h-8 px-2 rounded-lg border border-brand-400 ring-2 ring-brand-500/25 bg-white text-sm focus:outline-none",
          align === "right" && "text-right"
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "w-full min-h-8 px-2 py-1 rounded-lg text-sm text-left hover:bg-brand-50 hover:ring-1 hover:ring-brand-200 transition-all cursor-text",
        align === "right" && "text-right",
        !value && "text-ink-300"
      )}
      title="Click to edit"
    >
      {busy ? <Spinner className="w-3.5 h-3.5" /> : display || value || placeholder || "—"}
    </button>
  );
}

function InlineChoice({
  value,
  options,
  onSave,
  render,
}: {
  value: string;
  options: string[];
  onSave: (v: string) => Promise<void>;
  render?: (v: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = async (v: string) => {
    setOpen(false);
    if (v === value) return;
    setBusy(true);
    try {
      await onSave(v);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="min-h-8 px-1.5 py-1 rounded-lg hover:bg-brand-50 hover:ring-1 hover:ring-brand-200 transition-all"
        title="Click to change"
      >
        {busy ? <Spinner className="w-3.5 h-3.5" /> : render ? render(value) : value || "—"}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-white rounded-xl border border-ink-200 shadow-pop p-1.5 min-w-40 animate-fade-up">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => pick(o)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left hover:bg-ink-50",
                o === value && "text-brand-700"
              )}
            >
              <span className="w-4">{o === value && <Check className="w-4 h-4" />}</span>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Status editor: choosing "On hold" / "Ongoing" asks for the follow-up field, then applies + notifies. */
function InlineStatus({
  row,
  onApply,
}: {
  row: Row;
  onApply: (patch: Record<string, string>, skipNotify: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"status" | "reason" | "employee">("status");
  const [pending, setPending] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setStep("status");
    setPending("");
    setNotify(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  const apply = async (patch: Record<string, string>) => {
    setBusy(true);
    try {
      await onApply(patch, !notify);
    } finally {
      setBusy(false);
      close();
    }
  };

  const chooseStatus = (st: string) => {
    if (st === row.jobStatus) return close();
    if (st === "On hold") {
      setPending(st);
      setStep("reason");
      return;
    }
    if (st === "Ongoing") {
      setPending(st);
      setStep("employee");
      return;
    }
    apply({ jobStatus: st });
  };

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(!open)} title="Click to change status" className="group">
        {busy ? (
          <Spinner className="w-4 h-4 text-brand-600" />
        ) : (
          <StatusBadge status={row.jobStatus} className="group-hover:ring-2 group-hover:ring-brand-300 transition-all" />
        )}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-white rounded-xl border border-ink-200 shadow-pop p-2 w-56 animate-fade-up">
          {step === "status" && (
            <>
              {["New", ...formOptions.jobStatuses.filter((s) => s !== "New")].map((st) => (
                <button
                  key={st}
                  onClick={() => chooseStatus(st)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-ink-50",
                    st === row.jobStatus && "bg-ink-50"
                  )}
                >
                  <StatusBadge status={st} />
                  {st === row.jobStatus && <Check className="w-4 h-4 ml-auto text-ink-400" />}
                </button>
              ))}
              <label className="flex items-center gap-2 px-2.5 py-2 mt-1 border-t border-ink-100 text-xs text-ink-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notify}
                  onChange={(e) => setNotify(e.target.checked)}
                  className="w-3.5 h-3.5 accent-brand-600"
                />
                Notify customer (SMS/email)
              </label>
            </>
          )}
          {step === "reason" && (
            <>
              <p className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">On hold — reason</p>
              {formOptions.onHoldReasons.map((r) => (
                <button
                  key={r}
                  onClick={() => apply({ jobStatus: pending, onHoldReason: r })}
                  className="w-full px-2.5 py-2 rounded-lg text-sm font-medium text-left hover:bg-ink-50"
                >
                  {r}
                </button>
              ))}
            </>
          )}
          {step === "employee" && (
            <>
              <p className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500">Assign employee</p>
              {formOptions.assignedEmployees.map((emp) => (
                <button
                  key={emp}
                  onClick={() => apply({ jobStatus: pending, assignedEmployee: emp })}
                  className="w-full px-2.5 py-2 rounded-lg text-sm font-medium text-left hover:bg-ink-50"
                >
                  {emp}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Workstation table ================= */

export function EntriesWorkstation({ locations }: { locations: LocationOption[] }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
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
    async (row: Row, body: Record<string, unknown>, okText?: string) => {
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
                      etaJob: j.entry.etaJob,
                      onHoldReason: j.entry.onHoldReason,
                      assignedEmployee: j.entry.assignedEmployee,
                    }
                  : {}),
                ...(j.customer ? { phone: j.customer.phone, firstName: j.customer.firstName, lastName: j.customer.lastName } : {}),
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

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const needsGate = locationReady && locations.length > 1 && locationId == null;

  return (
    <div className="space-y-4">
      {needsGate && <LocationGate locations={locations} onPick={pickLocation} />}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-56">
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
        <div className="flex gap-1.5 overflow-x-auto">
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
        <LocationPicker locations={locations} value={locationId} onChange={pickLocation} />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500 border-b border-ink-200 bg-ink-50">
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Phone</th>
                <th className="px-3 py-3 font-semibold max-lg:hidden">Vehicle</th>
                <th className="px-3 py-3 font-semibold">Job #</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold max-sm:hidden">Payment</th>
                <th className="px-3 py-3 font-semibold text-right max-lg:hidden">Total</th>
                <th className="px-3 py-3 font-semibold max-xl:hidden">ETA</th>
                <th className="px-3 py-3 font-semibold text-right max-sm:hidden">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Spinner className="text-brand-600" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-ink-400">
                    No entries yet. Start a new check-in above.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50/60 transition-colors">
                    {/* Customer — navigates to the entry page */}
                    <td className="px-4 py-2">
                      <button
                        onClick={() => router.push(`/entry/${r.id}`)}
                        className="group text-left"
                        title="Open entry"
                      >
                        <span className="font-semibold text-ink-900 group-hover:text-brand-700 inline-flex items-center gap-1.5">
                          {r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() : `Entry #${r.id}`}
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="block text-xs text-ink-400">#{r.id}</span>
                      </button>
                    </td>
                    {/* Phone — inline edit (updates the customer) */}
                    <td className="px-1.5 py-2 w-36">
                      <InlineText
                        value={formatPhone(r.phone || "")}
                        onSave={(v) => patchRow(r, { customer: { phone: v } }, "Phone updated.")}
                        inputMode="tel"
                        placeholder="No phone"
                      />
                    </td>
                    {/* Vehicle — inline edit of the model (year/make via entry page) */}
                    <td className="px-1.5 py-2 max-lg:hidden w-48">
                      <InlineText
                        value={r.vehicleModel}
                        display={[r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(" ")}
                        onSave={(v) => patchRow(r, { entry: { vehicleModel: v } }, "Vehicle updated.").then(load)}
                        placeholder="No vehicle"
                      />
                    </td>
                    {/* Job number */}
                    <td className="px-1.5 py-2 w-32">
                      <InlineText
                        value={r.jobNumber}
                        onSave={(v) => patchRow(r, { entry: { jobNumber: v } }, "Job # updated.")}
                        placeholder="—"
                      />
                    </td>
                    {/* Status */}
                    <td className="px-1.5 py-2">
                      <InlineStatus
                        row={r}
                        onApply={(patch, skipNotify) => patchRow(r, { entry: patch, skipNotify })}
                      />
                    </td>
                    {/* Payment */}
                    <td className="px-1.5 py-2 max-sm:hidden">
                      <InlineChoice
                        value={r.payment}
                        options={formOptions.payments}
                        onSave={(v) => patchRow(r, { entry: { payment: v } }, "Payment updated.")}
                        render={(v) =>
                          v ? (
                            <Badge tone={v === "Paid" ? "success" : v === "Unpaid" ? "danger" : "warning"}>{v}</Badge>
                          ) : (
                            <span className="text-ink-300 text-sm px-1">—</span>
                          )
                        }
                      />
                    </td>
                    {/* Total */}
                    <td className="px-1.5 py-2 text-right max-lg:hidden w-28">
                      <InlineText
                        value={r.total ?? ""}
                        display={r.total ? formatMoney(r.total) : ""}
                        onSave={(v) => patchRow(r, { entry: { total: v.replace(/[^0-9.]/g, "") || null } }, "Total updated.")}
                        align="right"
                        inputMode="decimal"
                        placeholder="—"
                      />
                    </td>
                    {/* ETA */}
                    <td className="px-1.5 py-2 max-xl:hidden w-36">
                      <InlineText
                        value={r.etaJob}
                        onSave={(v) => patchRow(r, { entry: { etaJob: v } }, "ETA updated.")}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-ink-500 whitespace-nowrap text-xs max-sm:hidden">
                      {formatDateTime(r.createdAt)}
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
            "fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-pop text-sm font-semibold animate-fade-up",
            toast.tone === "ok" ? "bg-ink-900 text-white" : "bg-brand-600 text-white"
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
