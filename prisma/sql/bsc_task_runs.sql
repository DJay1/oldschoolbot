-- BSC automatic roles schedule. Idempotent. Apply with prisma db execute (never prisma db push).
-- Stores when the weekly automatic roles refresh last ran so bot restarts don't re-run it.
-- The bot also creates this table on first use (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS bsc_task_runs (
	name text PRIMARY KEY,
	last_run_at timestamptz NOT NULL
);