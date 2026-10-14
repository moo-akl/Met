CREATE TABLE IF NOT EXISTS "venue_outreach_follow_ups" (
  "id" serial PRIMARY KEY NOT NULL,
  "venue_key" text NOT NULL,
  "next_action_note" text,
  "next_action_due_date" date,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "venue_outreach_follow_ups_venue_key_uniq"
  ON "venue_outreach_follow_ups" USING btree ("venue_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_outreach_follow_ups_due_date_idx"
  ON "venue_outreach_follow_ups" USING btree ("next_action_due_date");
