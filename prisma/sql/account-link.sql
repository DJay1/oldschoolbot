-- /patron link tables for prod and test.
-- Apply with prisma db execute. Do not run prisma db push.
CREATE TABLE IF NOT EXISTS bsc_account_link (
	main_id text PRIMARY KEY,
	iron_id text NOT NULL UNIQUE,
	linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bsc_account_link_cooldown (
	user_id text PRIMARY KEY,
	last_unlinked_at timestamptz NOT NULL
);
