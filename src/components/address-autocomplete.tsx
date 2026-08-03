"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AddressParts = { street?: string; city?: string; state?: string; zip?: string };

let bootstrapped = false;
let placesLibPromise: Promise<any> | null = null;

/** Google's official inline bootstrap loader — reliably defines google.maps.importLibrary. */
function ensureBootstrap(apiKey: string): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  if (w.google?.maps?.importLibrary) return true;
  if (bootstrapped) return true;
  bootstrapped = true;
  try {
    ((g: any) => {
      let h: any;
      const c = "google";
      const l = "importLibrary";
      const q = "__ib__";
      const m = document;
      let b: any = window;
      b = b[c] || (b[c] = {});
      const d = b.maps || (b.maps = {});
      const r = new Set<string>();
      const e = new URLSearchParams();
      const u = () =>
        h ||
        (h = new Promise<void>(async (f, n) => {
          const a = m.createElement("script");
          e.set("libraries", [...r].join(""));
          for (const k in g) e.set(k.replace(/[A-Z]/g, (t: string) => "_" + t[0].toLowerCase()), g[k]);
          e.set("callback", c + ".maps." + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => (h = n(Error("Google Maps could not load.")));
          m.head.append(a);
        }));
      if (d[l]) return;
      d[l] = (f: string, ...n: any[]) => r.add(f) && u().then(() => d[l](f, ...n));
    })({ key: apiKey, v: "weekly" });
    return true;
  } catch {
    return false;
  }
}

/** Load & cache the Places library once so predictions are instant after the first warm-up. */
function getPlacesLib(apiKey: string): Promise<any> | null {
  if (placesLibPromise) return placesLibPromise;
  if (!ensureBootstrap(apiKey)) return null;
  const g = (window as any).google;
  if (!g?.maps?.importLibrary) return null;
  placesLibPromise = g.maps.importLibrary("places");
  return placesLibPromise;
}

function parsePlace(place: any): AddressParts {
  const comps: any[] = place?.addressComponents || [];
  const get = (type: string, short = false) => {
    const c = comps.find((x) => x.types?.includes(type));
    return c ? (short ? c.shortText : c.longText) : "";
  };
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  const city = get("locality") || get("postal_town") || get("sublocality") || get("administrative_area_level_2");
  const state = get("administrative_area_level_1", true);
  const zip = get("postal_code");
  return { street: street || "", city, state, zip };
}

type Prediction = { id: string; main: string; secondary: string; sug: any };
type Rect = { top: number; left: number; width: number };

/**
 * Street-address input with a custom, on-brand Google Places autocomplete
 * dropdown (Places Data API + a portal so it always floats above the form).
 * Picking a suggestion fills street/city/state/zip. Plain input without a key.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onFill,
  apiKey,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onFill: (parts: AddressParts) => void;
  apiKey?: string;
  placeholder?: string;
}) {
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const tokenRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const justPickedRef = useRef(false);

  // Warm up the Places library on mount so the first lookup is fast.
  useEffect(() => {
    if (apiKey) getPlacesLib(apiKey);
  }, [apiKey]);

  const measure = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  // Reposition / close the floating list on scroll & resize.
  useEffect(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        const list = document.getElementById("uds-addr-list");
        if (!list || !list.contains(e.target as Node)) setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  // Fetch predictions (debounced) as the user types.
  useEffect(() => {
    if (!apiKey) return;
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears suggestions when the query is too short
      setPreds([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      const libP = getPlacesLib(apiKey);
      if (!libP) return;
      setLoading(true);
      measure();
      setOpen(true);
      try {
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await libP;
        if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken();
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          sessionToken: tokenRef.current,
          includedRegionCodes: ["us"],
        });
        const list: Prediction[] = (res.suggestions || [])
          .filter((s: any) => s.placePrediction)
          .map((s: any) => {
            const pp = s.placePrediction;
            return {
              id: pp.placeId,
              main: pp.mainText?.text ?? pp.text?.text ?? "",
              secondary: pp.secondaryText?.text ?? "",
              sug: s,
            };
          });
        setPreds(list);
        setOpen(list.length > 0);
        measure();
      } catch {
        setPreds([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [value, apiKey]);

  const pick = async (p: Prediction) => {
    setOpen(false);
    justPickedRef.current = true;
    try {
      const place = p.sug.placePrediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
      const parts = parsePlace(place);
      onChange(parts.street || [p.main, p.secondary].filter(Boolean).join(", "));
      onFill(parts);
    } catch {
      onChange([p.main, p.secondary].filter(Boolean).join(", "));
    }
    tokenRef.current = null; // fresh billing session after a selection
  };

  if (!apiKey) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />;
  }

  return (
    <div className="relative" ref={wrapRef}>
      <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => preds.length > 0 && (measure(), setOpen(true))}
        placeholder={placeholder}
        className="pl-11 pr-10"
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      )}
      {open &&
        (loading || preds.length > 0) &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="uds-addr-list"
            className="fixed z-[60] bg-white rounded-xl border border-ink-200 shadow-pop overflow-hidden max-h-72 overflow-y-auto"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {loading && preds.length === 0 && (
              <div className="px-4 py-3 text-sm text-ink-400 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                Searching addresses…
              </div>
            )}
            {preds.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-ink-50 border-b border-ink-100 last:border-0"
              >
                <MapPin className="w-4.5 h-4.5 text-brand-600 mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink-900 text-sm truncate">{p.main}</span>
                  {p.secondary && <span className="block text-xs text-ink-500 truncate">{p.secondary}</span>}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
