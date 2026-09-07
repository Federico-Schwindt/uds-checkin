import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt cost parameters — 128 * N * r ≈ 16 MB of memory per hash. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

/** Stored format: `scrypt$N$r$p$salt$key`, both parts base64url. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!password || !stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(keyB64, "base64url");
    const actual = scryptSync(password, salt, expected.length, {
      N: parseInt(n, 10),
      r: parseInt(r, 10),
      p: parseInt(p, 10),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Digits only, so everyone signs in on the keypad. */
export { PIN_MIN, PIN_MAX, isValidPin } from "@/lib/password-rules";

/** A random 6-digit PIN for a new account or a reset. */
export function generatePin(length = 6): string {
  const size = Math.min(10, Math.max(4, length));
  // Rejection sampling keeps every digit equally likely (256 % 10 !== 0).
  let out = "";
  while (out.length < size) {
    for (const b of randomBytes(16)) {
      if (b >= 250) continue;
      out += String(b % 10);
      if (out.length === size) break;
    }
  }
  return out;
}
