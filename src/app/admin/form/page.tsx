"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Eye,
  GripVertical,
  ListChecks,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Badge, Button, Card, Input, Spinner, Toggle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { EDITABLE_OPTION_GROUPS, mergeOptions, type FormOptions } from "@/lib/form-options";
import {
  FIELD_TYPE_LABELS,
  allFields as collectFields,
  newId,
  type FormField,
  type FormSchema,
  type FormStep,
} from "@/lib/form-schema";
import { DEFAULT_FORM_SCHEMA, resolveSchema } from "@/lib/form-schema-default";
import { AddFieldMenu, FieldEditor } from "./field-editor";

/* ---------------- immutable tree helpers ---------------- */

function mapFields(fields: FormField[], fn: (f: FormField) => FormField | null): FormField[] {
  const out: FormField[] = [];
  for (const f of fields) {
    const mapped = fn(f);
    if (!mapped) continue;
    out.push(mapped.children ? { ...mapped, children: mapFields(mapped.children, fn) } : mapped);
  }
  return out;
}

function updateField(fields: FormField[], id: string, patch: Partial<FormField>): FormField[] {
  return mapFields(fields, (f) => (f.id === id ? { ...f, ...patch } : f));
}

function deleteField(fields: FormField[], id: string): FormField[] {
  return mapFields(fields, (f) => (f.id === id ? null : f));
}

/** Move a field up/down within its own parent list. */
function moveField(fields: FormField[], id: string, dir: -1 | 1): FormField[] {
  const idx = fields.findIndex((f) => f.id === id);
  if (idx >= 0) {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return fields;
    const next = [...fields];
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  }
  return fields.map((f) => (f.children ? { ...f, children: moveField(f.children, id, dir) } : f));
}

function addFieldInto(fields: FormField[], parentId: string | null, field: FormField): FormField[] {
  if (parentId === null) return [...fields, field];
  return fields.map((f) =>
    f.id === parentId
      ? { ...f, children: [...(f.children || []), field] }
      : f.children
        ? { ...f, children: addFieldInto(f.children, parentId, field) }
        : f
  );
}

function makeField(type: FormField["type"]): FormField {
  const id = newId();
  const base: FormField = {
    id,
    type,
    key: type === "row" || type === "heading" || type === "html" ? id : `custom_${id.slice(2)}`,
    label: FIELD_TYPE_LABELS[type],
    width: 12,
  };
  if (type === "row") return { ...base, label: "Columns", children: [] };
  if (type === "heading") return { ...base, label: "New section" };
  if (type === "html") return { ...base, label: "", content: "Your text here." };
  if (["select", "radio", "multicheckbox"].includes(type)) return { ...base, label: "New field", options: ["Option A", "Option B"] };
  if (type === "repeater")
    return { ...base, label: "New table", columns: [{ key: "item", label: "Item", type: "text" }] };
  if (["divider", "spacer"].includes(type)) return { ...base, label: "" };
  return { ...base, label: "New field" };
}

/* ---------------- page ---------------- */

export default function FormBuilderPage() {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingInto, setAddingInto] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        setSchema(resolveSchema(j.settings?.formSchema));
        setOptions(mergeOptions(j.settings?.fieldOptions));
      });
  }, []);

  const persist = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(0), 2000);
    } finally {
      setSaving(false);
    }
  };

  const saveSchema = (next: FormSchema) => {
    setSchema(next);
    persist({ formSchema: next });
  };

  const saveOptions = (key: string, list: string[]) => {
    if (!options) return;
    const next = { ...options, [key]: list };
    setOptions(next);
    const toStore: Record<string, string[]> = {};
    for (const g of EDITABLE_OPTION_GROUPS) if (next[g.key]) toStore[g.key] = next[g.key];
    persist({ fieldOptions: toStore });
  };

  const everyField = useMemo(() => (schema ? collectFields(schema) : []), [schema]);

  if (!schema || !options) {
    return (
      <div className="py-24 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  const step = schema.steps[stepIdx];

  const patchStep = (patch: Partial<FormStep>) => {
    const steps = schema.steps.map((s, i) => (i === stepIdx ? { ...s, ...patch } : s));
    saveSchema({ ...schema, steps });
  };

  const setStepFields = (fields: FormField[]) => patchStep({ fields });

  const addStep = () => {
    const s: FormStep = { id: newId("step"), title: `Step ${schema.steps.length + 1}`, enabled: true, fields: [] };
    saveSchema({ ...schema, steps: [...schema.steps, s] });
    setStepIdx(schema.steps.length);
  };

  const deleteStep = () => {
    if (schema.steps.length <= 1) return;
    if (!confirm(`Delete the step "${step.title}" and all its fields?`)) return;
    const steps = schema.steps.filter((_, i) => i !== stepIdx);
    saveSchema({ ...schema, steps });
    setStepIdx(Math.max(0, stepIdx - 1));
  };

  const moveStep = (dir: -1 | 1) => {
    const j = stepIdx + dir;
    if (j < 0 || j >= schema.steps.length) return;
    const steps = [...schema.steps];
    [steps[stepIdx], steps[j]] = [steps[j], steps[stepIdx]];
    saveSchema({ ...schema, steps });
    setStepIdx(j);
  };

  const addField = (type: FormField["type"]) => {
    const field = makeField(type);
    setStepFields(addFieldInto(step.fields, addingInto ?? null, field));
    setSelectedId(field.id);
    setAddingInto(undefined);
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Form Builder</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Add, edit and reorder every field, step and section. Changes apply to the next check-in immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Spinner className="w-4 h-4 text-brand-600" />}
          {savedAt > 0 && <Badge tone="success">Saved</Badge>}
          <a href="/checkin" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4" /> Preview
            </Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset the whole form back to the default layout? Custom fields will be lost.")) {
                saveSchema(DEFAULT_FORM_SCHEMA);
                setStepIdx(0);
                setSelectedId(null);
              }
            }}
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
        </div>
      </div>

      {/* Step tabs */}
      <Card className="p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {schema.steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setStepIdx(i);
                setSelectedId(null);
              }}
              className={cn(
                "h-10 px-4 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors shrink-0",
                i === stepIdx ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
                s.enabled === false && "opacity-50 line-through"
              )}
            >
              {s.title}
            </button>
          ))}
          <button
            onClick={addStep}
            className="h-10 w-10 rounded-xl bg-ink-100 text-ink-500 hover:bg-ink-200 flex items-center justify-center shrink-0"
            aria-label="Add step"
            title="Add step"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
        </div>
      </Card>

      {/* Step settings */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            value={step.title}
            onChange={(e) => patchStep({ title: e.target.value })}
            className="h-10 max-w-xs font-semibold"
          />
          <Toggle checked={step.enabled !== false} onChange={(v) => patchStep({ enabled: v })} label="Enabled" />
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => moveStep(-1)}
              disabled={stepIdx === 0}
              className="w-9 h-9 rounded-lg border border-ink-300 flex items-center justify-center disabled:opacity-30 hover:bg-ink-50"
              aria-label="Move step left"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => moveStep(1)}
              disabled={stepIdx === schema.steps.length - 1}
              className="w-9 h-9 rounded-lg border border-ink-300 flex items-center justify-center disabled:opacity-30 hover:bg-ink-50"
              aria-label="Move step right"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <Button variant="danger" size="sm" onClick={deleteStep} disabled={schema.steps.length <= 1}>
              <Trash2 className="w-4 h-4" /> Delete step
            </Button>
          </div>
        </div>
      </Card>

      {/* Field list */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Fields in “{step.title}”</h2>
          <AddFieldButton
            open={addingInto === null}
            onToggle={(v) => setAddingInto(v ? null : undefined)}
            onAdd={addField}
            label="Add field"
          />
        </div>

        {step.fields.length === 0 ? (
          <p className="py-10 text-center text-ink-400 text-sm">No fields yet — use “Add field” to start.</p>
        ) : (
          <FieldList
            fields={step.fields}
            depth={0}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            onMove={(id, dir) => setStepFields(moveField(step.fields, id, dir))}
            onChange={(id, patch) => setStepFields(updateField(step.fields, id, patch))}
            onDelete={(id) => {
              setStepFields(deleteField(step.fields, id));
              setSelectedId(null);
            }}
            allFields={everyField}
            addingInto={addingInto}
            setAddingInto={setAddingInto}
            onAdd={addField}
          />
        )}
      </Card>

      {/* Shared option lists */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <ListChecks className="w-5 h-5 text-brand-600" />
          <h2 className="font-bold">Shared option lists</h2>
        </div>
        <p className="text-[13px] text-ink-500 mb-4">
          Lists reused by dropdowns and button groups across the form. Editing one updates every field that uses it.
        </p>
        <div className="space-y-2">
          {EDITABLE_OPTION_GROUPS.map((g) => (
            <OptionGroupEditor
              key={g.key}
              label={g.label}
              items={options[g.key] || []}
              onChange={(list) => saveOptions(g.key, list)}
            />
          ))}
        </div>
      </Card>

      <p className="text-xs text-ink-400 flex items-center gap-1.5">
        <Save className="w-3.5 h-3.5" /> Every change is saved automatically.
      </p>
    </div>
  );
}

/* ---------------- field list (recursive) ---------------- */

function FieldList({
  fields,
  depth,
  selectedId,
  onSelect,
  onMove,
  onChange,
  onDelete,
  allFields,
  addingInto,
  setAddingInto,
  onAdd,
}: {
  fields: FormField[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onChange: (id: string, patch: Partial<FormField>) => void;
  onDelete: (id: string) => void;
  allFields: FormField[];
  addingInto: string | null | undefined;
  setAddingInto: (v: string | null | undefined) => void;
  onAdd: (type: FormField["type"]) => void;
}) {
  return (
    <div className={cn("space-y-1.5", depth > 0 && "mt-2 pl-3 border-l-2 border-brand-200")}>
      {fields.map((f, i) => {
        const selected = selectedId === f.id;
        return (
          <div key={f.id} className={cn("rounded-xl border overflow-hidden", selected ? "border-brand-400" : "border-ink-200")}>
            <div className={cn("flex items-center gap-2 px-3 py-2.5", selected ? "bg-brand-50" : "bg-white hover:bg-ink-50")}>
              <GripVertical className="w-4 h-4 text-ink-300 shrink-0" />
              <button onClick={() => onSelect(f.id)} className="flex-1 min-w-0 text-left">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-ink-900 truncate">
                    {f.label || FIELD_TYPE_LABELS[f.type]}
                  </span>
                  {f.core && <Badge>core</Badge>}
                  {f.locked && (
                    <span title="Required by the app">
                      <Lock className="w-3.5 h-3.5 text-ink-400" />
                    </span>
                  )}
                  {f.required && <Badge tone="danger">required</Badge>}
                  {f.conditions?.rules?.length ? <Badge tone="warning">conditional</Badge> : null}
                </span>
                <span className="block text-xs text-ink-400">
                  {FIELD_TYPE_LABELS[f.type]}
                  {f.type !== "row" && f.width && f.width !== 12 ? ` · ${f.width}/12 width` : ""}
                </span>
              </button>
              {f.type === "row" && (
                <AddFieldButton
                  open={addingInto === f.id}
                  onToggle={(v) => setAddingInto(v ? f.id : undefined)}
                  onAdd={onAdd}
                  label="Add inside"
                  icon={<Columns3 className="w-4 h-4" />}
                />
              )}
              <button
                onClick={() => onMove(f.id, -1)}
                disabled={i === 0}
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30 shrink-0"
                aria-label="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMove(f.id, 1)}
                disabled={i === fields.length - 1}
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30 shrink-0"
                aria-label="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>

            {f.children && (
              <div className="px-3 pb-3 bg-white">
                {f.children.length === 0 ? (
                  <p className="text-xs text-ink-400 py-2 pl-3">Empty container — use “Add inside”.</p>
                ) : (
                  <FieldList
                    fields={f.children}
                    depth={depth + 1}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onMove={onMove}
                    onChange={onChange}
                    onDelete={onDelete}
                    allFields={allFields}
                    addingInto={addingInto}
                    setAddingInto={setAddingInto}
                    onAdd={onAdd}
                  />
                )}
              </div>
            )}

            {selected && (
              <FieldEditor
                field={f}
                allFields={allFields}
                onChange={(patch) => onChange(f.id, patch)}
                onDelete={() => onDelete(f.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- add-field popover ---------------- */

function AddFieldButton({
  open,
  onToggle,
  onAdd,
  label,
  icon,
}: {
  open: boolean;
  onToggle: (v: boolean) => void;
  onAdd: (type: FormField["type"]) => void;
  label: string;
  icon?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onToggle]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button size="sm" variant={icon ? "outline" : "primary"} onClick={() => onToggle(!open)}>
        {icon || <Plus className="w-4 h-4" />} {label}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 bg-white rounded-xl border border-ink-200 shadow-pop">
          <div className="flex items-center justify-between px-3 pt-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Add a field</span>
            <button onClick={() => onToggle(false)} className="text-ink-400 hover:text-ink-600" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <AddFieldMenu onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}

/* ---------------- shared option list editor ---------------- */

function OptionGroupEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (list: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState("");

  const update = (i: number, v: string) => onChange(items.map((x, ix) => (ix === i ? v : x)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const v = newItem.trim();
    if (!v) return;
    onChange([...items, v]);
    setNewItem("");
  };

  return (
    <div className="rounded-xl border border-ink-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-50 transition-colors"
      >
        <span className="font-semibold text-sm text-ink-800">{label}</span>
        <span className="flex items-center gap-2">
          <Badge>{items.length} options</Badge>
          <ArrowDown className={cn("w-4 h-4 text-ink-400 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-ink-100 bg-ink-50/40">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <GripVertical className="w-4 h-4 text-ink-300 shrink-0" />
              <Input value={item} onChange={(e) => update(i, e.target.value)} className="h-9 flex-1" />
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-200 disabled:opacity-30 shrink-0"
                aria-label="Move up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-200 disabled:opacity-30 shrink-0"
                aria-label="Move down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChange(items.filter((_, ix) => ix !== i))}
                className="w-8 h-8 rounded-md flex items-center justify-center text-brand-500 hover:bg-brand-50 shrink-0"
                aria-label="Remove option"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-4 shrink-0" />
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Add new option…"
              className="h-9 flex-1"
            />
            <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={add}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
