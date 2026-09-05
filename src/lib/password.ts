import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt cost parameters — 128 * N * r ≈ 16 MB of memory per hash. */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;

/** Ambiguous characters (0/O, 1/l/I) are left out so staff can read passwords off paper. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

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

/** Random password in `Abcd-2345-Efgh` form — 12 characters, ~70 bits of entropy. */
export function generatePassword(): string {
  // Rejection sampling keeps every character equally likely (256 % 57 !== 0).
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const chars: string[] = [];
  while (chars.length < 12) {
    for (const b of randomBytes(16)) {
      if (b >= limit) continue;
      chars.push(ALPHABET[b % ALPHABET.length]);
      if (chars.length === 12) break;
    }
  }
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}
