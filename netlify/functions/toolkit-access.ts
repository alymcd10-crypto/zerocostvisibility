import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { toolkitAccess } from "../../db/schema.js";
import { DEFAULT_CODE, checkCode, cookieHeader, createToken, signingSecret } from "../lib/access-token.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

// POST /api/toolkit-access { email, code, source } → sets the signed attendee cookie.
// The attendee codes are set in Netlify (TOOLKIT_CODE, comma-separated); the code in the page is never trusted.
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

  // Any entry in the list unlocks. The signing secret below uses the full string, so a single
  // code behaves exactly as before and the edge gate (which reads the same string) agrees.
  const code = Netlify.env.get("TOOLKIT_CODE") || DEFAULT_CODE;
  const result = checkCode(s("code"), code);
  if (!result.ok && result.opensLabel) {
    return json({ error: `That's the right code. The toolkit opens on ${result.opensLabel}.` }, 403);
  }
  if (!result.ok) {
    return json({ error: "That code doesn't match. It's on Liz's closing slide." }, 401);
  }

  try {
    await db.insert(toolkitAccess).values({ email, source: s("source").slice(0, 60) });
  } catch (err) {
    // The list is nice to have; never lock an attendee out because of it.
    console.error("toolkit_access insert failed", err);
  }

  const token = await createToken(signingSecret(Netlify.env.get("TOOLKIT_SECRET"), code));
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(token) });
};

export const config: Config = {
  path: "/api/toolkit-access",
  // A room full of phones on one conference Wi-Fi shares an IP, so keep this generous.
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
