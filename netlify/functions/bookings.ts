import type { Config } from "@netlify/functions";
import { and, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { bookings } from "../../db/schema.js";
import { BOOKING_RULES, bookableRange, slotError, todayIn } from "../lib/booking-rules.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

// Sends the request to the "booking" Netlify form so Liz gets the email notification.
// Done here, after the slot is saved, so a held time always produces an email.
async function notify(origin: string, fields: Record<string, string>): Promise<boolean> {
  try {
    const r = await fetch(new URL("/", origin), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ "form-name": "booking", ...fields }).toString(),
    });
    if (!r.ok) console.error("booking notification failed", r.status);
    return r.ok;
  } catch (err) {
    console.error("booking notification failed", err);
    return false;
  }
}

export default async (req: Request) => {
  const rules = BOOKING_RULES;

  // GET /api/bookings → the calendar rules and the taken slots in range. Never names or emails.
  if (req.method === "GET") {
    const { first, last } = bookableRange(rules);
    const rows = await db
      .select({ date: bookings.sessionDate, time: bookings.sessionTime })
      .from(bookings)
      .where(and(gte(bookings.sessionDate, first), lte(bookings.sessionDate, last), ne(bookings.status, "cancelled")));
    return json({ rules: { ...rules, first, last }, taken: rows });
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
    if (s("company-website")) return json({ ok: true, notified: true }, 201);

    const date = s("date");
    const time = s("time");
    const name = s("name").slice(0, 120);
    const email = s("email").slice(0, 200).toLowerCase();
    const market = s("market").slice(0, 200);
    if (!name || !EMAIL.test(email)) return json({ error: "Please fill in your name and a valid email." }, 400);
    const ruleError = slotError(rules, date, time);
    if (ruleError) return json({ error: ruleError }, 400);

    const [{ active }] = await db
      .select({ active: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(sql`lower(${bookings.email}) = ${email}`, gte(bookings.sessionDate, todayIn(rules.timezone)), ne(bookings.status, "cancelled")));
    if (active >= rules.maxActivePerEmail) {
      return json({ error: "You already have sessions requested. Liz will be in touch, or send a note below to change them." }, 429);
    }

    try {
      const [row] = await db
        .insert(bookings)
        .values({ sessionDate: date, sessionTime: time, name, email, market })
        .returning({ id: bookings.id });
      const notified = await notify(new URL(req.url).origin, {
        "session-date": longDate(date),
        "session-time": `${time} ${rules.timezoneLabel}`,
        name,
        email,
        market,
      });
      return json({ ok: true, id: row.id, notified }, 201);
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
  // Stops a script from filling the calendar: 20 requests a minute per visitor.
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
