-- BSC ticket channels (TEST DB first; apply on prod at ship with prisma db execute, never db push).
-- One private Discord channel per ticket. Idea from Krypt's Server Helper bot, rewritten for BSC.
-- Read by the bot with raw SQL (src/lib/bsc/ticketService.ts). No rewards, items or GP live here.
-- Safe to run more than once. Existing tickets keep working (they have no channel and stay in the staff channel).

ALTER TABLE bsc_tickets ADD COLUMN IF NOT EXISTS ticket_channel_id text NULL;
ALTER TABLE bsc_tickets ADD COLUMN IF NOT EXISTS claimed_by text NULL;
ALTER TABLE bsc_tickets ADD COLUMN IF NOT EXISTS added_user_ids text[] NOT NULL DEFAULT '{}';
ALTER TABLE bsc_tickets ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
ALTER TABLE bsc_tickets ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL;
ALTER TABLE bsc_tickets ADD COLUMN IF NOT EXISTS closed_by text NULL;
ALTER TABLE bsc_tickets ADD COLUMN IF NOT EXISTS channel_deleted_at timestamptz NULL;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bsc_tickets_visibility_check') THEN
		ALTER TABLE bsc_tickets ADD CONSTRAINT bsc_tickets_visibility_check CHECK (visibility IN ('private', 'public'));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bsc_tickets_added_users_cap') THEN
		ALTER TABLE bsc_tickets ADD CONSTRAINT bsc_tickets_added_users_cap CHECK (cardinality(added_user_ids) <= 10);
	END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bsc_tickets_ticket_channel_idx ON bsc_tickets (ticket_channel_id)
	WHERE ticket_channel_id IS NOT NULL;
