"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ExternalLink, Pencil, X } from "lucide-react";
import { Badge, Button, Spinner, StatusBadge } from "@/components/ui";
import { cn, formatDateTime, formatPhone, jobLabel } from "@/lib/utils";
import formOptions from "@/lib/form-options.json";

/* ================= The floating panel ================= */

type Spot =
  | { mode: "sheet" }
  | { mode: "modal" }
  | { mode: "anchored"; left: number; top?: number; bottom?: number; width: number; maxHeight: number };

const PHONE_MAX = 640;
const EDGE = 12;

/**
 * Works out where a panel can actually be seen.
 *
 * The old editors positioned themselves with `absolute` inside the table, and a
 * table that scrolls sideways clips its own children — which is why a status
 * dropdown was invisible on a desktop screen and ran off the edge on a phone.
 * A panel placed here is measured against the viewport instead, so it always
 * lands somewhere visible.
 */
function findSpot(anchor: HTMLElement | null | undefined, width: number, variant: "popover" | "modal"): Spot {
  if (typeof window === "undefined") return { mode: "modal" };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < PHONE_MAX) return { mode: "sheet" };
  if (variant === "modal") return { mode: "modal" };
  const r = anchor?.getBoundingClientRect();
  if (!r) return { mode: "modal" };

  const w = Math.min(width, vw - EDGE * 2);
  const left = Math.min(Math.max(EDGE, r.left), vw - EDGE - w);
  const below = vh - r.bottom - EDGE;
  const above = r.top - EDGE;
  // Drop down when there is room, otherwise flip up — anchoring by `bottom`
  // when flipped means we never have to know the panel's height first.
  return below >= 240 || below >= above
    ? { mode: "anchored", left, top: r.bottom + 6, width: w, maxHeight: Math.max(180, below) }
    : { mode: "anchored", left, bottom: vh - r.top + 6, width: w, maxHeight: Math.max(180, above) };
}

export function FloatingPanel({
  anchor,
  onClose,
  title,
  children,
  footer,
  width = 268,
  variant = "popover",
}: {
  anchor?: HTMLElement | null;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  variant?: "popover" | "modal";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot>(() => findSpot(anchor, width, variant));
  const overlay = spot.mode !== "anchored";

  // Stay glued to the trigger while the page moves under it.
  useEffect(() => {
    const reposition = () => setSpot(findSpot(anchor, width, variant));
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchor, width, variant]);

  // Escape, or a click anywhere that is not the panel or its own trigger.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  // A sheet or dialog owns the screen; the page behind it should not scroll.
  useEffect(() => {
    if (!overlay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlay]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
      {overlay && (
        <div className="fixed inset-0 z-[70] bg-ink-950/50 backdrop-blur-[2px] animate-fade-up" onClick={onClose} />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={overlay || undefined}
        aria-label={title}
        className={cn(
          "fixed z-[71] bg-white shadow-pop flex flex-col overscroll-contain",
          spot.mode === "sheet" && "inset-x-0 bottom-0 rounded-t-2xl max-h-[88vh] animate-sheet-up",
          spot.mode === "modal" &&
            "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(36rem,calc(100vw-2rem))] max-h-[86vh] rounded-2xl animate-fade-up",
          spot.mode === "anchored" && "rounded-xl border border-ink-200 animate-fade-up"
        )}
        style={
          spot.mode === "anchored"
            ? { left: spot.left, top: spot.top, bottom: spot.bottom, width: spot.width, maxHeight: spot.maxHeight }
            : undefined
        }
      >
        {title && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 border-b border-ink-100">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-500">{title}</span>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={cn("overflow-y-auto overscroll-contain", overlay ? "p-4" : "p-1.5")}>{children}</div>
        {footer && <div className="shrink-0 border-t border-ink-100 p-2.5 bg-ink-50/60 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* ================= Shared bits ================= */

/** The row shape the workstation lists and every quick editor writes to. */
export type EntryRow = {
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
  createdByName: string;
  customerId: number | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
};

/** PATCH body for /api/entries/[id] — what every editor here hands back. */
export type EntryPatch = {
  entry?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  skipNotify?: boolean;
};

const cellBase =
  "w-full min-h-8 px-2 py-1 rounded-lg text-sm text-left transition-all hover:bg-brand-50 hover:ring-1 hover:ring-brand-200";

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const fieldBase =
  "w-full h-11 px-3 rounded-xl border border-ink-300 bg-white text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

function PanelInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, props.className)} />;
}

function PanelSelect({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select {...props} className={cn(fieldBase, "appearance-none pr-9", props.className)}>
        {children}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
    </span>
  );
}

/* ================= One-field editors ================= */

/** Single value, edited in place. Nothing floats, so nothing can clip it. */
export function InlineText({
  value,
  display,
  onSave,
  placeholder,
  align = "left",
  inputMode,
  className,
}: {
  value: string;
  display?: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  align?: "left" | "right";
  inputMode?: "tel" | "decimal" | "numeric" | "text";
  className?: string;
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
      className={cn(cellBase, "cursor-text", align === "right" && "text-right", value && className, !value && "text-ink-300")}
      title="Click to edit"
    >
      {busy ? <Spinner className="w-3.5 h-3.5" /> : display || value || placeholder || "—"}
    </button>
  );
}

/** Pick one value from a short list. */
export function InlineChoice({
  value,
  options,
  title,
  onSave,
  render,
}: {
  value: string;
  options: string[];
  title: string;
  onSave: (v: string) => Promise<void>;
  render?: (v: string) => React.ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (v: string) => {
    setAnchor(null);
    if (v === value) return;
    setBusy(true);
    try {
      await onSave(v);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className="min-h-8 px-1.5 py-1 rounded-lg hover:bg-brand-50 hover:ring-1 hover:ring-brand-200 transition-all"
        title={`Click to change ${title.toLowerCase()}`}
      >
        {busy ? <Spinner className="w-3.5 h-3.5" /> : render ? render(value) : value || "—"}
      </button>
      {anchor && (
        <FloatingPanel anchor={anchor} onClose={() => setAnchor(null)} title={title}>
          <div className="grid gap-1">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => pick(o)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-left hover:bg-ink-50",
                  o === value && "bg-ink-50 text-brand-700"
                )}
              >
                <span className="w-4 shrink-0">{o === value && <Check className="w-4 h-4" />}</span>
                {o}
              </button>
            ))}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

/**
 * A few related values at once — a customer's name, a vehicle.
 *
 * `as="pencil"` is for cells whose own click already does something else (the
 * job number opens the job), so the edit affordance sits beside it instead.
 */
export function InlineFields({
  title,
  fields,
  display,
  placeholder,
  onSave,
  className,
  as = "cell",
}: {
  title: string;
  fields: { key: string; label: string; value: string; inputMode?: "tel" | "decimal" | "numeric" | "text" }[];
  display?: string;
  placeholder?: string;
  onSave: (values: Record<string, string>) => Promise<void>;
  className?: string;
  as?: "cell" | "pencil";
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className={as === "pencil" ? "contents" : "relative"} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={
          as === "pencil"
            ? cn(
                "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-ink-300 hover:bg-ink-100 hover:text-brand-700",
                // Always there on a touch screen, where there is no hover to reveal it.
                !anchor && "lg:opacity-0 lg:group-hover/row:opacity-100 lg:focus-visible:opacity-100 transition-opacity"
              )
            : cn(cellBase, display ? className : "text-ink-300")
        }
        title={`Edit ${title.toLowerCase()}`}
        aria-label={`Edit ${title.toLowerCase()}`}
      >
        {busy ? (
          <Spinner className="w-3.5 h-3.5" />
        ) : as === "pencil" ? (
          <Pencil className="w-3.5 h-3.5" />
        ) : (
          display || placeholder || "—"
        )}
      </button>
      {anchor && (
        <FieldsPanel
          anchor={anchor}
          title={title}
          fields={fields}
          onClose={() => setAnchor(null)}
          onSave={async (values) => {
            setAnchor(null);
            setBusy(true);
            try {
              await onSave(values);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function FieldsPanel({
  anchor,
  title,
  fields,
  onClose,
  onSave,
}: {
  anchor: HTMLElement | null;
  title: string;
  fields: { key: string; label: string; value: string; inputMode?: "tel" | "decimal" | "numeric" | "text" }[];
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.value]))
  );
  const dirty = fields.filter((f) => (draft[f.key] ?? "") !== f.value);

  const save = () => {
    if (!dirty.length) return onClose();
    onSave(Object.fromEntries(dirty.map((f) => [f.key, draft[f.key] ?? ""])));
  };

  return (
    <FloatingPanel
      anchor={anchor}
      onClose={onClose}
      title={title}
      width={288}
      footer={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 h-10" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="flex-1 h-10" onClick={save} disabled={!dirty.length}>
            {dirty.length ? "Save" : "No changes"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-2.5 p-1.5">
        {fields.map((f, i) => (
          <EditRow key={f.key} label={f.label}>
            <PanelInput
              autoFocus={i === 0}
              value={draft[f.key] ?? ""}
              inputMode={f.inputMode}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
            />
          </EditRow>
        ))}
      </div>
    </FloatingPanel>
  );
}

/* ================= Status ================= */

const ALL_STATUSES = ["New", ...formOptions.jobStatuses.filter((s) => s !== "New")];

/** Choosing "On hold" / "Ongoing" asks for the follow-up field, then applies + notifies. */
export function InlineStatus({
  row,
  onApply,
}: {
  row: EntryRow;
  onApply: (patch: Record<string, string>, skipNotify: boolean) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [step, setStep] = useState<"status" | "reason" | "employee">("status");
  const [pending, setPending] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    setAnchor(null);
    setStep("status");
    setPending("");
    setNotify(true);
  }, []);

  const apply = async (patch: Record<string, string>) => {
    setBusy(true);
    close();
    try {
      await onApply(patch, !notify);
    } finally {
      setBusy(false);
    }
  };

  const chooseStatus = (st: string) => {
    if (st === row.jobStatus) return close();
    if (st === "On hold") {
      setPending(st);
      return setStep("reason");
    }
    if (st === "Ongoing") {
      setPending(st);
      return setStep("employee");
    }
    apply({ jobStatus: st });
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => (anchor ? close() : setAnchor(e.currentTarget))}
        title="Click to change status"
        className="group"
      >
        {busy ? (
          <Spinner className="w-4 h-4 text-brand-600" />
        ) : (
          <StatusBadge status={row.jobStatus} className="group-hover:ring-2 group-hover:ring-brand-300 transition-all" />
        )}
      </button>
      {anchor && (
        <FloatingPanel
          anchor={anchor}
          onClose={close}
          width={240}
          title={step === "status" ? "Status" : step === "reason" ? "Why is it on hold?" : "Who is on it?"}
        >
          {step === "status" && (
            <div className="grid gap-0.5">
              {ALL_STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
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
            </div>
          )}
          {step === "reason" &&
            formOptions.onHoldReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => apply({ jobStatus: pending, onHoldReason: r })}
                className="w-full px-2.5 py-2.5 rounded-lg text-sm font-medium text-left hover:bg-ink-50"
              >
                {r}
              </button>
            ))}
          {step === "employee" && (
            <>
              {formOptions.assignedEmployees.map((emp) => (
                <button
                  key={emp}
                  type="button"
                  onClick={() => apply({ jobStatus: pending, assignedEmployee: emp })}
                  className="w-full px-2.5 py-2.5 rounded-lg text-sm font-medium text-left hover:bg-ink-50"
                >
                  {emp}
                </button>
              ))}
              <button
                type="button"
                onClick={() => apply({ jobStatus: pending })}
                className="w-full px-2.5 py-2.5 mt-1 border-t border-ink-100 rounded-lg text-sm text-ink-500 text-left hover:bg-ink-50"
              >
                Skip for now
              </button>
            </>
          )}
        </FloatingPanel>
      )}
    </div>
  );
}

/* ================= Whole-row editor ================= */

type Draft = {
  jobNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  jobStatus: string;
  onHoldReason: string;
  assignedEmployee: string;
  payment: string;
  total: string;
  deposit: string;
  etaJob: string;
};

const ENTRY_KEYS = [
  "jobNumber",
  "vehicleYear",
  "vehicleMake",
  "vehicleModel",
  "jobStatus",
  "onHoldReason",
  "assignedEmployee",
  "payment",
  "etaJob",
] as const;
const MONEY_KEYS = ["total", "deposit"] as const;
const CUSTOMER_KEYS = ["firstName", "lastName", "phone"] as const;

function draftFrom(row: EntryRow): Draft {
  return {
    jobNumber: row.jobNumber || "",
    firstName: row.firstName || "",
    lastName: row.lastName || "",
    phone: formatPhone(row.phone || "") || row.phone || "",
    vehicleYear: row.vehicleYear || "",
    vehicleMake: row.vehicleMake || "",
    vehicleModel: row.vehicleModel || "",
    jobStatus: row.jobStatus || "New",
    onHoldReason: row.onHoldReason || "",
    assignedEmployee: row.assignedEmployee || "",
    payment: row.payment || "",
    total: row.total ?? "",
    deposit: row.deposit ?? "",
    etaJob: row.etaJob || "",
  };
}

/**
 * Every field on one job, in one panel. The per-cell editors are quicker for a
 * single change; this is the one that guarantees nothing is out of reach —
 * including on a phone, where the table columns are not on screen at all.
 */
export function RowEditor({
  row,
  anchor,
  onClose,
  onSave,
  onOpenEntry,
}: {
  row: EntryRow;
  anchor?: HTMLElement | null;
  onClose: () => void;
  onSave: (patch: EntryPatch) => Promise<void>;
  onOpenEntry: () => void;
}) {
  const [base] = useState(() => draftFrom(row));
  const [d, setD] = useState<Draft>(base);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft, v: string) => setD((prev) => ({ ...prev, [k]: v }));

  const entryPatch: Record<string, unknown> = {};
  for (const k of ENTRY_KEYS) if (d[k] !== base[k]) entryPatch[k] = d[k];
  for (const k of MONEY_KEYS) if (d[k] !== base[k]) entryPatch[k] = d[k].replace(/[^0-9.]/g, "") || null;
  const customerPatch: Record<string, unknown> = {};
  for (const k of CUSTOMER_KEYS) if (d[k] !== base[k]) customerPatch[k] = d[k];

  const statusChanging = d.jobStatus !== base.jobStatus;
  const needsReason = d.jobStatus === "On hold" && !d.onHoldReason;
  const changes = Object.keys(entryPatch).length + Object.keys(customerPatch).length;
  const canSave = changes > 0 && !needsReason && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave({
        entry: entryPatch,
        ...(row.customerId && Object.keys(customerPatch).length ? { customer: customerPatch } : {}),
        ...(statusChanging ? { skipNotify: !notify } : {}),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingPanel
      anchor={anchor}
      onClose={onClose}
      variant="modal"
      title={`Quick edit — ${jobLabel(row.jobNumber, row.id)}`}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenEntry}
            className="text-sm font-semibold text-brand-700 hover:underline inline-flex items-center gap-1.5 px-1"
          >
            Full entry <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} className="h-11">
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave} className="h-11 min-w-32">
              {busy ? (
                <Spinner className="w-4 h-4" />
              ) : changes ? (
                `Save ${changes} change${changes > 1 ? "s" : ""}`
              ) : (
                "No changes"
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3.5">
        <div className="grid sm:grid-cols-2 gap-3">
          <EditRow label="Job name / number">
            <PanelInput value={d.jobNumber} onChange={(e) => set("jobNumber", e.target.value)} placeholder="Job name" />
          </EditRow>
          <EditRow label="ETA">
            <PanelInput value={d.etaJob} onChange={(e) => set("etaJob", e.target.value)} placeholder="e.g. Friday" />
          </EditRow>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <EditRow label="Status">
            <PanelSelect value={d.jobStatus} onChange={(e) => set("jobStatus", e.target.value)}>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </PanelSelect>
          </EditRow>
          <EditRow label="Payment">
            <PanelSelect value={d.payment} onChange={(e) => set("payment", e.target.value)}>
              <option value="">Not set</option>
              {formOptions.payments.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </PanelSelect>
          </EditRow>
        </div>

        {d.jobStatus === "On hold" && (
          <EditRow label="On hold — reason">
            <PanelSelect
              value={d.onHoldReason}
              onChange={(e) => set("onHoldReason", e.target.value)}
              className={cn(needsReason && "border-brand-500 ring-2 ring-brand-500/20")}
            >
              <option value="">Pick a reason…</option>
              {formOptions.onHoldReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </PanelSelect>
          </EditRow>
        )}

        <EditRow label="Assigned to">
          <PanelSelect value={d.assignedEmployee} onChange={(e) => set("assignedEmployee", e.target.value)}>
            <option value="">Nobody yet</option>
            {formOptions.assignedEmployees.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </PanelSelect>
        </EditRow>

        {statusChanging && (
          <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-ink-50 border border-ink-200 text-sm text-ink-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="w-4 h-4 accent-brand-600"
            />
            Notify the customer that this is now <b>{d.jobStatus}</b>
          </label>
        )}

        <div className="border-t border-ink-100 pt-3.5 grid gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <EditRow label="First name">
              <PanelInput
                value={d.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                disabled={!row.customerId}
              />
            </EditRow>
            <EditRow label="Last name">
              <PanelInput
                value={d.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                disabled={!row.customerId}
              />
            </EditRow>
          </div>
          <EditRow label="Phone">
            <PanelInput
              value={d.phone}
              inputMode="tel"
              onChange={(e) => set("phone", e.target.value)}
              disabled={!row.customerId}
            />
          </EditRow>
          {!row.customerId && <p className="-mt-1 text-xs text-ink-500">No customer on this entry yet.</p>}
        </div>

        <div className="border-t border-ink-100 pt-3.5 grid grid-cols-3 gap-3">
          <EditRow label="Year">
            <PanelInput value={d.vehicleYear} inputMode="numeric" onChange={(e) => set("vehicleYear", e.target.value)} />
          </EditRow>
          <EditRow label="Make">
            <PanelInput value={d.vehicleMake} onChange={(e) => set("vehicleMake", e.target.value)} />
          </EditRow>
          <EditRow label="Model">
            <PanelInput value={d.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} />
          </EditRow>
        </div>

        <div className="border-t border-ink-100 pt-3.5 grid grid-cols-2 gap-3">
          <EditRow label="Total">
            <PanelInput
              value={d.total}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(e) => set("total", e.target.value)}
            />
          </EditRow>
          <EditRow label="Deposit">
            <PanelInput
              value={d.deposit}
              inputMode="decimal"
              placeholder="0.00"
              onChange={(e) => set("deposit", e.target.value)}
            />
          </EditRow>
        </div>

        <p className="text-xs text-ink-500 border-t border-ink-100 pt-3">
          Checked in by <b className="text-ink-700">{row.createdByName || "—"}</b> on {formatDateTime(row.createdAt)} ·
          JOB{row.id}. Every edit you save here is recorded with your name.
        </p>
      </div>
    </FloatingPanel>
  );
}

/** The button that opens the whole-row editor. */
export function RowEditButton({
  row,
  onSave,
  onOpenEntry,
  variant = "icon",
}: {
  row: EntryRow;
  onSave: (patch: EntryPatch) => Promise<void>;
  onOpenEntry: () => void;
  variant?: "icon" | "button";
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => setAnchor(e.currentTarget)}
        title="Quick edit every field"
        aria-label="Quick edit every field"
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all active:scale-95",
          variant === "icon"
            ? "w-9 h-9 border border-ink-200 bg-white text-ink-500 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50"
            : "h-9 px-3 text-sm border border-ink-300 bg-white text-ink-700 hover:border-brand-400 hover:text-brand-700"
        )}
      >
        <Pencil className="w-4 h-4" />
        {variant === "button" && "Edit"}
      </button>
      {anchor && (
        <RowEditor
          row={row}
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onSave={onSave}
          onOpenEntry={onOpenEntry}
        />
      )}
    </span>
  );
}

/** Payment badge, shared by the table and the phone cards. */
export function paymentBadge(v: string, empty = "—") {
  return v ? (
    <Badge tone={v === "Paid" ? "success" : v === "Unpaid" ? "danger" : "warning"}>{v}</Badge>
  ) : (
    <span className="text-ink-300 text-sm px-1">{empty}</span>
  );
}
