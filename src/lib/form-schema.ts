/**
 * Schema-driven form definition.
 *
 * Hybrid model: fields flagged `core: true` map to real columns on `entries`
 * (or `customers`) so search, SMS variables, reports and the CSV export keep
 * working. Any other field is a custom field whose value lives in
 * `entries.custom` JSONB, keyed by the field's `key`.
 */

export type FieldType =
  // text-ish
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "phone"
  | "email"
  | "url"
  // date/time
  | "date"
  | "datetime"
  | "time"
  // choices
  | "select"
  | "radio"
  | "checkbox"
  | "multicheckbox"
  | "yesno"
  // media
  | "photo"
  | "photos"
  | "file"
  | "signature"
  // presentation
  | "heading"
  | "html"
  | "divider"
  | "spacer"
  // structural
  | "row"
  | "repeater"
  // built-in composite widgets that can't be expressed generically
  | "widget";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  number: "Number",
  money: "Money",
  phone: "Phone",
  email: "Email",
  url: "Website / URL",
  date: "Date",
  datetime: "Date & time",
  time: "Time",
  select: "Dropdown",
  radio: "Radio buttons",
  checkbox: "Single checkbox",
  multicheckbox: "Multiple checkboxes",
  yesno: "Yes / No",
  photo: "Photo (camera or upload)",
  photos: "Multiple photos",
  file: "File attachment",
  signature: "Signature",
  heading: "Section heading",
  html: "HTML / rich text",
  divider: "Divider",
  spacer: "Spacer",
  row: "Columns (container)",
  repeater: "Repeatable table",
  widget: "Built-in widget",
};

/** Field types that hold a value (everything except presentation/structure). */
export const VALUE_TYPES: FieldType[] = [
  "text", "textarea", "number", "money", "phone", "email", "url",
  "date", "datetime", "time",
  "select", "radio", "checkbox", "multicheckbox", "yesno",
  "photo", "photos", "file", "signature", "repeater",
];

export function holdsValue(type: FieldType): boolean {
  return VALUE_TYPES.includes(type);
}

/* ---------------- conditional logic ---------------- */

export type ConditionOp = "is" | "isNot" | "contains" | "empty" | "notEmpty" | "gt" | "lt";

export const CONDITION_OP_LABELS: Record<ConditionOp, string> = {
  is: "is",
  isNot: "is not",
  contains: "contains",
  empty: "is empty",
  notEmpty: "is not empty",
  gt: "is greater than",
  lt: "is less than",
};

export type Condition = { field: string; op: ConditionOp; value: string };
export type ConditionGroup = { action: "show" | "hide"; logic: "all" | "any"; rules: Condition[] };

/* ---------------- fields ---------------- */

export type RepeaterColumn = { key: string; label: string; type: "text" | "number" | "money"; width?: number };

export type FormField = {
  id: string;
  type: FieldType;
  /** Storage key. Core fields use the entity field name; custom fields any slug. */
  key: string;
  /** True when the value maps to a real DB column instead of entries.custom. */
  core?: boolean;
  /** Which entity a core field belongs to. */
  entity?: "entry" | "customer";
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  /** Grid span out of 12 (12 = full width). */
  width?: number;
  /** Inline options, or use optionsSource to share an editable option group. */
  options?: string[];
  optionsSource?: string;
  content?: string;
  defaultValue?: string;
  conditions?: ConditionGroup | null;
  /** row containers hold children; repeaters define columns. */
  children?: FormField[];
  columns?: RepeaterColumn[];
  /** Identifier for built-in widgets (customer search, parts table, driveshaft designer…). */
  widget?: string;
  /** Core fields that the app depends on and can't be deleted. */
  locked?: boolean;
};

export type FormStep = {
  id: string;
  title: string;
  enabled: boolean;
  fields: FormField[];
};

export type FormSchema = {
  version: number;
  steps: FormStep[];
};

/* ---------------- helpers ---------------- */

export function newId(prefix = "f"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Depth-first walk over every field, including children of containers. */
export function walkFields(fields: FormField[], fn: (f: FormField, parent: FormField | null) => void, parent: FormField | null = null) {
  for (const f of fields) {
    fn(f, parent);
    if (f.children?.length) walkFields(f.children, fn, f);
  }
}

export function allFields(schema: FormSchema): FormField[] {
  const out: FormField[] = [];
  for (const s of schema.steps) walkFields(s.fields, (f) => out.push(f));
  return out;
}

export function findField(schema: FormSchema, id: string): FormField | null {
  let found: FormField | null = null;
  for (const s of schema.steps) walkFields(s.fields, (f) => { if (f.id === id) found = f; });
  return found;
}

/** Value lookup used by the condition evaluator: core fields by key, custom under `custom`. */
export type ValueBag = Record<string, unknown> & { custom?: Record<string, unknown> };

export function readValue(values: ValueBag, field: Pick<FormField, "key" | "core">): unknown {
  if (field.core) return values[field.key];
  return values.custom?.[field.key];
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function evaluateConditions(
  group: ConditionGroup | null | undefined,
  values: ValueBag,
  fieldsByKeyOrId: Map<string, FormField>
): boolean {
  if (!group || !group.rules?.length) return true;

  const results = group.rules.map((rule) => {
    const target = fieldsByKeyOrId.get(rule.field);
    const raw = target ? readValue(values, target) : undefined;
    const text = asText(raw).trim().toLowerCase();
    const want = (rule.value ?? "").trim().toLowerCase();
    switch (rule.op) {
      case "is": return text === want;
      case "isNot": return text !== want;
      case "contains": return text.includes(want);
      case "empty": return text === "";
      case "notEmpty": return text !== "";
      case "gt": return parseFloat(text) > parseFloat(want);
      case "lt": return parseFloat(text) < parseFloat(want);
      default: return true;
    }
  });

  const matched = group.logic === "any" ? results.some(Boolean) : results.every(Boolean);
  return group.action === "hide" ? !matched : matched;
}

/** Build a lookup keyed by both field id and storage key so conditions can reference either. */
export function fieldLookup(schema: FormSchema): Map<string, FormField> {
  const map = new Map<string, FormField>();
  for (const f of allFields(schema)) {
    map.set(f.id, f);
    if (f.key) map.set(f.key, f);
  }
  return map;
}
