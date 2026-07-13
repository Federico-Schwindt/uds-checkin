"use client";

import { useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { Badge, Button, Card, Spinner } from "@/components/ui";

type ImportResult = {
  imported: number;
  skipped: number;
  customersCreated: number;
  customersMatched: number;
  totalRows: number;
  errors: string[];
};

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Import failed");
      } else {
        setResult(j);
      }
    } catch {
      setError("Connection error during import.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import from Gravity Forms</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          Upload the entries CSV exported from Gravity Forms (ODESSA CHECK-IN form). Customers are de-duplicated by
          phone number, and rows that were already imported are skipped automatically — it&apos;s safe to run this more
          than once.
        </p>
      </div>

      <Card className="p-6">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setResult(null);
            setError("");
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-36 rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 flex flex-col items-center justify-center gap-2 text-ink-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          <FileUp className="w-8 h-8" />
          <span className="text-sm font-semibold">{file ? file.name : "Choose the Gravity Forms CSV export"}</span>
          {file && <span className="text-xs text-ink-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
        </button>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={run} disabled={!file || busy}>
            {busy ? <Spinner className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {busy ? "Importing… this can take a minute" : "Start import"}
          </Button>
        </div>

        {error && (
          <p className="mt-4 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 animate-fade-up">
            <p className="font-bold text-emerald-800 mb-2">Import finished</p>
            <ul className="text-sm text-emerald-800 space-y-1">
              <li>
                <strong>{result.imported}</strong> entries imported out of {result.totalRows} rows
              </li>
              <li>
                <strong>{result.skipped}</strong> skipped (already imported or no entry id)
              </li>
              <li>
                <strong>{result.customersCreated}</strong> new customers created ·{" "}
                <strong>{result.customersMatched}</strong> matched to existing customers by phone
              </li>
            </ul>
            {result.errors.length > 0 && (
              <div className="mt-3">
                <Badge tone="warning">Some rows had errors</Badge>
                <ul className="text-xs text-amber-800 mt-2 space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
