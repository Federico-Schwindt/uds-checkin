import modelsData from "./vehicle-models.json";

/** make → year → models[], scraped from the PTI driveshaft catalog. */
export const VEHICLE_MODELS = modelsData as Record<string, Record<string, string[]>>;

/**
 * Makes UDS services. These drive the Make dropdown, use a year range starting
 * at 2010, and — when catalog model data exists — show the Model as a dropdown
 * filtered by make+year. Makes without catalog data (Kenwood, Freightliner)
 * keep a free-text Model field.
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

/** Years 2026 → 2010 (descending) shown once a service make is picked. */
export const YEARS_FROM_2010: string[] = Array.from({ length: 2026 - 2010 + 1 }, (_, i) => String(2026 - i));

export function isServiceMake(make: string): boolean {
  return SERVICE_MAKE_SET.has((make || "").trim().toLowerCase());
}

/** Does this make have a catalog-backed model list (→ Model shows as a dropdown)? */
export function makeHasModels(make: string): boolean {
  return !!VEHICLE_MODELS[(make || "").trim()];
}

/** Model options for a make+year, or [] when none. */
export function modelsFor(make: string, year: string): string[] {
  const byYear = VEHICLE_MODELS[(make || "").trim()];
  if (!byYear) return [];
  return byYear[(year || "").trim()] || [];
}
