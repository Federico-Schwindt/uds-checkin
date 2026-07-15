import defaults from "./form-options.json";

export type FormOptions = Record<string, string[]>;

export const DEFAULT_OPTIONS = defaults as FormOptions;

/**
 * Option groups the admin may edit from the Form Builder. Groups tied to
 * hard-coded conditional logic (job statuses, estimate options, driveshaft
 * type measurements, designer diagrams) are intentionally excluded.
 */
export const EDITABLE_OPTION_GROUPS: Array<{ key: string; label: string }> = [
  { key: "years", label: "Year" },
  { key: "makes", label: "Make" },
  { key: "drives", label: "Drive" },
  { key: "axleLocations", label: "Location (Front/Rear)" },
  { key: "cabs", label: "Cab" },
  { key: "transmissions", label: "Transmission" },
  { key: "transmissionSpeeds", label: "Transmission Speed" },
  { key: "bedSizes", label: "Bed Size" },
  { key: "complaints", label: "Customer complaint" },
  { key: "laborRequests", label: "Labor Request" },
  { key: "driveshaftPieces", label: "Type of Driveshaft" },
  { key: "driveshaftMaterials", label: "Driveshaft Material" },
  { key: "howHeard", label: "How did you hear about us" },
  { key: "onHoldReasons", label: "On Hold Reason" },
  { key: "payments", label: "Payment" },
];

/** Merge stored option overrides with defaults. A stored non-empty array fully replaces the default list. */
export function mergeOptions(stored: FormOptions | null | undefined): FormOptions {
  const merged: FormOptions = { ...DEFAULT_OPTIONS };
  if (stored) {
    for (const [key, list] of Object.entries(stored)) {
      if (Array.isArray(list) && list.length > 0) {
        merged[key] = list.filter((v) => typeof v === "string" && v.trim() !== "");
      }
    }
  }
  return merged;
}
