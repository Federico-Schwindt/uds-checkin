"use client";

/** Clears the session cookie and returns to the sign-in screen. */
export function SignOutButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/lock";
    }
  };
  return (
    <button type="button" onClick={signOut} className={className}>
      {children}
    </button>
  );
}
