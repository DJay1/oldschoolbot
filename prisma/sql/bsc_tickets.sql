-- BSC ticket system (TEST DB first; apply on prod at ship with prisma db execute, never db push).
-- Read by the bot with raw SQL (src/lib/bsc/ticketService.ts). No rewards, items or GP live here.

CREATE TABLE IF NOT EXISTS bsc_tickets (
	id serial PRIMARY KEY,
	type text NOT NULL CHECK (type IN ('bug', 'suggestion')),
	source text NOT NULL DEFAULT 'player' CHECK (source IN ('player', 'staff', 'auto')),
	reporter_id text NULL,
	filed_by text NOT NULL,
	guild_id text NULL,
	origin_channel_id text NULL,
	what text NOT NULL CHECK (char_length(what) <= 1000),
	command text NULL CHECK (command IS NULL OR char_length(command) <= 200),
	screenshot text NULL CHECK (screenshot IS NULL OR char_length(screenshot) <= 300),
	status text NOT NULL DEFAULT 'open'
		CHECK (status IN ('open', 'confirmed', 'on_test', 'live', 'ignored', 'wont_fix')),
	staff_channel_id text NULL,
	staff_message_id text NULL,
	notice_message_id text NULL,
	handled_by text NULL,
	handled_by_tier text NULL,
	reason text NULL CHECK (reason IS NULL OR char_length(reason) <= 400),
	posting_at timestamptz NULL,
	post_attempts int NOT NULL DEFAULT 0,
	created_at timestamptz NOT NULL DEFAULT NOW(),
	updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bsc_tickets_status_idx ON bsc_tickets (status, id);
CREATE INDEX IF NOT EXISTS bsc_tickets_reporter_idx ON bsc_tickets (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bsc_tickets_unposted_idx ON bsc_tickets (id) WHERE staff_message_id IS NULL;
