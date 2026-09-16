import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Keep digits only; strip leading 1 for US numbers so search/dedupe is stable. */
export function normalizePhone(input: string): string {
  let d = (input || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}

export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  if (d.length !== 10) return input || "";
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** E.164 for Twilio; assumes US when 10 digits. */
export function toE164(input: string): string {
  const d = (input || "").replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (input.startsWith("+")) return input;
  return d ? `+${d}` : "";
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n)) return String(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The label a job goes by: whatever was typed into its job number/name field,
 * or — when nobody has set one — "JOB" plus the entry's own id. That id is a
 * database serial, so it is already sequential and never reused; no separate
 * numbering scheme to maintain.
 */
export function jobLabel(jobNumber: string | null | undefined, id: number): string {
  const trimmed = (jobNumber || "").trim();
  return trimmed || `JOB${id}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
