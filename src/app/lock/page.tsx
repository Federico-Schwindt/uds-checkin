import { Suspense } from "react";
import { PinPad } from "./pin-pad";

export const metadata = { title: "Unlock | UDS Check-In" };

export default function LockPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 shadow-pop mb-4">
            <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-white" stroke="currentColor" strokeWidth={2}>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 1 1 8 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Universal Driveshafts</h1>
          <p className="text-ink-400 mt-1">Enter PIN to unlock the check-in station</p>
        </div>
        <Suspense>
          <PinPad />
        </Suspense>
      </div>
    </main>
  );
}
