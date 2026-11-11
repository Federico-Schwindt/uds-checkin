/** Shared by the server (lib/integration) and the entry page: no server-only imports here. */

/** Key in entries.custom listing the other keys in the order they should be shown (jsonb does not keep it). */
export const CUSTOM_ORDER_KEY = "__order";

/** Key in entries.custom holding the online store's build, shown as the "Online build" card. */
export const BUILD_KEY = "__build";

/** Keys the integration keeps in entries.custom for itself; never listed as additional information. */
export const INTERNAL_CUSTOM_KEYS = [CUSTOM_ORDER_KEY, BUILD_KEY];

/** A custom driveshaft from the online builder, grouped for reading at the bench. */
export type OnlineBuild = {
  title: string;
  subtitle: string;
  highlights: { label: string; value: string }[];
  sections: { title: string; rows: [string, string][] }[];
  links: { build: string; drawing: string };
  note: string;
};

/** The build stored on an entry, or null (a check-in made at the shop, or an older web order). */
export function readOnlineBuild(custom: unknown): OnlineBuild | null {
  const b = custom && typeof custom === "object" ? (custom as Record<string, unknown>)[BUILD_KEY] : null;
  if (!b || typeof b !== "object" || !Array.isArray((b as OnlineBuild).sections)) return null;
  const v = b as Partial<OnlineBuild>;
  return {
    title: String(v.title || ""), subtitle: String(v.subtitle || ""),
    highlights: Array.isArray(v.highlights) ? v.highlights : [],
    sections: v.sections || [],
    links: { build: String(v.links?.build || ""), drawing: String(v.links?.drawing || "") },
    note: String(v.note || ""),
  };
}
