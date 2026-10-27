CREATE TABLE "toolkit_access" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "bookings_slot_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_slot_idx" ON "bookings" ("session_date","session_time") WHERE "status" <> 'cancelled';