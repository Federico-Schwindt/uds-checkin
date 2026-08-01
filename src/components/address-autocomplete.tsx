"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AddressParts = { street?: string; city?: string; state?: string; zip?: string };

const FALLBACK_CLASSES =
  "w-full h-12 px-3.5 rounded-xl border border-ink-300 bg-white text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25";

let bootstrapped = false;

/**
 * Install Google's official inline bootstrap loader, which reliably defines
 * `google.maps.importLibrary`. Awaiting importLibrary("places") then guarantees
 * the (new) Places element is ready — unlike the classic script's onload.
 */
function ensureBootstrap(apiKey: string): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  if (w.google?.maps?.importLibrary) return true;
  if (bootstrapped) return true;
  bootstrapped = true;
  try {
    // Minified official loader (developers.google.com/maps/documentation/javascript/load-maps-js-api)
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

/** Parse the new Place.addressComponents format (longText/shortText/types). */
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
  return { street: street || place?.formattedAddress || "", city, state, zip };
}

/**
 * Street-address input backed by Google's PlaceAutocompleteElement. Picking a
 * suggestion fills street/city/state/zip via `onFill`. Falls back to a plain
 * input when no API key is set or the Places element fails to load.
 *
 * The Google element (or a fallback input) is mounted imperatively into a host
 * div that React keeps empty, so React reconciliation never fights the Google
 * web component.
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
  const hostRef = useRef<HTMLDivElement>(null);
  // Keep the latest callbacks without re-running the mount effect.
  const cb = useRef({ onChange, onFill, value, placeholder });
  useEffect(() => {
    cb.current = { onChange, onFill, value, placeholder };
  });

  useEffect(() => {
    if (!apiKey || !hostRef.current) return;
    const host = hostRef.current;
    let disposed = false;

    (async () => {
      let PlaceAutocompleteElement: any;
      // Install the bootstrap first, THEN read window.google (it may not exist before).
      const ready = ensureBootstrap(apiKey);
      const g = (window as any).google;
      if (ready && g?.maps?.importLibrary) {
        try {
          ({ PlaceAutocompleteElement } = await g.maps.importLibrary("places"));
        } catch {
          /* ignore */
        }
      }
      if (disposed || !host) return;
      host.innerHTML = "";

      if (PlaceAutocompleteElement) {
        try {
          const el: any = new PlaceAutocompleteElement({ includedRegionCodes: ["us"] });
          el.style.width = "100%";
          if (cb.current.value) el.value = cb.current.value;
          host.appendChild(el);
          el.addEventListener("gmp-select", async (ev: any) => {
            try {
              const place = ev.placePrediction.toPlace();
              await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
              const parts = parsePlace(place);
              if (parts.street) cb.current.onChange(parts.street);
              cb.current.onFill(parts);
            } catch {
              /* ignore */
            }
          });
          el.addEventListener("input", (ev: any) => {
            const v = ev?.target?.value ?? el.value ?? "";
            if (typeof v === "string") cb.current.onChange(v);
          });
          return;
        } catch {
          /* fall through to native input */
        }
      }

      // Fallback: a plain native input wired to onChange.
      const inp = document.createElement("input");
      inp.className = FALLBACK_CLASSES;
      inp.value = cb.current.value || "";
      inp.placeholder = cb.current.placeholder || "";
      inp.autocomplete = "off";
      inp.addEventListener("input", () => cb.current.onChange(inp.value));
      host.appendChild(inp);
    })();

    return () => {
      disposed = true;
      host.innerHTML = "";
    };
  }, [apiKey]);

  if (!apiKey) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" />;
  }
  return <div ref={hostRef} className="uds-place-autocomplete" />;
}
