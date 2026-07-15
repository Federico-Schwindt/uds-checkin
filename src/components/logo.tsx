import { cn } from "@/lib/utils";

/**
 * Universal Driveshafts wordmark (bundled in /public). Aspect ratio ~6.25:1.
 * Use `variant="white"` on dark backgrounds.
 */
export function Logo({ className, variant = "color" }: { className?: string; variant?: "color" | "white" }) {
  const src = variant === "white" ? "/uds-logo-white.png" : "/uds-logo.png";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Universal Driveshafts" className={cn("h-8 w-auto select-none", className)} />;
}
