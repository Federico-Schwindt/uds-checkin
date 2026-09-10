"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { screenFor } from "@/lib/app-map";

/**
 * Names the screen you are on and says what it is for, above every admin page.
 * Thirteen sections is a lot to hold in your head; this means you never have to.
 */
export function AdminContextBar() {
  const pathname = usePathname();
  const screen = screenFor(pathname);
  if (!screen) return null;
  // On a sub-page the label is a way back; on the section's own page it would
  // only repeat the heading below it.
  const onSubPage = pathname !== screen.href;

  return (
    <div className="bg-white border-b border-ink-200 no-print">
      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-2.5 flex items-center gap-3">
        <p className="text-[13px] text-ink-500 min-w-0">
          {onSubPage && (
            <>
              <Link href={screen.href} className="font-bold text-ink-800 hover:text-brand-700">
                {screen.label}
              </Link>
              <span className="mx-2 text-ink-300">/</span>
            </>
          )}
          {screen.purpose}
        </p>
        <Link
          href="/help"
          title="Open the guide"
          aria-label="Open the guide"
          className="ml-auto shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-brand-700 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
