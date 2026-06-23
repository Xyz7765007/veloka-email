import { createHmac, timingSafeEqual } from "crypto";

/**
 * Access control for the main (team) link.
 *
 * The password lives ONLY on the server as ACCESS_PASSWORD. After a correct
 * entry we set an HttpOnly cookie whose value is an HMAC derived from the
 * password — so it can't be forged without the secret, and rotating the
 * password invalidates every existing session. If ACCESS_PASSWORD is unset the
 * main link fails closed (no one can get in) rather than hanging open.
 */

export const ACCESS_COOKIE = "cs_access";
const TOKEN_SUBJECT = "coldscore-team-v1";

function password(): string {
  return process.env.ACCESS_PASSWORD || "";
}

export function accessConfigured(): boolean {
  return password().length > 0;
}

/** The cookie value we set after a correct password. Deterministic + secret. */
export function sessionToken(): string {
  return createHmac("sha256", password() || "unset")
    .update(TOKEN_SUBJECT)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Validate a submitted password against ACCESS_PASSWORD (timing-safe). */
export function checkPassword(input: unknown): boolean {
  const p = password();
  if (!p || typeof input !== "string") return false;
  return safeEqual(input, p);
}

/** Validate a cookie value against the expected session token. */
export function cookieValid(value: string | undefined | null): boolean {
  if (!accessConfigured() || !value) return false;
  return safeEqual(value, sessionToken());
}

/** Parse a single cookie out of a raw Cookie header. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/** Is this request an authenticated team request? (route handlers) */
export function isAdminRequest(req: Request): boolean {
  const value = readCookie(req.headers.get("cookie"), ACCESS_COOKIE);
  return cookieValid(value);
}
