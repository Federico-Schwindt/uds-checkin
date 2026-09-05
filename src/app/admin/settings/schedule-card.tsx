"use client";

import { CalendarClock } from "lucide-react";
import { Card, Field, Input, Toggle } from "@/components/ui";
import { DAY_NAMES, normalizeWorkHours, type DaySchedule } from "@/lib/work-hours";
import { cn } from "@/lib/utils";

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
        <Field label="Timezone" hint="IANA name — the hours above are read in this zone">
          <Input value={timezone} onChange={(e) => onTimezoneChange(e.target.value)} placeholder="America/New_York" />
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
