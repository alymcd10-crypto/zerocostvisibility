// Signed attendee-access cookie, shared by the toolkit-access function (Node) and the
// toolkit-gate edge function (Deno). Web Crypto only, so it runs in both.
//
// Token: "<expiry unix seconds>.<base64url HMAC-SHA256 of the expiry>"

export const COOKIE_NAME = "ltf_toolkit";
export const COOKIE_DAYS = 180;
export const DEFAULT_CODE = "STARPOWER";

const enc = new TextEncoder();

// TOOLKIT_SECRET should be set in Netlify. Without it, the secret falls back to one derived
// from the code, so changing the code still logs everyone out and the gate never fails open.
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

export function codeMatches(given: string, expected: string): boolean {
  return safeEqual(normalizeCode(given), normalizeCode(expected));
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
