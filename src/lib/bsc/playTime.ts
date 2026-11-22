import { formatDuration, Time } from '@oldschoolgg/toolkit';

export type PlayTimeStats = {
	trips: number;
	totalMs: number;
	firstStart: Date | null;
	firstType: string | null;
	activeDays: number;
};

/** Calendar days since the first trip, at least 1 so a same-day account is not divided by zero. */
export function calendarDaysSince(start: Date, now = Date.now()): number {
	return Math.max(1, Math.round((now - start.getTime()) / Time.Day));
}

export function formatPlayTime(stats: PlayTimeStats, now = Date.now()): string {
	if (!stats.firstStart || stats.trips < 1) return 'No trips recorded yet.';
	const daysSinceFirst = calendarDaysSince(stats.firstStart, now);
	const avgPerDay = stats.totalMs / daysSinceFirst;
	const avgPerActiveDay = stats.totalMs / Math.max(1, stats.activeDays);
	const firstType = stats.firstType ? `${stats.firstType} ` : '';
	const firstDay = stats.firstStart.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
	return [
		`**Total trip time:** ${formatDuration(stats.totalMs)}`,
		`**Trips:** ${stats.trips.toLocaleString()}`,
		`**Days active:** ${stats.activeDays.toLocaleString()}`,
		`**Avg per day:** ${formatDuration(avgPerDay)} (since first trip)`,
		`**Avg per active day:** ${formatDuration(avgPerActiveDay)}`,
		`**First trip:** ${firstType}${firstDay}`
	].join('\n');
}

type PlayTimeRow = {
	trips: bigint;
	total_ms: bigint;
	first_start: Date | null;
	first_type: string | null;
	active_days: bigint;
};

/** Completed trips only, including group trips the player was in. Active days use America/Chicago. */
export async function fetchPlayTimeStats(userId: string): Promise<PlayTimeStats> {
	const id = BigInt(userId);
	const rows = await prisma.$queryRaw<PlayTimeRow[]>`
		SELECT
			COUNT(*)::bigint AS trips,
			COALESCE(SUM(duration), 0)::bigint AS total_ms,
			MIN(start_date) AS first_start,
			(ARRAY_AGG(type ORDER BY start_date ASC, id ASC))[1]::text AS first_type,
			COUNT(DISTINCT timezone('America/Chicago', start_date::timestamptz)::date)::bigint AS active_days
		FROM activity
		WHERE completed = true
			AND (user_id = ${id} OR ${id} = ANY(all_user_ids))
	`;
	const row = rows[0];
	if (!row) {
		return { trips: 0, totalMs: 0, firstStart: null, firstType: null, activeDays: 0 };
	}
	return {
		trips: Number(row.trips),
		totalMs: Number(row.total_ms),
		firstStart: row.first_start,
		firstType: row.first_type,
		activeDays: Number(row.active_days)
	};
}
