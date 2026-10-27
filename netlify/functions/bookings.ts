import type { Config } from "@netlify/functions";
import { and, gte, lte, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings } from "../../db/schema.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export default async (req: Request) => {
  // GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD → taken slots only, never names or emails
  if (req.method === "GET") {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!DATE.test(from) || !DATE.test(to)) return json({ error: "from and to are required" }, 400);
    const rows = await db
      .select({ date: bookings.sessionDate, time: bookings.sessionTime })
      .from(bookings)
      .where(and(gte(bookings.sessionDate, from), lte(bookings.sessionDate, to), ne(bookings.status, "cancelled")));
    return json({ taken: rows });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request" }, 400);
    }
    const s = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
    // Honeypot: bots fill every field. Pretend it worked.
    if (s("company-website")) return json({ ok: true }, 201);

    const date = s("date");
    const time = s("time");
    const name = s("name").slice(0, 120);
    const email = s("email").slice(0, 200);
    const market = s("market").slice(0, 200);
    if (!DATE.test(date) || !TIME.test(time) || !name || !EMAIL.test(email)) {
      return json({ error: "Please fill in your name, a valid email, a day and a time." }, 400);
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date <= today) return json({ error: "That day has passed. Please pick another." }, 400);

    try {
      const [row] = await db
        .insert(bookings)
        .values({ sessionDate: date, sessionTime: time, name, email, market })
        .returning({ id: bookings.id });
      return json({ ok: true, id: row.id }, 201);
    } catch (err) {
      const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
      if (code === "23505") return json({ error: "Someone just took that time. Please pick another." }, 409);
      throw err;
    }
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: "/api/bookings",
};
