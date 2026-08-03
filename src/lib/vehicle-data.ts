import modelsData from "./vehicle-models.json";

/** make → year → models[], scraped from the PTI driveshaft catalog (≥ 1950). */
export const VEHICLE_MODELS = modelsData as Record<string, Record<string, string[]>>;

/**
 * Makes UDS services. These drive the Make dropdown. When catalog model data
 * exists the Model shows as a dropdown (all of the make's models, narrowing to
 * the year once one is chosen) and the Year list mirrors PowerTrain's own year
 * range for that make (≥ 1950). Makes without catalog data (Kenwood,
 * Freightliner) keep a free-text Model field and a generic year range.
 */
export const SERVICE_MAKES = [
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "GMC",
  "Honda",
  "Infiniti",
  "Jeep",
  "Kia",
  "Lexus",
  "Mazda",
  "Mercedes",
  "Nissan",
  "Pontiac",
  "Porsche",
  "Toyota",
  "Suzuki",
  "Volkswagen",
  "Volvo",
  "Kenwood",
  "Freightliner",
  "International",
];

const SERVICE_MAKE_SET = new Set(SERVICE_MAKES.map((m) => m.toLowerCase()));

/** Floor year for every make. Nothing older than this is offered. */
export const MIN_YEAR = 1950;

/** Generic descending year range for makes with no catalog data. */
const CURRENT_MAX_YEAR = 2026;
const DEFAULT_YEARS: string[] = Array.from(
  { length: CURRENT_MAX_YEAR - MIN_YEAR + 1 },
  (_, i) => String(CURRENT_MAX_YEAR - i),
);

export function isServiceMake(make: string): boolean {
  return SERVICE_MAKE_SET.has((make || "").trim().toLowerCase());
}

/** Does this make have a catalog-backed model list (→ Model shows as a dropdown)? */
export function makeHasModels(make: string): boolean {
  return !!VEHICLE_MODELS[(make || "").trim()];
}

/**
 * Years to offer for a make, descending. Catalog makes use PowerTrain's own
 * year set (already floored at {@link MIN_YEAR} when scraped); everything else
 * falls back to the generic range.
 */
export function yearsFor(make: string): string[] {
  const byYear = VEHICLE_MODELS[(make || "").trim()];
  if (!byYear) return DEFAULT_YEARS;
  return Object.keys(byYear)
    .map(Number)
    .filter((y) => y >= MIN_YEAR)
    .sort((a, b) => b - a)
    .map(String);
}

/** Model options for a make+year, or [] when none. */
export function modelsFor(make: string, year: string): string[] {
  const byYear = VEHICLE_MODELS[(make || "").trim()];
  if (!byYear) return [];
  return byYear[(year || "").trim()] || [];
}

/** Every model a make has across all years, de-duped and sorted. */
export function allModelsFor(make: string): string[] {
  const byYear = VEHICLE_MODELS[(make || "").trim()];
  if (!byYear) return [];
  const seen = new Set<string>();
  for (const year of Object.keys(byYear)) {
    for (const model of byYear[year]) seen.add(model);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
