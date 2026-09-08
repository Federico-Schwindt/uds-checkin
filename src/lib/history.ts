/**
 * Turns audit rows into something a person can read at a glance: who did it,
 * what changed, and from what to what — no field keys, no jargon.
 */

/** Human names for the fields the audit log records by key. */
export const FIELD_LABELS: Record<string, string> = {
  jobNumber: "Job",
  jobStatus: "Status",
  payment: "Payment",
  total: "Total",
  deposit: "Deposit",
  etaJob: "ETA",
  assignedEmployee: "Assigned to",
  employeeName: "Employee",
  onHoldReason: "On-hold reason",
  core: "Core",
  notes: "Notes",
  confirmationDate: "Confirmation date",
  timeOfJob: "Time of job",
  signingDate: "Signing date",
  vehicleYear: "Vehicle year",
  vehicleMake: "Vehicle make",
  vehicleModel: "Vehicle model",
  drive: "Drive",
  axleLocation: "Axle location",
  cab: "Cab",
  transmission: "Transmission",
  transmissionSpeed: "Transmission speed",
  engineSize: "Engine size",
  bedSize: "Bed size",
  bedSizeOther: "Bed size (other)",
  wheelbase: "Wheelbase",
  horsePower: "Horsepower",
  stockVehicle: "Stock vehicle",
  stockVehicleExplain: "Not stock — explanation",
  vin: "VIN",
  vinMethod: "VIN method",
  mileage: "Mileage",
  saveOldParts: "Save old parts",
  complaint: "Complaint",
  complaintOther: "Complaint (other)",
  laborRequest: "Labor request",
  laborOther: "Labor (other)",
  driveshaftPieces: "Driveshaft type",
  driveshaftMaterial: "Material",
  uJointSerial: "U-joint serial",
  driveshaftTypeChoice: "Driveshaft choice",
  measurementA: "Measurement A",
  measurementB: "Measurement B",
  measurementC: "Measurement C",
  designerType: "Designer type",
  howHeard: "How they heard about us",
  estimateChoice: "Estimate option",
  estimateAmount: "Estimate amount",
  estimateDate: "Estimate date",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  email: "Email",
  street: "Street",
  city: "City",
  state: "State",
  zip: "ZIP",
  smsConsent: "SMS consent",
  custom: "Custom fields",
};

export function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Fall back to splitting camelCase so an unmapped key still reads as words.
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export type HistoryChange = { label: string; from: string; to: string };

export type HistoryItem = {
  id: string;
  at: string;
  /** Who did it. Empty when the record predates per-person sign-in. */
  who: string;
  kind: "created" | "status" | "edit" | "quality" | "message" | "danger" | "other";
  title: string;
  detail?: string;
  changes?: HistoryChange[];
  entryId?: number | null;
};

const show = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return v ? "yes" : "no";
  const s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

/** `{ field: { from, to } }` as recorded by diffFields. */
function readChanges(details: unknown): HistoryChange[] {
  if (!details || typeof details !== "object") return [];
  const out: HistoryChange[] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || !("from" in value) || !("to" in value)) continue;
    const v = value as { from: unknown; to: unknown };
    out.push({ label: fieldLabel(key), from: show(v.from), to: show(v.to) });
  }
  return out;
}

export type ActivityRow = {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  summary: string;
  details: unknown;
  actor: string;
  createdAt: string | Date;
};

/** One audit row, rewritten for a human. */
export function describeActivity(row: ActivityRow): HistoryItem {
  const who = (row.actor || "").replace(/\s*\((admin|tech)\)$/, "");
  const at = typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString();
  const base = { id: `a${row.id}`, at, who, entryId: row.entityId };
  const d = (row.details || {}) as Record<string, unknown>;

  switch (row.action) {
    case "entry.create":
      return { ...base, kind: "created", title: "Took this check-in", detail: String(d.vehicle || "") };
    case "entry.duplicate":
      return { ...base, kind: "created", title: "Duplicated this job" };
    case "status.change":
      return {
        ...base,
        kind: "status",
        title: `Changed the status: ${show(d.from)} → ${show(d.to)}`,
        detail: d.notified === false ? "Customer not notified" : "Customer notified",
      };
    case "entry.update": {
      const changes = readChanges(row.details);
      return {
        ...base,
        kind: "edit",
        title: changes.length === 1 ? `Edited ${changes[0].label}` : `Edited ${changes.length} fields`,
        changes,
      };
    }
    case "entry.delete":
      return { ...base, kind: "danger", title: "Deleted this job" };
    case "entry.restore":
      return { ...base, kind: "created", title: "Restored this job" };
    case "performance.mistake":
      return {
        ...base,
        kind: "quality",
        title: d.technician ? `Flagged a mistake against ${d.technician}` : "Flagged a mistake on this job",
        detail: [d.category, d.note].filter(Boolean).join(" — ") || undefined,
      };
    case "performance.praise":
      return {
        ...base,
        kind: "quality",
        title: d.technician ? `Recognized ${d.technician}'s work` : "Recognized the work on this job",
        detail: [d.category, d.note].filter(Boolean).join(" — ") || undefined,
      };
    case "entry.create.error":
      return { ...base, kind: "danger", title: "A check-in failed to save", detail: row.summary };
    case "attendance.arrival":
      // The summary already reads "clocked in — 12 min late".
      return { ...base, kind: "created", title: stripName(row.summary, who) || "Clocked in" };
    case "auth.logout":
      return { ...base, kind: "other", title: "Signed out" };
    case "auth.failed":
      return { ...base, kind: "danger", title: "Failed sign-in attempt", detail: row.summary };
    case "auth.outside_hours":
      return { ...base, kind: "danger", title: "Tried to sign in outside working hours", detail: String(d.reason || "") };
    case "request.create":
      return { ...base, kind: "message", title: "Submitted a staff request", detail: stripName(row.summary, who) };
    case "request.status":
      return { ...base, kind: "message", title: row.summary };
    case "assignment.create":
      return { ...base, kind: "status", title: "Added something to the calendar", detail: stripName(row.summary, who) };
    case "assignment.update":
      return { ...base, kind: "edit", title: "Changed a calendar item" };
    case "assignment.delete":
      return { ...base, kind: "danger", title: "Removed a calendar item" };
    case "announcement.create":
      return { ...base, kind: "message", title: "Posted a notice to the team", detail: stripName(row.summary, who) };
    case "announcement.delete":
      return { ...base, kind: "danger", title: "Removed a team notice" };
    case "user.create":
      return { ...base, kind: "created", title: stripName(row.summary, who) };
    case "user.password_reset":
      return { ...base, kind: "edit", title: stripName(row.summary, who) };
    case "user.update":
    case "user.deactivate":
      return { ...base, kind: "edit", title: stripName(row.summary, who) };
    case "settings.update":
      return { ...base, kind: "edit", title: stripName(row.summary, who) };
    default:
      return { ...base, kind: "other", title: stripName(row.summary, who) || row.action };
  }
}

/** The summary often repeats the actor's name; the renderer already shows it. */
function stripName(summary: string, who: string): string {
  const text = (summary || "").trim();
  if (!who) return text;
  return text.toLowerCase().startsWith(who.toLowerCase())
    ? text.slice(who.length).replace(/^[\s—·-]+/, "")
    : text;
}

export function sortByNewest(items: HistoryItem[]): HistoryItem[] {
  return [...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
