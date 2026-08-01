"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AddressParts = { street?: string; city?: string; state?: string; zip?: string };

let bootstrapped = false;

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

/**
 * Street-address input with a custom, on-brand Google Places autocomplete
 * dropdown (built on the Places Data API so it matches the app styling instead
 * of Google's unstyleable web component). Picking a suggestion fills
 * street/city/state/zip. Falls back to a plain input without an API key.
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
  const tokenRef = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const justPickedRef = useRef(false);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

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
      return;
    }
    const t = setTimeout(async () => {
      if (!ensureBootstrap(apiKey)) return;
      const g = (window as any).google;
      try {
        setLoading(true);
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await g.maps.importLibrary("places");
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
      } catch {
        setPreds([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, apiKey]);

  const pick = async (p: Prediction) => {
    setOpen(false);
    justPickedRef.current = true;
    try {
      const place = p.sug.placePrediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
      const parts = parsePlace(place);
      if (parts.street) onChange(parts.street);
      else onChange([p.main, p.secondary].filter(Boolean).join(", "));
      onFill(parts);
    } catch {
      onChange([p.main, p.secondary].filter(Boolean).join(", "));
    }
    tokenRef.current = null; // start a fresh billing session after a selection
  };

  if (!apiKey) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />;
  }

  return (
    <div className="relative" ref={boxRef}>
      <Search className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => preds.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="pl-11"
        autoComplete="off"
      />
      {loading && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">…</span>}
      {open && preds.length > 0 && (
        <div className="absolute z-40 mt-2 w-full bg-white rounded-xl border border-ink-200 shadow-pop overflow-hidden max-h-72 overflow-y-auto">
          {preds.map((p) => (
            <button
              key={p.id}
              type="button"
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
        </div>
      )}
    </div>
  );
}
