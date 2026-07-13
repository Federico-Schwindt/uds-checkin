"use client";

import { forwardRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }
>(function Button({ className, variant = "primary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all select-none",
        "active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-5 text-[15px]",
        size === "lg" && "h-14 px-7 text-base",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
        variant === "secondary" && "bg-ink-900 text-white hover:bg-ink-800 shadow-sm",
        variant === "outline" && "border border-ink-300 bg-white text-ink-800 hover:bg-ink-50",
        variant === "ghost" && "text-ink-700 hover:bg-ink-200/60",
        variant === "danger" && "bg-white border border-brand-200 text-brand-700 hover:bg-brand-50",
        className
      )}
      {...props}
    />
  );
});

/* ---------- Card ---------- */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-white rounded-2xl shadow-card border border-ink-200/60", className)} {...props} />;
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 mb-4", className)}>
      <div className="h-6 w-1.5 rounded-full bg-brand-600" />
      <h2 className="text-lg font-bold tracking-tight text-ink-900 uppercase">{children}</h2>
    </div>
  );
}

/* ---------- Field wrapper ---------- */

export function Field({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-[13px] font-semibold text-ink-700">
          {label}
          {required && <span className="text-brand-600 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-ink-500">{hint}</p>}
      {error && <p className="text-xs font-medium text-brand-600">{error}</p>}
    </div>
  );
}

/* ---------- Inputs ---------- */

const inputBase =
  "w-full h-12 px-3.5 rounded-xl border border-ink-300 bg-white text-[15px] text-ink-900 placeholder:text-ink-400 transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 disabled:bg-ink-100";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(inputBase, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputBase, "h-auto min-h-24 py-3", className)} {...props} />;
  }
);

export function Select({
  className,
  children,
  placeholder,
  value,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  return (
    <div className="relative">
      <select
        className={cn(inputBase, "appearance-none pr-10", !value && "text-ink-400", className)}
        value={value}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder || "Select…"}</option>}
        {children}
      </select>
      <ChevronDown className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
    </div>
  );
}

export function SelectOptions({ options }: { options: string[] }) {
  return (
    <>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </>
  );
}

/* ---------- Choice chips (touch-friendly radio) ---------- */

export function ChoiceChips({
  options,
  value,
  onChange,
  columns,
  allowClear = true,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  columns?: number;
  allowClear?: boolean;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns || Math.min(options.length, 4)}, minmax(0,1fr))` }}
    >
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(active && allowClear ? "" : o)}
            className={cn(
              "min-h-12 px-3 py-2 rounded-xl border text-[14px] font-medium transition-all select-none text-left",
              "active:scale-[0.98]",
              active
                ? "border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-500/30"
                : "border-ink-300 bg-white text-ink-700 hover:border-ink-400"
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "w-4.5 h-4.5 shrink-0 rounded-full border flex items-center justify-center",
                  active ? "border-brand-600 bg-brand-600" : "border-ink-300 bg-white"
                )}
              >
                {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              {o}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Checkbox row ---------- */

export function CheckboxRow({
  checked,
  onChange,
  children,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
        checked ? "border-brand-600 bg-brand-50 ring-2 ring-brand-500/25" : "border-ink-300 bg-white hover:border-ink-400",
        className
      )}
    >
      <span
        className={cn(
          "w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center mt-0.5 transition-colors",
          checked ? "border-brand-600 bg-brand-600" : "border-ink-300 bg-white"
        )}
      >
        {checked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
      </span>
      <span className="text-sm text-ink-700 leading-relaxed">{children}</span>
    </button>
  );
}

/* ---------- Badge ---------- */

const STATUS_STYLES: Record<string, string> = {
  New: "bg-ink-100 text-ink-700 border-ink-300",
  Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  Ongoing: "bg-amber-50 text-amber-700 border-amber-200",
  "On hold": "bg-orange-50 text-orange-700 border-orange-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap",
        STATUS_STYLES[status] || STATUS_STYLES.New,
        className
      )}
    >
      {status || "New"}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap",
        tone === "neutral" && "bg-ink-100 text-ink-700 border-ink-300",
        tone === "success" && "bg-emerald-50 text-emerald-700 border-emerald-200",
        tone === "danger" && "bg-brand-50 text-brand-700 border-brand-200",
        tone === "warning" && "bg-amber-50 text-amber-700 border-amber-200",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Toggle ---------- */

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("flex items-center gap-3 select-none", disabled && "opacity-50 pointer-events-none")}
    >
      <span
        className={cn(
          "w-11 h-6.5 rounded-full p-0.5 transition-colors",
          checked ? "bg-brand-600" : "bg-ink-300"
        )}
      >
        <span
          className={cn(
            "block w-5.5 h-5.5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-[18px]"
          )}
        />
      </span>
      {label && <span className="text-sm font-medium text-ink-800">{label}</span>}
    </button>
  );
}

/* ---------- Spinner ---------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin",
        className
      )}
    />
  );
}
