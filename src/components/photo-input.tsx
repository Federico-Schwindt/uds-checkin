"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Compress the chosen image client-side so submissions stay small. */
async function fileToDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function PhotoInput({
  value,
  onChange,
  label = "Take / upload a photo",
  className,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToDataUrl(file));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("", className)}>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Uploaded" className="h-36 rounded-xl border border-ink-300 object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ink-900 text-white flex items-center justify-center shadow active:scale-90 transition-transform"
            aria-label="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 flex flex-col items-center justify-center gap-1.5 text-ink-500 hover:border-brand-400 hover:text-brand-600 transition-colors active:scale-[0.99]"
        >
          <Camera className="w-7 h-7" />
          <span className="text-sm font-medium">{busy ? "Processing…" : label}</span>
        </button>
      )}
    </div>
  );
}
