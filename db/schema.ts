import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// One row per requested 1:1 session. The unique index stops two people taking the same slot.
export const bookings = pgTable(
  "bookings",
  {
    id: serial().primaryKey(),
    sessionDate: text("session_date").notNull(), // YYYY-MM-DD
    sessionTime: text("session_time").notNull(), // e.g. "1:30 PM"
    name: text().notNull(),
    email: text().notNull(),
    market: text().notNull().default(""),
    status: text().notNull().default("requested"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("bookings_slot_idx").on(t.sessionDate, t.sessionTime)],
);
