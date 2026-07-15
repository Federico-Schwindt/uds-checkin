import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { PinPad } from "./pin-pad";

export const metadata = { title: "Unlock | UDS Check-In" };

export default function LockPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-ink-950 px-4 py-8">
      {/* subtle brand glow */}
      <div className="pointer-events-none fixed inset-0 opacity-40 [background:radial-gradient(60%_50%_at_50%_0%,#1246ab55,transparent_70%)]" />
      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <Logo variant="white" className="h-11 sm:h-12 mx-auto mb-6" />
          <h1 className="text-xl font-bold text-white tracking-tight">Check-In Station</h1>
          <p className="text-ink-400 mt-1 text-sm">Enter PIN to unlock</p>
        </div>
        <Suspense>
          <PinPad />
        </Suspense>
      </div>
    </main>
  );
}
