import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "uds_auth";

function secret(): string {
  return process.env.AUTH_SECRET || "uds-checkin-dev-secret-change-in-prod";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Token format: <expiresAtMs>.<hmac> */
export function createSessionToken(days: number): string {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const exp = parseInt(payload, 10);
  return !isNaN(exp) && exp > Date.now();
}
