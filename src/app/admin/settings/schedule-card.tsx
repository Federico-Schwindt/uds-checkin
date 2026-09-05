"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Card, Field, Input, Select, Toggle } from "@/components/ui";
import { DAY_NAMES, DEFAULT_TIMEZONE, normalizeWorkHours, type DaySchedule } from "@/lib/work-hours";
import { cn } from "@/lib/utils";

/** The shop runs on Eastern time; the rest are here for a second location. */
const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern — Odessa, FL (America/New_York)" },
  { value: "America/Chicago", label: "Central (America/Chicago)" },
  { value: "America/Denver", label: "Mountain (America/Denver)" },
  { value: "America/Phoenix", label: "Arizona, no DST (America/Phoenix)" },
  { value: "America/Los_Angeles", label: "Pacific (America/Los_Angeles)" },
  { value: "America/Anchorage", label: "Alaska (America/Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Pacific/Honolulu)" },
];

/** Live clock in the selected zone, so the admin can confirm it is the shop's. */
function ShopClock({ timezone }: { timezone: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const tick = () => {
      try {
        setLabel(
          new Date().toLocaleString("en-US", {
            timeZone: timezone || DEFAULT_TIMEZONE,
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          })
        );
      } catch {
        setLabel("Unknown timezone");
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timezone]);

  if (!label) return null;
  return <p className="text-xs text-ink-500 mt-1.5">Shop time right now: <strong className="text-ink-700">{label}</strong></p>;
}

/**
 * Opening hours double as the technician sign-in window: outside them the
 * sign-in screen refuses non-admin accounts.
 */
export function ScheduleCard({
  hours,
  onChange,
  timezone,
  onTimezoneChange,
  early,
  onEarlyChange,
  late,
  onLateChange,
  grace,
  onGraceChange,
}: {
  hours: unknown;
  onChange: (value: DaySchedule[]) => void;
  timezone: string;
  onTimezoneChange: (v: string) => void;
  early: number;
  onEarlyChange: (v: number) => void;
  late: number;
  onLateChange: (v: number) => void;
  grace: number;
  onGraceChange: (v: number) => void;
}) {
  const list = normalizeWorkHours(hours);
  const patch = (day: number, values: Partial<DaySchedule>) =>
    onChange(list.map((d) => (d.day === day ? { ...d, ...values } : d)));

  // Monday first — how the shop reads its own schedule.
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center">
          <CalendarClock className="w-4.5 h-4.5" />
        </span>
        <div>
          <h2 className="font-bold leading-tight">Working hours</h2>
          <p className="text-[13px] text-ink-500">
            Technicians can only sign in during these hours — administrators always can
          </p>
        </div>
      </div>

      <div className="space-y-2 max-w-2xl">
        {order.map((day) => {
          const d = list[day];
          return (
            <div
              key={day}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-2.5",
                d.open ? "border-ink-200 bg-white" : "border-ink-200 bg-ink-50"
              )}
            >
              <span className="w-24 shrink-0 text-sm font-semibold text-ink-800">{DAY_NAMES[day]}</span>
              <Toggle checked={d.open} onChange={(v) => patch(day, { open: v })} />
              {d.open ? (
                <div className="flex items-center gap-2 ml-auto">
                  <Input
                    type="time"
                    value={d.start}
                    onChange={(e) => patch(day, { start: e.target.value })}
                    className="h-10 w-32"
                  />
                  <span className="text-ink-400">to</span>
                  <Input
                    type="time"
                    value={d.end}
                    onChange={(e) => patch(day, { end: e.target.value })}
                    className="h-10 w-32"
                  />
                </div>
              ) : (
                <span className="ml-auto text-sm font-medium text-ink-400 pr-2">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-4 border-t border-ink-100">
        <Field label="Shop timezone" hint="The hours above are read in this zone">
          <Select value={timezone || DEFAULT_TIMEZONE} onChange={(e) => onTimezoneChange(e.target.value)}>
            {!TIMEZONES.some((z) => z.value === timezone) && timezone && (
              <option value={timezone}>{timezone}</option>
            )}
            {TIMEZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </Select>
          <ShopClock timezone={timezone || DEFAULT_TIMEZONE} />
        </Field>
        <Field label="Early sign-in (minutes)" hint="How long before the shift they may badge in">
          <Input
            value={String(early)}
            onChange={(e) => onEarlyChange(parseInt(e.target.value) || 0)}
            inputMode="numeric"
          />
        </Field>
        <Field label="Late sign-in (minutes)" hint="Overtime window after closing">
          <Input
            value={String(late)}
            onChange={(e) => onLateChange(parseInt(e.target.value) || 0)}
            inputMode="numeric"
          />
        </Field>
        <Field label="Session grace (minutes)" hint="A technician's session ends this long after their shift">
          <Input
            value={String(grace)}
            onChange={(e) => onGraceChange(parseInt(e.target.value) || 0)}
            inputMode="numeric"
          />
        </Field>
      </div>
    </Card>
  );
}
