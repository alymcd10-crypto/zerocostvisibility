// Signed attendee-access cookie, shared by the toolkit-access function (Node) and the
// toolkit-gate edge function (Deno). Web Crypto only, so it runs in both.
//
// Token: "<expiry unix seconds>.<base64url HMAC-SHA256 of the expiry>"

export const COOKIE_NAME = "ltf_toolkit";
export const COOKIE_DAYS = 180;
export const DEFAULT_CODE = "STARPOWER";
// Codes printed in Liz's decks, each with the moment it starts working. They work whatever
// TOOLKIT_CODE is set to, so the code on the slide never depends on a Netlify setting.
// Codes in TOOLKIT_CODE work at any time: use one there to test before an event opens.
export const EVENT_CODES: { code: string; opens: string; label: string }[] = [
  { code: "RESET2026", opens: "2026-12-15T00:00:00-05:00", label: "December 15" },
];

export type CodeResult = { ok: true } | { ok: false; opensLabel?: string };

// Checks a submitted code against the event codes (valid from their opening time) and
// TOOLKIT_CODE (always valid). The opening time wins: an event code stays closed until then
// even if it is also listed in TOOLKIT_CODE. Used too early, it says when it opens.
export function checkCode(given: string, envCode: string, now = Date.now()): CodeResult {
  for (const e of EVENT_CODES) {
    if (!codeMatches(given, e.code)) continue;
    if (now >= Date.parse(e.opens)) return { ok: true };
    return { ok: false, opensLabel: e.label };
  }
  return codeMatches(given, envCode) ? { ok: true } : { ok: false };
}

const enc = new TextEncoder();

// TOOLKIT_SECRET should be set in Netlify. Without it, the secret falls back to one derived
// from the full TOOLKIT_CODE string (the whole list, unchanged), so changing the code still logs everyone out and the gate never fails open.
export function signingSecret(secret: string | undefined, code: string): string {
  return secret && secret.length >= 16 ? secret : `ltf-fallback:${code}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// TOOLKIT_CODE may hold several codes separated by commas (e.g. "CODE1,CODE2").
// Each entry is trimmed and compared without regard to case; empty entries are ignored.
export function parseCodes(codes: string): string[] {
  return codes.split(",").map(normalizeCode).filter(Boolean);
}

// What is compared: forgives spaces, hyphens and dashes anywhere, letter case, and the
// letter O typed for a zero (and the other way round).
export function matchKey(code: string): string {
  return normalizeCode(code).replace(/[\s\-\u2010-\u2015]/g, "").replace(/O/g, "0");
}

export function codeMatches(given: string, expected: string): boolean {
  const g = matchKey(given);
  if (!g) return false;
  // Check every entry (no early exit) so the response time doesn't hint at which one matched.
  let ok = false;
  for (const code of parseCodes(expected)) ok = safeEqual(g, matchKey(code)) || ok;
  return ok;
}

export async function createToken(secret: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + COOKIE_DAYS * 86400;
  return `${exp}.${await hmac(secret, String(exp))}`;
}

export async function verifyToken(token: string | undefined | null, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!/^\d+$/.test(exp ?? "") || !sig) return false;
  if (Number(exp) * 1000 < now) return false;
  return safeEqual(sig, await hmac(secret, exp));
}

export function readCookie(header: string | null, name = COOKIE_NAME): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export function cookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
