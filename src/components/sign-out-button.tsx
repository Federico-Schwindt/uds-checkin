"use client";

/** Clears the session cookie and returns to the sign-in screen. */
export function SignOutButton({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/lock";
    }
  };
  return (
    <button type="button" onClick={signOut} className={className} title={title} aria-label={title}>
      {children}
    </button>
  );
}
