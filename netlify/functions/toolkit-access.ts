import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { toolkitAccess } from "../../db/schema.js";
import { CODE_MISMATCH_MESSAGE, anyCodeMatches, cookieHeader, createToken, toolkitCodes, toolkitSecret } from "../lib/access-token.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

// POST /api/toolkit-access { email, code, source } → sets the signed attendee cookie.
// Attendee codes are set in Netlify (TOOLKIT_CODES, comma separated; or TOOLKIT_CODE). The code in the page is never trusted.
export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  if (s("company-website")) return json({ error: "That code doesn't match." }, 401);

  const email = s("email").slice(0, 200).toLowerCase();
  if (!EMAIL.test(email)) return json({ error: "Please enter a valid email." }, 400);

  const get = (k: string) => Netlify.env.get(k);
  if (!anyCodeMatches(s("code"), toolkitCodes(get))) {
    return json({ error: CODE_MISMATCH_MESSAGE }, 401);
  }

  try {
    await db.insert(toolkitAccess).values({ email, source: s("source").slice(0, 60) });
  } catch (err) {
    // The list is nice to have; never lock an attendee out because of it.
    console.error("toolkit_access insert failed", err);
  }

  const token = await createToken(toolkitSecret(get));
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(token) });
};

export const config: Config = {
  path: "/api/toolkit-access",
  // A room full of phones on one conference Wi-Fi shares an IP, so keep this generous (300 a minute per IP; the honeypot is the bot control).
  rateLimit: { windowLimit: 300, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
