// Local stand-in for Netlify, for the end-to-end test: static files with pretty URLs,
// the redirects in netlify.toml, the toolkit gate, both APIs (in memory, same rules) and
// Netlify Forms. Run: node --experimental-strip-types tests/dev-server.ts [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import {
  DEFAULT_CODE, codeMatches, cookieHeader, createToken, readCookie, signingSecret, verifyToken,
} from "../netlify/lib/access-token.ts";
import { BOOKING_RULES, bookableRange, slotError } from "../netlify/lib/booking-rules.ts";

// Serves the built site (npm run build) so {{SITE_URL}} is filled in as on Netlify.
const ROOT = new URL("../dist/", import.meta.url).pathname;
const PORT = Number(process.argv[2] ?? 8888);
const SECRET = signingSecret(undefined, DEFAULT_CODE);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain",
};

const toml = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
const redirects = [...toml.matchAll(/\[\[redirects\]\]\s*from = "([^"]+)"\s*to = "([^"]+)"\s*status = (\d+)/g)]
  .map(([, from, to, status]) => ({ from, to, status: Number(status) }));

const bookings: { date: string; time: string; email: string; status: string }[] = [];
export const forms: Record<string, string>[] = [];
const access: { email: string; source: string }[] = [];

async function file(path: string): Promise<string | null> {
  const p = normalize(join(ROOT, decodeURIComponent(path)));
  if (!p.startsWith(ROOT)) return null;
  for (const c of [p, p.endsWith("/") ? join(p, "index.html") : `${p}.html`]) {
    try { if ((await stat(c)).isFile()) return c; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const body = await new Promise<string>((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
  const send = (status: number, data: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(data));
  };

  if (url.pathname === "/__test/state") return send(200, { forms, bookings, access });

  if (url.pathname === "/api/toolkit-access" && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email ?? "")) return send(400, { error: "Please enter a valid email." });
    if (!codeMatches(b.code ?? "", DEFAULT_CODE)) return send(401, { error: "That code doesn't match. It's on Liz's closing slide." });
    access.push({ email: b.email, source: b.source ?? "" });
    // Plain http in the test, so the Secure flag is dropped here only.
    return send(200, { ok: true }, { "Set-Cookie": cookieHeader(await createToken(SECRET)).replace("; Secure", "") });
  }

  if (url.pathname === "/api/bookings") {
    const active = bookings.filter((b) => b.status !== "cancelled");
    if (req.method === "GET") {
      return send(200, { rules: { ...BOOKING_RULES, ...bookableRange(BOOKING_RULES) }, taken: active.map(({ date, time }) => ({ date, time })) });
    }
    const b = JSON.parse(body || "{}");
    const err = slotError(BOOKING_RULES, b.date, b.time);
    if (err) return send(400, { error: err });
    if (active.some((x) => x.date === b.date && x.time === b.time)) return send(409, { error: "Someone just took that time. Please pick another." });
    bookings.push({ date: b.date, time: b.time, email: b.email, status: "requested" });
    forms.push({ "form-name": "booking", "session-date": b.date, "session-time": b.time, name: b.name, email: b.email });
    return send(201, { ok: true, notified: true });
  }

  if (url.pathname === "/" && req.method === "POST") {
    forms.push(Object.fromEntries(new URLSearchParams(body)));
    return send(200, { ok: true });
  }

  let path = url.pathname;
  if (path === "/toolkit" || path.startsWith("/toolkit/")) {
    if (!(await verifyToken(readCookie(req.headers.cookie ?? null), SECRET))) path = "/attendee/";
  }
  if (path === url.pathname) {
    const r = redirects.find((x) => x.from === url.pathname);
    if (r) { res.writeHead(r.status, { Location: r.to }); return res.end(); }
  }
  const f = await file(path);
  if (!f) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
  res.writeHead(200, { "Content-Type": TYPES[extname(f)] ?? "application/octet-stream", "Cache-Control": "no-store" });
  res.end(await readFile(f));
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));
