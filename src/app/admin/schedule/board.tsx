"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Plus,
  Search,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { Badge, Button, Card, Field, Input, Select, Spinner, Textarea } from "@/components/ui";
import { addDays, DAY_SHORT, formatClock, formatDateKey, parseHhMm } from "@/lib/work-hours";
import { cn, jobLabel } from "@/lib/utils";

type Tech = { id: number; name: string; title: string };
type Assignment = {
  id: number;
  userId: number;
  workDate: string;
  startTime: string;
  endTime: string;
  type: string;
  title: string;
  customerName: string;
  details: string;
  entryId: number | null;
  status: string;
};
type Row = { assignment: Assignment; userName: string | null; jobNumber: string | null; jobStatus: string | null };
type WorkOrder = {
  id: number;
  jobNumber: string;
  jobStatus: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  firstName: string | null;
  lastName: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  appointment: "Appointment",
  work_order: "Work order",
  task: "Task",
  other: "Other",
};

const TYPE_STYLE: Record<string, string> = {
  appointment: "bg-brand-50 text-brand-700 border-brand-200",
  work_order: "bg-emerald-50 text-emerald-700 border-emerald-200",
  task: "bg-amber-50 text-amber-700 border-amber-200",
  other: "bg-ink-100 text-ink-700 border-ink-300",
};

/** Calendar month grid, starting on Monday like the shop's own week. */
function monthGrid(monthKey: string): string[] {
  const first = `${monthKey}-01`;
  const firstDow = new Date(`${first}T00:00:00Z`).getUTCDay();
  // Monday-first offset: Sunday (0) sits at the end of the week.
  const lead = (firstDow + 6) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function ScheduleBoard({
  technicians,
  today,
  initialMonth,
}: {
  technicians: Tech[];
  today: string;
  initialMonth: string;
}) {
  const [monthKey, setMonthKey] = useState(initialMonth);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [techFilter, setTechFilter] = useState("");
  const [composing, setComposing] = useState(false);

  const days = useMemo(() => monthGrid(monthKey), [monthKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: days[0], to: days[days.length - 1] });
      if (techFilter) params.set("userId", techFilter);
      const res = await fetch(`/api/admin/assignments?${params}`);
      const j = await res.json().catch(() => ({}));
      setRows(j.assignments || []);
    } finally {
      setLoading(false);
    }
  }, [days, techFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state updates happen after the fetch resolves
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of rows) (map[r.assignment.workDate] ||= []).push(r);
    return map;
  }, [rows]);

  const monthLabel = new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const remove = async (id: number) => {
    if (!confirm("Remove this from the calendar?")) return;
    await fetch("/api/admin/assignments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  const dayRows = byDay[selectedDay] || [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Put appointments, work orders and tasks on a technician&apos;s calendar
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={techFilter} onChange={(e) => setTechFilter(e.target.value)} className="h-10 w-48" placeholder="All technicians">
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button size="sm" className="h-10" onClick={() => setComposing(true)}>
            <Plus className="w-4 h-4" /> Add to calendar
          </Button>
        </div>
      </div>

      {composing && (
        <AssignmentForm
          technicians={technicians}
          defaultDate={selectedDay}
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            load();
          }}
        />
      )}

      {/* Month grid */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">{monthLabel}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
              className="w-9 h-9 rounded-lg border border-ink-300 bg-white text-ink-700 hover:bg-ink-50 flex items-center justify-center"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setMonthKey(today.slice(0, 7));
                setSelectedDay(today);
              }}
              className="h-9 px-3 rounded-lg border border-ink-300 bg-white text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              Today
            </button>
            <button
              onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
              className="w-9 h-9 rounded-lg border border-ink-300 bg-white text-ink-700 hover:bg-ink-50 flex items-center justify-center"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400 mb-1">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span key={d}>{DAY_SHORT[d]}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((key) => {
            const inMonth = key.startsWith(monthKey);
            const items = byDay[key] || [];
            const isToday = key === today;
            const isSelected = key === selectedDay;
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                className={cn(
                  "min-h-[76px] rounded-lg border p-1.5 text-left transition-all align-top",
                  isSelected
                    ? "border-brand-600 ring-2 ring-brand-500/25 bg-white"
                    : inMonth
                      ? "border-ink-200 bg-white hover:border-brand-400"
                      : "border-ink-100 bg-ink-50/60"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded-md text-[12px] font-bold",
                    isToday ? "bg-brand-600 text-white" : inMonth ? "text-ink-800" : "text-ink-300"
                  )}
                >
                  {parseInt(key.slice(8), 10)}
                </span>
                <span className="mt-1 block space-y-0.5">
                  {items.slice(0, 3).map((r) => (
                    <span
                      key={r.assignment.id}
                      className={cn(
                        "block truncate rounded px-1 py-0.5 text-[10px] font-semibold border",
                        TYPE_STYLE[r.assignment.type] || TYPE_STYLE.other,
                        r.assignment.status === "cancelled" && "line-through opacity-60"
                      )}
                      title={`${r.userName} — ${r.assignment.title}`}
                    >
                      {r.assignment.startTime ? `${r.assignment.startTime} ` : ""}
                      {r.userName?.split(" ")[0]}
                    </span>
                  ))}
                  {items.length > 3 && (
                    <span className="block text-[10px] font-semibold text-ink-400">+{items.length - 3} more</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {loading && (
          <p className="text-center text-[13px] text-ink-400 mt-3">
            <Spinner className="w-4 h-4 inline-block align-middle" /> Loading…
          </p>
        )}
      </Card>

      {/* Selected day */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-bold flex items-center gap-2">
            <CalendarDays className="w-4.5 h-4.5 text-ink-400" />
            {formatDateKey(selectedDay, { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setComposing(true)}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>

        <div className="divide-y divide-ink-100 -mx-5">
          {dayRows.map(({ assignment: a, userName, jobNumber }) => (
            <div key={a.id} className="px-5 py-3 flex items-start gap-3">
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
                <p className={cn("font-semibold text-ink-900", a.status === "cancelled" && "line-through text-ink-400")}>
                  {a.title}
                </p>
                <p className="text-[13px] text-ink-500">
                  {userName}
                  {a.startTime ? ` · ${formatClock(parseHhMm(a.startTime))}` : ""}
                  {a.customerName ? ` · ${a.customerName}` : ""}
                  {a.entryId ? (
                    <>
                      {" · "}
                      <Link href={`/admin/entries/${a.entryId}`} className="font-semibold text-brand-700 hover:underline">
                        {jobLabel(jobNumber, a.entryId)}
                      </Link>
                    </>
                  ) : null}
                </p>
                {a.details && <p className="text-[13px] text-ink-600 mt-1 break-words">{a.details}</p>}
              </div>
              <Badge tone="neutral">{TYPE_LABEL[a.type] || a.type}</Badge>
              <button
                onClick={() => remove(a.id)}
                className="text-ink-300 hover:text-rose-600 transition-colors shrink-0"
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {dayRows.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-ink-400">Nothing scheduled for this day.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- add form ---------------- */

function AssignmentForm({
  technicians,
  defaultDate,
  onClose,
  onSaved,
}: {
  technicians: Tech[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(technicians[0] ? String(technicians[0].id) : "");
  const [workDate, setWorkDate] = useState(defaultDate);
  const [type, setType] = useState("appointment");
  const [startTime, setStartTime] = useState("09:00");
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [details, setDetails] = useState("");
  const [entryId, setEntryId] = useState("");
  const [search, setSearch] = useState("");
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Only load the job list when it is actually needed.
  useEffect(() => {
    if (type !== "work_order") return;
    const t = setTimeout(() => {
      fetch(`/api/admin/work-orders${search ? `?q=${encodeURIComponent(search)}` : ""}`)
        .then((r) => (r.ok ? r.json() : { workOrders: [] }))
        .then((j) => setWorkOrders(j.workOrders || []))
        .catch(() => setWorkOrders([]));
    }, 250);
    return () => clearTimeout(t);
  }, [type, search]);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(userId), workDate, type, startTime, title, customerName, details, entryId: entryId ? Number(entryId) : null }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Could not save");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 border-brand-300 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold">Add to the calendar</h2>
        <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Date" required>
          <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} className="h-11" />
        </Field>
        <Field label="Technician" required>
          <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-11" placeholder="Select">
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type" required>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-11">
            <option value="appointment">Appointment</option>
            <option value="work_order">Work order</option>
            <option value="task">Task</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Time" hint="Leave empty for all day">
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-11" />
        </Field>
      </div>

      {type === "work_order" ? (
        <div className="mt-4">
          <Field label="Work order" required hint="Search by job number, customer or vehicle">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search work orders…"
                className="h-11 pl-10"
              />
            </div>
          </Field>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
            {workOrders.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setEntryId(String(w.id))}
                className={cn(
                  "w-full text-left px-4 py-2.5 transition-colors",
                  entryId === String(w.id) ? "bg-brand-50" : "hover:bg-ink-50"
                )}
              >
                <span className="block text-sm font-semibold text-ink-900">
                  {jobLabel(w.jobNumber, w.id)} · {`${w.firstName ?? ""} ${w.lastName ?? ""}`.trim() || "No customer"}
                </span>
                <span className="block text-[13px] text-ink-500">
                  {[w.vehicleYear, w.vehicleMake, w.vehicleModel].filter(Boolean).join(" ") || "No vehicle"} · {w.jobStatus}
                </span>
              </button>
            ))}
            {workOrders.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-ink-400">No work orders match.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Field label={type === "appointment" ? "Customer name" : "Title"} required={type === "appointment"}>
            <Input
              value={type === "appointment" ? customerName : title}
              onChange={(e) => (type === "appointment" ? setCustomerName(e.target.value) : setTitle(e.target.value))}
              placeholder={type === "appointment" ? "e.g. Marcus Webb" : "e.g. Inventory count"}
              className="h-11"
            />
          </Field>
          {type === "appointment" && (
            <Field label="Short label" hint="Shown on the calendar">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Driveshaft pickup" className="h-11" />
            </Field>
          )}
        </div>
      )}

      <Field label="Details" className="mt-4">
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Anything the technician should know — phone number, vehicle, what to prepare."
          className="min-h-20"
        />
      </Field>

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <Button onClick={save} disabled={busy || !userId || !workDate}>
          {busy ? <Spinner className="w-4 h-4" /> : <Clock className="w-4 h-4" />} Schedule it
        </Button>
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {error && <span className="text-sm font-medium text-brand-700">{error}</span>}
      </div>
    </Card>
  );
}
