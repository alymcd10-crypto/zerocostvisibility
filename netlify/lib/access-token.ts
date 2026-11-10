// Signed attendee-access cookie, shared by the toolkit-access function (Node) and the
// toolkit-gate edge function (Deno). Web Crypto only, so it runs in both.
//
// Token: "<expiry unix seconds>.<base64url HMAC-SHA256 of the expiry>"

export const COOKIE_NAME = "ltf_toolkit";
export const COOKIE_DAYS = 180;
// Codes that work when no environment variable is set. The first one is the primary code.
export const DEFAULT_CODES = ["RDTraining2026", "STARPOWER"];
export const DEFAULT_CODE = DEFAULT_CODES[0];
export const CODE_MISMATCH_MESSAGE =
  "That code doesn't match. Check the spaces and the zero. It's on the talk slides and in your binder.";

const enc = new TextEncoder();

// TOOLKIT_SECRET should be set in Netlify (16+ characters). Without it, the secret falls back
// to one derived from the PRIMARY code only (the first one in the list), so adding another
// code to the list never logs anyone out and the gate never fails open. Changing the primary
// code without TOOLKIT_SECRET set does sign everyone out, so set TOOLKIT_SECRET.
export function signingSecret(secret: string | undefined, primaryCode: string): string {
  return secret && secret.length >= 16 ? secret : `ltf-fallback:${primaryCode}`;
}

// Reads the code list: TOOLKIT_CODES (comma separated), else TOOLKIT_CODE, else the defaults.
export function toolkitCodes(get: (key: string) => string | undefined): string[] {
  const split = (v: string | undefined) => (v ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const list = split(get("TOOLKIT_CODES"));
  if (list.length) return list;
  const single = split(get("TOOLKIT_CODE"));
  return single.length ? single : DEFAULT_CODES;
}

// The signing secret as the function and the edge gate both compute it.
export function toolkitSecret(get: (key: string) => string | undefined): string {
  return signingSecret(get("TOOLKIT_SECRET"), toolkitCodes(get)[0]);
}

// Removes whitespace, hyphens and dash characters, upper-cases, and reads the letter O as the
// digit 0, so "rd training-2026" and "RDTraining2O26" both match RDTraining2026.
export function normalizeCode(code: string): string {
  return code.replace(/[\s\p{Pd}\u2212\u00ad]+/gu, "").toUpperCase().replace(/O/g, "0");
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

export function codeMatches(given: string, expected: string): boolean {
  return safeEqual(normalizeCode(given), normalizeCode(expected));
}

// True when the code matches any code in the list. Checks every code (no early exit).
export function anyCodeMatches(given: string, expected: string[]): boolean {
  let ok = false;
  for (const e of expected) if (codeMatches(given, e)) ok = true;
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
