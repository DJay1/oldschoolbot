-- Tester Gift Box revamp + developer points (TEST DB only).
-- Developer points are a separate balance from tester points so spending or
-- awarding them cannot change tester earned_total (and cannot unlock tester-only cosmetics).
-- Boxes opened are counted from user_stats.openable_scores on a real /open, not this schema.

CREATE TABLE IF NOT EXISTS bsc_developer_points (
	user_id text PRIMARY KEY,
	balance int NOT NULL DEFAULT 0,
	earned_total int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bsc_developer_points_log (
	id serial PRIMARY KEY,
	user_id text NOT NULL,
	amount int NOT NULL,
	reason text NOT NULL,
	given_by text NULL,
	created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bsc_developer_points_log_user_idx
	ON bsc_developer_points_log (user_id, created_at DESC);
