import { Time } from '@oldschoolgg/toolkit';

/** How often the automatic leaderboard roles/badges refresh. Change to Time.Day * 14 for every 2 weeks. */
export const AUTO_ROLES_INTERVAL = Time.Day * 7;

/** How often the ticker wakes up to check whether the refresh is due. */
export const AUTO_ROLES_CHECK_INTERVAL = Time.Hour;

const TASK_NAME = 'bsc_auto_roles';

export type AutoRolesDecision = 'run' | 'skip' | 'seed';

/**
 * No stored run: record "now" and wait a full interval (roles were already refreshed by the old schedule).
 * Otherwise run only once a full interval has passed since the last stored run, so restarts never trigger it.
 */
export function autoRolesDecision(lastRun: number | null, now: number, interval = AUTO_ROLES_INTERVAL): AutoRolesDecision {
	if (lastRun === null || !Number.isFinite(lastRun)) return 'seed';
	return now - lastRun >= interval ? 'run' : 'skip';
}

const ready = { done: false };

async function ensureTaskRunsTable() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_task_runs (
			name text PRIMARY KEY,
			last_run_at timestamptz NOT NULL
		)
	`);
	ready.done = true;
}

async function fetchLastRun(): Promise<number | null> {
	await ensureTaskRunsTable();
	const rows = await prisma.$queryRaw<{ last_run_at: Date }[]>`
		SELECT last_run_at FROM bsc_task_runs WHERE name = ${TASK_NAME}
	`;
	return rows[0] ? rows[0].last_run_at.getTime() : null;
}

export async function recordAutoRolesRun(at = new Date()) {
	await ensureTaskRunsTable();
	await prisma.$executeRaw`
		INSERT INTO bsc_task_runs (name, last_run_at) VALUES (${TASK_NAME}, ${at})
		ON CONFLICT (name) DO UPDATE SET last_run_at = EXCLUDED.last_run_at
	`;
}

export async function autoRolesTick(run: () => Promise<unknown>) {
	const now = Date.now();
	const decision = autoRolesDecision(await fetchLastRun(), now);
	if (decision === 'skip') return decision;
	if (decision === 'seed') {
		await recordAutoRolesRun(new Date(now));
		return decision;
	}
	await run();
	await recordAutoRolesRun(new Date());
	return decision;
}