import { clearSeasonalEventOverride, isSeasonalEventId, setSeasonalEventOverride } from './registry.js';
import type { SeasonalEventId, SeasonalEventOverride } from './types.js';

interface SeasonalEventRow {
	id: string;
	enabled: boolean;
	start_at: Date | null;
	end_at: Date | null;
}

const ready = { done: false };

export async function ensureSeasonalEventStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS seasonal_event_config (
			id text PRIMARY KEY,
			enabled boolean NOT NULL,
			start_at timestamptz NULL,
			end_at timestamptz NULL
		)
	`);
	ready.done = true;
}

export async function loadSeasonalEventOverrides() {
	await ensureSeasonalEventStore();
	const rows = await prisma.$queryRaw<SeasonalEventRow[]>`
		SELECT id, enabled, start_at, end_at FROM seasonal_event_config
	`;
	for (const row of rows) {
		if (!isSeasonalEventId(row.id)) continue;
		setSeasonalEventOverride(row.id, {
			enabled: row.enabled,
			start: row.start_at ? row.start_at.getTime() : null,
			end: row.end_at ? row.end_at.getTime() : null
		});
	}
}

async function persistSeasonalEventOverride(id: SeasonalEventId, override: SeasonalEventOverride) {
	await ensureSeasonalEventStore();
	const start = override.start === null ? null : new Date(override.start);
	const end = override.end === null ? null : new Date(override.end);
	await prisma.$executeRaw`
		INSERT INTO seasonal_event_config (id, enabled, start_at, end_at)
		VALUES (${id}, ${override.enabled}, ${start}, ${end})
		ON CONFLICT (id) DO UPDATE SET
			enabled = EXCLUDED.enabled,
			start_at = EXCLUDED.start_at,
			end_at = EXCLUDED.end_at
	`;
	setSeasonalEventOverride(id, override);
}

export async function saveSeasonalEventOverride(id: SeasonalEventId, override: SeasonalEventOverride) {
	await persistSeasonalEventOverride(id, override);
}

export async function deleteSeasonalEventOverride(id: SeasonalEventId) {
	await ensureSeasonalEventStore();
	await prisma.$executeRaw`DELETE FROM seasonal_event_config WHERE id = ${id}`;
	clearSeasonalEventOverride(id);
}
