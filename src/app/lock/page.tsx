import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SignIn } from "./sign-in";

export const metadata = { title: "Sign in | UDS Check-In" };
// Never prerendered or cached: a stale copy of this page after a deploy is
// exactly what leaves someone staring at a sign-in screen that does nothing.
export const dynamic = "force-dynamic";

export default function LockPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-ink-100 px-4 py-8 relative overflow-hidden">
      {/* brand accent glows */}
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(70%_55%_at_50%_-10%,#1246ab22,transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full bg-brand-600/5 blur-3xl" />

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="bg-white rounded-3xl shadow-pop border border-ink-200/70 p-7 sm:p-8">
          <div className="text-center mb-6">
            <Logo className="h-10 sm:h-11 mx-auto mb-5" />
            <h1 className="text-lg font-bold tracking-tight text-ink-900">Check-In Station</h1>
            <p className="text-ink-500 mt-1 text-sm">Choose your profile to sign in</p>
          </div>
          <Suspense>
            <SignIn />
          </Suspense>
        </div>
        <p className="text-center text-xs text-ink-400 mt-5">Universal Driveshafts · Staff access only</p>
      </div>
    </main>
  );
}
