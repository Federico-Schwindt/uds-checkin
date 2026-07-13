"use client";

import { useEffect, useRef } from "react";
import SignaturePadLib from "signature_pad";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignatureField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePadLib(canvas, {
      penColor: "#0f172a",
      minWidth: 1,
      maxWidth: 2.5,
    });
    padRef.current = pad;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.fromData(data);
    };
    resize();
    window.addEventListener("resize", resize);

    pad.addEventListener("endStroke", () => {
      onChange(pad.isEmpty() ? "" : pad.toDataURL("image/png"));
    });

    return () => {
      window.removeEventListener("resize", resize);
      pad.off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore an existing signature (e.g. draft reload) once.
  useEffect(() => {
    const pad = padRef.current;
    if (pad && value && pad.isEmpty()) {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        ctx?.drawImage(img, 0, 0, canvas.width / ratio, canvas.height / ratio);
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    padRef.current?.clear();
    onChange("");
  };

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-40 sm:h-44 rounded-xl border-2 border-dashed border-ink-300 bg-white touch-none"
      />
      <div className="absolute bottom-3 left-4 right-16 border-b border-ink-300 pointer-events-none" />
      <span className="absolute bottom-4 left-4 text-[11px] uppercase tracking-wide text-ink-400 pointer-events-none select-none">
        Sign here
      </span>
      <button
        type="button"
        onClick={clear}
        className="absolute top-2 right-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-ink-100 text-ink-600 text-xs font-semibold hover:bg-ink-200 active:scale-95 transition-all"
      >
        <Eraser className="w-3.5 h-3.5" /> Clear
      </button>
    </div>
  );
}
