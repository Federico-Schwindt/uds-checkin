"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  CheckboxRow,
  ChoiceChips,
  EditableSelect,
  Field,
  Input,
  SectionTitle,
  Select,
  SelectOptions,
  Textarea,
} from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { SignatureField } from "@/components/signature-pad";
import { AddressAutocomplete, type AddressParts } from "@/components/address-autocomplete";
import { yearsFor, makeHasModels, modelsFor, allModelsFor } from "@/lib/vehicle-data";
import { cn, formatPhone } from "@/lib/utils";
import type { FormOptions } from "@/lib/form-options";
import {
  evaluateConditions,
  holdsValue,
  readValue,
  type FormField,
  type ValueBag,
} from "@/lib/form-schema";

export type WidgetMap = Record<string, React.ReactNode>;

/** Diagram shown under each "Choose your Driveshaft Type" option. */
const DRIVESHAFT_DIAGRAMS: Record<string, string> = {
  "1 Piece Driveshaft Type 1": "/diagrams/one-piece-type-1.webp",
  "1 Piece Driveshaft Type 2": "/diagrams/one-piece-type-2.webp",
  "2 Piece Driveshaft Type 1": "/diagrams/two-piece-type-1.webp",
  "2 Piece Driveshaft Type 2": "/diagrams/two-piece-type-2.webp",
};

type RendererProps = {
  fields: FormField[];
  values: ValueBag;
  setValue: (field: FormField, value: unknown) => void;
  errors: Record<string, string>;
  options: FormOptions;
  lookup: Map<string, FormField>;
  widgets?: WidgetMap;
  googleMapsKey?: string;
};

/** Tailwind can't read dynamic class names, so map widths to static classes. */
const SPAN: Record<number, string> = {
  1: "col-span-12 sm:col-span-1",
  2: "col-span-12 sm:col-span-2",
  3: "col-span-6 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  5: "col-span-12 sm:col-span-5",
  6: "col-span-12 sm:col-span-6",
  7: "col-span-12 sm:col-span-7",
  8: "col-span-12 sm:col-span-8",
  9: "col-span-12 sm:col-span-9",
  10: "col-span-12 sm:col-span-10",
  11: "col-span-12 sm:col-span-11",
  12: "col-span-12",
};

export function FormRenderer(props: RendererProps) {
  const { fields, values, lookup } = props;
  const visible = fields.filter((f) => evaluateConditions(f.conditions, values, lookup));
  if (visible.length === 0) return null;
  return (
    <div className="grid grid-cols-12 gap-4">
      {visible.map((f) => (
        <div key={f.id} className={cn(SPAN[f.width || 12] || SPAN[12], "min-w-0 animate-fade-up")}>
          <FieldRenderer field={f} {...props} />
        </div>
      ))}
    </div>
  );
}

function FieldRenderer({ field, ...ctx }: RendererProps & { field: FormField }) {
  const { values, setValue, errors, options, widgets, lookup, googleMapsKey } = ctx;
  const error = errors[field.key] || errors[field.id];
  const value = readValue(values, field);
  const str = value == null ? "" : String(value);
  const set = (v: unknown) => setValue(field, v);

  // Street address → Google Places autocomplete that also fills city/state/zip.
  if (field.key === "street" && (field.type === "text" || field.type === "textarea")) {
    const fill = (parts: AddressParts) => {
      const apply = (key: string, v?: string) => {
        if (!v) return;
        const f = lookup.get(key);
        if (f) setValue(f, v);
      };
      apply("city", parts.city);
      apply("state", parts.state);
      apply("zip", parts.zip);
    };
    return (
      <Field label={field.label} required={field.required} hint={field.help} error={error}>
        <AddressAutocomplete
          value={str}
          onChange={set}
          onFill={fill}
          apiKey={googleMapsKey}
          placeholder={field.placeholder || "Start typing an address…"}
        />
      </Field>
    );
  }
  const choices = field.options?.length ? field.options : options[field.optionsSource || ""] || [];

  // Vehicle Make → Year → Model dynamic chain.
  if (field.key === "vehicleMake" && field.type === "select") {
    const setMake = (v: string) => {
      set(v);
      // Clear the model on make change (models are make-specific); keep the year.
      const mf = lookup.get("vehicleModel");
      if (mf) setValue(mf, "");
      // "Mega Cab" is Dodge-only — drop it if the make is no longer Dodge.
      const cf = lookup.get("cab");
      if (cf && v.trim().toLowerCase() !== "dodge" && String(readValue(values, cf) ?? "") === "Mega Cab") {
        setValue(cf, "");
      }
    };
    return (
      <Field label={field.label} required={field.required} hint={field.help} error={error}>
        <Select value={str} onChange={(e) => setMake(e.target.value)} placeholder={field.placeholder || "Select make…"}>
          <SelectOptions options={choices} />
        </Select>
      </Field>
    );
  }

  if (field.key === "vehicleYear" && field.type === "select") {
    const make = String(readValue(values, lookup.get("vehicleMake") || { key: "vehicleMake", core: true }) ?? "");
    const yearOpts = yearsFor(make);
    const setYear = (v: string) => {
      set(v);
      // If a catalog model was picked that no longer fits the chosen year, clear it.
      // Custom-typed models (not in the catalog) are left untouched.
      const mf = lookup.get("vehicleModel");
      if (mf) {
        const model = String(readValue(values, mf) ?? "");
        if (
          v &&
          model &&
          makeHasModels(make) &&
          allModelsFor(make).includes(model) &&
          !modelsFor(make, v).includes(model)
        ) {
          setValue(mf, "");
        }
      }
    };
    return (
      <Field label={field.label} required={field.required} hint={field.help} error={error}>
        <EditableSelect
          value={str}
          onChange={setYear}
          options={yearOpts}
          placeholder="Select year…"
          inputPlaceholder="Year"
          customOptionLabel="✏️ Type a custom year…"
        />
      </Field>
    );
  }

  if (field.key === "vehicleModel") {
    const make = String(readValue(values, lookup.get("vehicleMake") || { key: "vehicleMake", core: true }) ?? "");
    const year = String(readValue(values, lookup.get("vehicleYear") || { key: "vehicleYear", core: true }) ?? "");
    // With a year chosen, narrow to that year; otherwise offer every model the make has.
    // No catalog data (or no make yet) → empty list, so EditableSelect shows a free-text input.
    const modelOpts = makeHasModels(make) ? (year ? modelsFor(make, year) : allModelsFor(make)) : [];
    return (
      <Field label={field.label} required={field.required} hint={field.help} error={error}>
        <EditableSelect
          value={str}
          onChange={set}
          options={modelOpts}
          placeholder={modelOpts.length ? "Select model…" : field.placeholder || "Model"}
          inputPlaceholder={field.placeholder || "Model"}
          customOptionLabel="✏️ Type a custom model…"
        />
      </Field>
    );
  }

  // Cab → "Mega Cab" is only offered when the make is Dodge.
  if (field.key === "cab" && field.type === "select") {
    const make = String(readValue(values, lookup.get("vehicleMake") || { key: "vehicleMake", core: true }) ?? "");
    const isDodge = make.trim().toLowerCase() === "dodge";
    const cabOpts = isDodge ? choices : choices.filter((o) => o !== "Mega Cab");
    return (
      <Field label={field.label} required={field.required} hint={field.help} error={error}>
        <Select value={str} onChange={(e) => set(e.target.value)} placeholder={field.placeholder || "Select…"}>
          <SelectOptions options={cabOpts} />
        </Select>
      </Field>
    );
  }

  // Type of Driveshaft → pre-select a matching "Choose your Driveshaft Type" default.
  if (field.key === "driveshaftPieces" && field.type === "radio") {
    const setPieces = (v: string) => {
      set(v);
      const tc = lookup.get("driveshaftTypeChoice");
      if (tc) {
        if (v === "1 Piece") setValue(tc, "1 Piece Driveshaft Type 1");
        else if (v === "2 Pieces") setValue(tc, "2 Piece Driveshaft Type 1");
        else setValue(tc, ""); // 3/4 pieces → field is hidden, so clear any stale choice
      }
    };
    return (
      <Field label={field.label} required={field.required} hint={field.help} error={error}>
        <ChoiceChips
          options={choices}
          value={str}
          onChange={setPieces}
          columns={choices.length > 4 ? 3 : Math.max(1, Math.min(choices.length, 4))}
        />
      </Field>
    );
  }

  // Choose your Driveshaft Type → show the matching diagram under the options.
  if (field.key === "driveshaftTypeChoice" && field.type === "radio") {
    const diagram = DRIVESHAFT_DIAGRAMS[str];
    return (
      <Field label={field.label} required={field.required} hint={field.help} error={error}>
        <ChoiceChips
          options={choices}
          value={str}
          onChange={set}
          columns={choices.length > 4 ? 3 : Math.max(1, Math.min(choices.length, 4))}
        />
        {diagram && (
          <div className="mt-3 flex justify-center rounded-xl border border-ink-200 bg-ink-50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={diagram} alt={`${str} diagram`} className="max-h-72 w-auto max-w-full object-contain" />
          </div>
        )}
      </Field>
    );
  }

  switch (field.type) {
    /* ---------- presentation ---------- */
    case "heading":
      return <SectionTitle>{field.label}</SectionTitle>;

    case "html":
      return (
        <div className="text-[13px] leading-relaxed text-ink-600 whitespace-pre-line rounded-xl bg-ink-50 border border-ink-200 p-4 max-h-72 overflow-y-auto">
          {field.content}
        </div>
      );

    case "divider":
      return <hr className="border-ink-200" />;

    case "spacer":
      return <div className="h-4" />;

    /* ---------- structure ---------- */
    case "row":
      return <FormRenderer {...ctx} fields={field.children || []} />;

    case "widget":
      return <>{widgets?.[field.widget || ""] ?? null}</>;

    case "repeater":
      return <RepeaterField field={field} value={value} onChange={set} error={error} />;

    /* ---------- values ---------- */
    case "textarea":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <Textarea value={str} onChange={(e) => set(e.target.value)} placeholder={field.placeholder} />
        </Field>
      );

    case "select":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <Select value={str} onChange={(e) => set(e.target.value)} placeholder={field.placeholder || "Select…"}>
            <SelectOptions options={choices} />
          </Select>
        </Field>
      );

    case "radio":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <ChoiceChips
            options={choices}
            value={str}
            onChange={set}
            columns={choices.length > 4 ? 3 : Math.max(1, Math.min(choices.length, 4))}
          />
        </Field>
      );

    case "yesno":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <ChoiceChips options={["Yes", "No"]} value={str} onChange={set} columns={2} />
        </Field>
      );

    case "checkbox":
      return (
        <Field label={field.content ? undefined : field.label} required={field.required} hint={field.help} error={error}>
          <CheckboxRow checked={value === true || str === "true"} onChange={set}>
            {field.content || field.label}
          </CheckboxRow>
        </Field>
      );

    case "multicheckbox": {
      const selected: string[] = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <div className="space-y-2">
            {choices.map((opt) => (
              <CheckboxRow
                key={opt}
                checked={selected.includes(opt)}
                onChange={(on) => set(on ? [...selected, opt] : selected.filter((s) => s !== opt))}
              >
                {opt}
              </CheckboxRow>
            ))}
          </div>
        </Field>
      );
    }

    case "signature":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <SignatureField value={str} onChange={set} />
        </Field>
      );

    case "photo":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <PhotoInput value={str} onChange={set} />
        </Field>
      );

    case "photos": {
      const list: string[] = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <div className="flex flex-wrap gap-3">
            {list.map((src, i) => (
              <PhotoInput key={i} value={src} onChange={(v) => set(v ? list.map((x, ix) => (ix === i ? v : x)) : list.filter((_, ix) => ix !== i))} />
            ))}
            <div className="w-full sm:w-64">
              <PhotoInput value="" onChange={(v) => v && set([...list, v])} label="Add photo" />
            </div>
          </div>
        </Field>
      );
    }

    case "file":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <FileField value={str} onChange={set} />
        </Field>
      );

    case "money":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500">$</span>
            <Input
              value={str}
              onChange={(e) => set(e.target.value)}
              inputMode="decimal"
              className="pl-8"
              placeholder={field.placeholder || "0.00"}
            />
          </div>
        </Field>
      );

    case "phone":
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <Input
            value={str}
            onChange={(e) => set(e.target.value)}
            onBlur={(e) => set(formatPhone(e.target.value) || e.target.value)}
            inputMode="tel"
            placeholder={field.placeholder}
          />
        </Field>
      );

    default: {
      // text, number, email, url, date, datetime, time
      const inputType =
        field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "time" ? "time" : "text";
      const inputMode =
        field.type === "number" ? "numeric" : field.type === "email" ? "email" : field.type === "url" ? "url" : undefined;
      return (
        <Field label={field.label} required={field.required} hint={field.help} error={error}>
          <Input
            type={inputType}
            inputMode={inputMode}
            value={str}
            onChange={(e) => set(e.target.value)}
            placeholder={field.placeholder}
          />
        </Field>
      );
    }
  }
}

/* ---------------- file upload ---------------- */

function FileField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      {value ? (
        <div className="flex items-center gap-2">
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-700 font-semibold text-sm underline truncate">
            View attachment
          </a>
          <Button type="button" variant="danger" size="sm" onClick={() => onChange("")}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <input
          type="file"
          className="block w-full text-sm text-ink-600 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-ink-100 file:text-ink-700 file:font-semibold hover:file:bg-ink-200"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => onChange(String(reader.result || ""));
            reader.readAsDataURL(f);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- repeater ---------------- */

type RepeaterRow = Record<string, string>;

function RepeaterField({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: RepeaterRow[]) => void;
  error?: string;
}) {
  const cols = field.columns?.length ? field.columns : [{ key: "value", label: "Value", type: "text" as const }];
  const rows: RepeaterRow[] = Array.isArray(value) ? (value as RepeaterRow[]) : [];

  const update = (i: number, key: string, v: string) =>
    onChange(rows.map((r, ix) => (ix === i ? { ...r, [key]: v } : r)));

  return (
    <Field label={field.label} required={field.required} hint={field.help} error={error}>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-ink-500">No rows added yet.</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex items-end gap-2">
            {cols.map((c) => (
              <div key={c.key} className="flex-1 min-w-0">
                {i === 0 && <p className="text-[11px] font-semibold text-ink-500 mb-1">{c.label}</p>}
                <Input
                  value={r[c.key] ?? ""}
                  onChange={(e) => update(i, c.key, e.target.value)}
                  inputMode={c.type === "number" || c.type === "money" ? "decimal" : undefined}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="danger"
              className="w-11 px-0 shrink-0"
              onClick={() => onChange(rows.filter((_, ix) => ix !== i))}
              aria-label="Remove row"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...rows, Object.fromEntries(cols.map((c) => [c.key, ""]))])}
        >
          <Plus className="w-4.5 h-4.5" /> Add row
        </Button>
      </div>
    </Field>
  );
}

/** Required-field validation driven by the schema. */
export function validateFields(
  fields: FormField[],
  values: ValueBag,
  lookup: Map<string, FormField>,
  errors: Record<string, string> = {}
): Record<string, string> {
  for (const f of fields) {
    if (!evaluateConditions(f.conditions, values, lookup)) continue;
    if (f.type === "row") {
      validateFields(f.children || [], values, lookup, errors);
      continue;
    }
    if (!holdsValue(f.type) || !f.required) continue;
    const v = readValue(values, f);
    const empty =
      v == null ||
      v === "" ||
      v === false ||
      (Array.isArray(v) && v.length === 0);
    if (empty) errors[f.key] = `${f.label || "This field"} is required`;
  }
  return errors;
}
