/**
 * PIN shape, shared by the sign-in keypad and the admin PIN form. Kept apart
 * from `password.ts` so the browser never pulls node:crypto in with it.
 */
export const PIN_MIN = 4;
export const PIN_MAX = 10;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin || "");
}
