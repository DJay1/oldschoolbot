-- BSC Patreon revamp. Idempotent. Apply with prisma db execute (never prisma db push).
-- Grants, loyalty months, titles, flair, favorite pet, points, and per-item dyes.

CREATE TABLE IF NOT EXISTS bsc_patron_account (
	user_id text PRIMARY KEY,
	points_balance int NOT NULL DEFAULT 0,
	months_total int NOT NULL DEFAULT 0,
	months_streak int NOT NULL DEFAULT 0,
	last_credited_month text NULL,
	title text NULL,
	flair text NULL,
	favorite_pet_id int NULL,
	updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bsc_patron_points_log (
	id bigserial PRIMARY KEY,
	user_id text NOT NULL,
	delta int NOT NULL,
	balance int NOT NULL,
	reason text NOT NULL,
	month_key text NULL,
	created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS bsc_patron_points_log_monthly_unique
	ON bsc_patron_points_log (user_id, month_key)
	WHERE month_key IS NOT NULL AND reason = 'monthly_grant';

CREATE INDEX IF NOT EXISTS bsc_patron_points_log_user_idx
	ON bsc_patron_points_log (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bsc_patron_item_dyes (
	user_id text NOT NULL,
	item_id int NOT NULL,
	dye_key text NOT NULL,
	mode text NOT NULL,
	applied_at timestamptz NOT NULL DEFAULT NOW(),
	PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS bsc_patron_item_dyes_user_idx
	ON bsc_patron_item_dyes (user_id);
