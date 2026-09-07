/**
 * Labels shared by the technician panel and the admin inbox. Kept apart from
 * `requests.ts` so client components never pull the mail/database code with them.
 */

export const REQUEST_TYPES = [
  { value: "day_off", label: "Day off" },
  { value: "extra_hours", label: "Extra hours" },
  { value: "shift_change", label: "Shift change" },
  { value: "holiday", label: "Holiday / vacation" },
  { value: "equipment", label: "Tools or equipment" },
  { value: "pay", label: "Pay or hours question" },
  { value: "concern", label: "Concern" },
  { value: "other", label: "Something else" },
] as const;

export const REQUEST_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  REQUEST_TYPES.map((t) => [t.value, t.label])
);

export const REQUEST_STATUSES = ["open", "approved", "declined", "closed"] as const;

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  approved: "Approved",
  declined: "Declined",
  closed: "Closed",
};
