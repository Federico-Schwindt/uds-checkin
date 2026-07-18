"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea, Toggle } from "@/components/ui";
import { EDITABLE_OPTION_GROUPS } from "@/lib/form-options";
import {
  CONDITION_OP_LABELS,
  FIELD_TYPE_LABELS,
  holdsValue,
  type Condition,
  type ConditionOp,
  type FormField,
} from "@/lib/form-schema";

const WIDTHS = [
  { value: 12, label: "Full width" },
  { value: 6, label: "Half (1/2)" },
  { value: 4, label: "Third (1/3)" },
  { value: 3, label: "Quarter (1/4)" },
  { value: 8, label: "Two thirds (2/3)" },
  { value: 9, label: "Three quarters (3/4)" },
];

const HAS_OPTIONS = ["select", "radio", "multicheckbox"];
const HAS_PLACEHOLDER = ["text", "textarea", "number", "money", "phone", "email", "url", "select"];

export function FieldEditor({
  field,
  allFields,
  onChange,
  onDelete,
}: {
  field: FormField;
  allFields: FormField[];
  onChange: (patch: Partial<FormField>) => void;
  onDelete: () => void;
}) {
  const isPresentational = ["heading", "html", "divider", "spacer"].includes(field.type);
  const conditionTargets = allFields.filter((f) => f.id !== field.id && holdsValue(f.type));

  const setCondition = (i: number, patch: Partial<Condition>) => {
    const rules = [...(field.conditions?.rules || [])];
    rules[i] = { ...rules[i], ...patch };
    onChange({ conditions: { action: field.conditions?.action || "show", logic: field.conditions?.logic || "all", rules } });
  };

  const addCondition = () => {
    const rules = [...(field.conditions?.rules || []), { field: conditionTargets[0]?.key || "", op: "is" as ConditionOp, value: "" }];
    onChange({ conditions: { action: field.conditions?.action || "show", logic: field.conditions?.logic || "all", rules } });
  };

  const removeCondition = (i: number) => {
    const rules = (field.conditions?.rules || []).filter((_, ix) => ix !== i);
    onChange({ conditions: rules.length ? { action: field.conditions!.action, logic: field.conditions!.logic, rules } : null });
  };

  return (
    <div className="border-t border-ink-200 bg-ink-50/60 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-500">
          {FIELD_TYPE_LABELS[field.type]} settings
        </span>
        {!field.locked && (
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4" /> Delete field
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {field.type !== "divider" && field.type !== "spacer" && field.type !== "html" && (
          <Field label={field.type === "heading" ? "Heading text" : "Label"}>
            <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} className="h-10" />
          </Field>
        )}

        {!isPresentational && field.type !== "row" && (
          <Field label="Storage key" hint={field.core ? "Core field — key is fixed" : "Used to store the value"}>
            <Input
              value={field.key}
              onChange={(e) => onChange({ key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
              disabled={field.core}
              className="h-10 font-mono text-sm"
            />
          </Field>
        )}

        {HAS_PLACEHOLDER.includes(field.type) && (
          <Field label="Placeholder">
            <Input value={field.placeholder || ""} onChange={(e) => onChange({ placeholder: e.target.value })} className="h-10" />
          </Field>
        )}

        {!isPresentational && field.type !== "row" && (
          <Field label="Help text" hint="Shown under the field">
            <Input value={field.help || ""} onChange={(e) => onChange({ help: e.target.value })} className="h-10" />
          </Field>
        )}

        <Field label="Width">
          <Select
            value={String(field.width || 12)}
            onChange={(e) => onChange({ width: parseInt(e.target.value) })}
            className="h-10"
          >
            {WIDTHS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </Select>
        </Field>

        {holdsValue(field.type) && (
          <div className="flex items-end pb-2">
            <Toggle
              checked={!!field.required}
              onChange={(v) => onChange({ required: v })}
              label="Required"
              disabled={field.locked}
            />
          </div>
        )}
      </div>

      {/* HTML / checkbox content */}
      {(field.type === "html" || field.type === "checkbox") && (
        <Field label={field.type === "html" ? "Content (plain text or HTML)" : "Checkbox text"}>
          <Textarea
            value={field.content || ""}
            onChange={(e) => onChange({ content: e.target.value })}
            className="min-h-32 font-mono text-[13px]"
          />
        </Field>
      )}

      {/* Options */}
      {HAS_OPTIONS.includes(field.type) && (
        <div className="space-y-3">
          <Field label="Options source" hint="Use a shared list (editable below) or custom options for this field only">
            <Select
              value={field.optionsSource || ""}
              onChange={(e) =>
                onChange({ optionsSource: e.target.value || undefined, options: e.target.value ? undefined : field.options || [] })
              }
              className="h-10"
              placeholder="Custom options for this field"
            >
              {EDITABLE_OPTION_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  Shared list: {g.label}
                </option>
              ))}
            </Select>
          </Field>
          {!field.optionsSource && (
            <Field label="Options (one per line)">
              <Textarea
                value={(field.options || []).join("\n")}
                onChange={(e) => onChange({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                className="min-h-28"
                placeholder={"Option A\nOption B"}
              />
            </Field>
          )}
        </div>
      )}

      {/* Repeater columns */}
      {field.type === "repeater" && (
        <Field label="Columns (name | type)" hint="One per line, e.g. 'Part number | text' — types: text, number, money">
          <Textarea
            value={(field.columns || []).map((c) => `${c.label} | ${c.type}`).join("\n")}
            onChange={(e) =>
              onChange({
                columns: e.target.value
                  .split("\n")
                  .map((line) => {
                    const [label, type] = line.split("|").map((s) => s.trim());
                    if (!label) return null;
                    return {
                      key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
                      label,
                      type: (["text", "number", "money"].includes(type) ? type : "text") as "text" | "number" | "money",
                    };
                  })
                  .filter(Boolean) as { key: string; label: string; type: "text" | "number" | "money" }[],
              })
            }
            className="min-h-24"
            placeholder={"Part number | text\nQty | number\nPrice | money"}
          />
        </Field>
      )}

      {/* Conditional logic */}
      <div className="rounded-xl border border-ink-200 bg-white p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Conditional logic</span>
          <Button size="sm" variant="outline" onClick={addCondition} disabled={conditionTargets.length === 0}>
            <Plus className="w-3.5 h-3.5" /> Add rule
          </Button>
        </div>
        {!field.conditions?.rules?.length ? (
          <p className="text-sm text-ink-400">Always visible.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Select
                value={field.conditions.action}
                onChange={(e) => onChange({ conditions: { ...field.conditions!, action: e.target.value as "show" | "hide" } })}
                className="h-9 w-28"
              >
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </Select>
              <span className="text-ink-500">this field if</span>
              <Select
                value={field.conditions.logic}
                onChange={(e) => onChange({ conditions: { ...field.conditions!, logic: e.target.value as "all" | "any" } })}
                className="h-9 w-24"
              >
                <option value="all">all</option>
                <option value="any">any</option>
              </Select>
              <span className="text-ink-500">match:</span>
            </div>
            {field.conditions.rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Select value={rule.field} onChange={(e) => setCondition(i, { field: e.target.value })} className="h-9 flex-1">
                  {conditionTargets.map((t) => (
                    <option key={t.id} value={t.key}>
                      {t.label || t.key}
                    </option>
                  ))}
                </Select>
                <Select
                  value={rule.op}
                  onChange={(e) => setCondition(i, { op: e.target.value as ConditionOp })}
                  className="h-9 w-36"
                >
                  {Object.entries(CONDITION_OP_LABELS).map(([op, label]) => (
                    <option key={op} value={op}>
                      {label}
                    </option>
                  ))}
                </Select>
                {!["empty", "notEmpty"].includes(rule.op) && (
                  <Input
                    value={rule.value}
                    onChange={(e) => setCondition(i, { value: e.target.value })}
                    placeholder="value"
                    className="h-9 flex-1"
                  />
                )}
                <button
                  onClick={() => removeCondition(i)}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-brand-500 hover:bg-brand-50 shrink-0"
                  aria-label="Remove rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Palette of field types the admin can add. */
export function AddFieldMenu({ onAdd }: { onAdd: (type: FormField["type"]) => void }) {
  const groups: Array<{ title: string; types: FormField["type"][] }> = [
    { title: "Text & numbers", types: ["text", "textarea", "number", "money", "phone", "email", "url"] },
    { title: "Date & time", types: ["date", "datetime", "time"] },
    { title: "Choices", types: ["select", "radio", "checkbox", "multicheckbox", "yesno"] },
    { title: "Media", types: ["photo", "photos", "file", "signature"] },
    { title: "Layout & content", types: ["row", "heading", "html", "divider", "spacer", "repeater"] },
  ];
  return (
    <div className="p-3 w-72 max-h-96 overflow-y-auto">
      {groups.map((g) => (
        <div key={g.title} className="mb-3 last:mb-0">
          <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">{g.title}</p>
          <div className="grid grid-cols-1 gap-0.5">
            {g.types.map((t) => (
              <button
                key={t}
                onClick={() => onAdd(t)}
                className="text-left px-2.5 py-2 rounded-lg text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-800"
              >
                {FIELD_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
