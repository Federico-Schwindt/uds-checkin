import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "uds_auth";

export type Role = "admin" | "tech";

export type Session = {
  /** users.id */
  uid: number;
  role: Role;
  name: string;
  username: string;
  /** Expiry, epoch ms. */
  exp: number;
};

function secret(): string {
  return process.env.AUTH_SECRET || "uds-checkin-dev-secret-change-in-prod";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Token format: <base64url(json session)>.<hmac> */
export function createSessionToken(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the session when the signature is valid and it has not expired, else null. */
export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!parsed || typeof parsed.exp !== "number" || parsed.exp <= Date.now()) return null;
    if (parsed.role !== "admin" && parsed.role !== "tech") return null;
    if (typeof parsed.uid !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAdmin(session: Session | null): boolean {
  return session?.role === "admin";
}

/** Human label used as the `actor` on audit-log rows. */
export function actorLabel(session: Session | null): string {
  if (!session) return "";
  return `${session.name} (${session.role})`;
}
