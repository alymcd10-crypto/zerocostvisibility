import { sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// One row per requested 1:1 session. The unique index stops two people taking the same slot,
// but only counts active bookings: setting status to 'cancelled' frees the time again.
export const bookings = pgTable(
  "bookings",
  {
    id: serial().primaryKey(),
    sessionDate: text("session_date").notNull(), // YYYY-MM-DD
    sessionTime: text("session_time").notNull(), // e.g. "1:30 PM"
    name: text().notNull(),
    email: text().notNull(),
    market: text().notNull().default(""),
    status: text().notNull().default("requested"), // requested | confirmed | cancelled
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    uniqueIndex("bookings_slot_idx")
      .on(t.sessionDate, t.sessionTime)
      .where(sql`${t.status} <> 'cancelled'`),
  ],
);

// One row per successful attendee-code unlock: Liz's list of people who opened the toolkit.
export const toolkitAccess = pgTable("toolkit_access", {
  id: serial().primaryKey(),
  email: text().notNull(),
  source: text().notNull().default(""), // utm_content from the QR code, e.g. "slide14"
  createdAt: timestamp("created_at").defaultNow(),
});
