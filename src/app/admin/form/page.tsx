"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Asterisk, Eye, EyeOff, RotateCcw, Save } from "lucide-react";
import { Badge, Button, Card, Spinner, Toggle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DEFAULT_FORM_LAYOUT, mergeFormLayout, type FormLayout } from "@/lib/form-layout";

const GROUP_TITLES: Record<string, string> = {
  customer: "Customer step fields",
  vehicle: "Vehicle Information fields",
  job: "Technician Job Information fields",
  terms: "Terms step fields",
  staff: "Staff step fields",
};

// Fields the wizard can't work without.
const LOCKED_REQUIRED = new Set(["firstName", "lastName", "phone"]);

export default function FormBuilderPage() {
  const [layout, setLayout] = useState<FormLayout | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => setLayout(mergeFormLayout(j.settings?.formLayout)));
  }, []);

  const save = async (next: FormLayout) => {
    setLayout(next);
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formLayout: next }),
      });
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(0), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!layout) {
    return (
      <div className="py-24 text-center">
        <Spinner className="text-brand-600" />
      </div>
    );
  }

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= layout.steps.length) return;
    const steps = [...layout.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    save({ ...layout, steps });
  };

  const toggleStep = (i: number) => {
    // Customer step can't be disabled — it collects the contact info.
    if (layout.steps[i].key === "customer") return;
    const steps = layout.steps.map((s, ix) => (ix === i ? { ...s, enabled: !s.enabled } : s));
    save({ ...layout, steps });
  };

  const moveField = (group: string, i: number, dir: -1 | 1) => {
    const list = [...(layout.fields[group] || [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    save({ ...layout, fields: { ...layout.fields, [group]: list } });
  };

  const toggleField = (group: string, i: number, prop: "visible" | "required") => {
    const list = (layout.fields[group] || []).map((f, ix) => {
      if (ix !== i) return f;
      if (prop === "required" && LOCKED_REQUIRED.has(f.key)) return f;
      if (prop === "visible" && LOCKED_REQUIRED.has(f.key)) return f;
      return { ...f, [prop]: !f[prop] };
    });
    save({ ...layout, fields: { ...layout.fields, [group]: list } });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Form Builder</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Reorder or hide the wizard steps and fields. Changes apply to the next check-in immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Spinner className="w-4 h-4 text-brand-600" />}
          {savedAt > 0 && <Badge tone="success">Saved</Badge>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Reset the form layout to defaults?")) save(DEFAULT_FORM_LAYOUT);
            }}
          >
            <RotateCcw className="w-4 h-4" /> Reset to default
          </Button>
        </div>
      </div>

      {/* Steps */}
      <Card className="p-5">
        <h2 className="font-bold mb-1">Steps</h2>
        <p className="text-[13px] text-ink-500 mb-4">Order of the wizard pages. Disabled steps are skipped.</p>
        <div className="space-y-1.5">
          {layout.steps.map((s, i) => (
            <div
              key={s.key}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border",
                s.enabled ? "border-ink-200 bg-white" : "border-ink-200 bg-ink-50 opacity-70"
              )}
            >
              <span className="w-7 h-7 rounded-lg bg-ink-100 text-ink-600 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className={cn("flex-1 font-semibold text-sm", !s.enabled && "line-through text-ink-400")}>
                {s.title}
              </span>
              <Toggle checked={s.enabled} onChange={() => toggleStep(i)} disabled={s.key === "customer"} />
              <button
                onClick={() => moveStep(i, -1)}
                disabled={i === 0}
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                aria-label="Move step up"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => moveStep(i, 1)}
                disabled={i === layout.steps.length - 1}
                className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                aria-label="Move step down"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Fields per group */}
      {Object.entries(GROUP_TITLES).map(([group, title]) => (
        <Card key={group} className="p-5">
          <h2 className="font-bold mb-1">{title}</h2>
          <p className="text-[13px] text-ink-500 mb-4">
            <Eye className="w-3.5 h-3.5 inline mr-1" />
            show/hide · <Asterisk className="w-3.5 h-3.5 inline mx-1 text-brand-600" />
            required · arrows reorder
          </p>
          <div className="space-y-1">
            {(layout.fields[group] || []).map((f, i) => {
              const locked = LOCKED_REQUIRED.has(f.key);
              return (
                <div key={f.key} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-ink-50">
                  <button
                    onClick={() => toggleField(group, i, "visible")}
                    disabled={locked}
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                      locked ? "text-ink-300" : f.visible ? "text-emerald-600 hover:bg-emerald-50" : "text-ink-400 hover:bg-ink-100"
                    )}
                    title={locked ? "This field can't be hidden" : f.visible ? "Hide field" : "Show field"}
                  >
                    {f.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleField(group, i, "required")}
                    disabled={locked}
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                      f.required ? "text-brand-600" : "text-ink-300",
                      !locked && "hover:bg-brand-50"
                    )}
                    title={locked ? "Always required" : f.required ? "Make optional" : "Make required"}
                  >
                    <Asterisk className="w-4 h-4" />
                  </button>
                  <span className={cn("flex-1 text-sm font-medium", !f.visible && "text-ink-400 line-through")}>
                    {f.label}
                    {locked && <span className="text-[10px] text-ink-400 ml-2 uppercase">locked</span>}
                  </span>
                  <button
                    onClick={() => moveField(group, i, -1)}
                    disabled={i === 0}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                    aria-label="Move field up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveField(group, i, 1)}
                    disabled={i === (layout.fields[group] || []).length - 1}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                    aria-label="Move field down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <p className="text-xs text-ink-400 flex items-center gap-1.5">
        <Save className="w-3.5 h-3.5" /> Every change is saved automatically.
      </p>
    </div>
  );
}
