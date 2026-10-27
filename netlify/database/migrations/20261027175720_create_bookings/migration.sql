CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY,
	"session_date" text NOT NULL,
	"session_time" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"market" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_slot_idx" ON "bookings" ("session_date","session_time");