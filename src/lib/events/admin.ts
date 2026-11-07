import {
	formatSeasonalEventList,
	getSeasonalEventOverride,
	isSeasonalEventId,
	resolveSeasonalEvent,
	seasonalEventName
} from './registry.js';
import { deleteSeasonalEventOverride, saveSeasonalEventOverride } from './store.js';
import { type SeasonalEventId, seasonalEventIds } from './types.js';

export interface SeasonalEventAdminInput {
	action: string;
	name?: string | null;
	start?: string | null;
	end?: string | null;
}

function parseInstant(value: string, label: string): number | { error: string } {
	const parsed = Date.parse(value);
	if (Number.isNaN(parsed)) {
		return { error: `${label} must be a date such as 2026-12-01 or 2026-12-01T00:00:00Z.` };
	}
	return parsed;
}

function readSchedule(
	start: string | null | undefined,
	end: string | null | undefined
): { start: number | null; end: number | null } | { error: string } {
	let startMs: number | null = null;
	let endMs: number | null = null;
	if (start) {
		const parsed = parseInstant(start, 'Start');
		if (typeof parsed !== 'number') return parsed;
		startMs = parsed;
	}
	if (end) {
		const parsed = parseInstant(end, 'End');
		if (typeof parsed !== 'number') return parsed;
		endMs = parsed;
	}
	if (startMs !== null && endMs !== null && endMs <= startMs) {
		return { error: 'The end must be after the start.' };
	}
	return { start: startMs, end: endMs };
}

export async function handleSeasonalEventAdmin(input: SeasonalEventAdminInput): Promise<string> {
	const action = input.action;
	if (action === 'list') {
		if (input.name && !isSeasonalEventId(input.name)) {
			return `Unknown event \`${input.name}\`. Events: ${seasonalEventIds.join(', ')}.`;
		}
		if (input.name && isSeasonalEventId(input.name)) {
			const full = formatSeasonalEventList();
			const line = full.split('\n').find(entry => entry.includes(`(\`${input.name}\`)`));
			return line ?? full;
		}
		return formatSeasonalEventList();
	}

	if (!input.name || !isSeasonalEventId(input.name)) {
		return `Pick an event: ${seasonalEventIds.join(', ')}.`;
	}
	const id: SeasonalEventId = input.name;

	if (action === 'reset') {
		await deleteSeasonalEventOverride(id);
		return `${seasonalEventName(id)} is back to the code default (on hold, no schedule).`;
	}

	if (action === 'disable') {
		const current = getSeasonalEventOverride(id);
		await saveSeasonalEventOverride(id, {
			enabled: false,
			start: current?.start ?? null,
			end: current?.end ?? null
		});
		return `${seasonalEventName(id)} is on hold. Any saved schedule was kept for the next enable.`;
	}

	if (action === 'enable') {
		const schedule = readSchedule(input.start, input.end);
		if ('error' in schedule) return schedule.error;
		const current = getSeasonalEventOverride(id);
		const start = input.start || input.end ? schedule.start : (current?.start ?? null);
		const end = input.start || input.end ? schedule.end : (current?.end ?? null);
		await saveSeasonalEventOverride(id, { enabled: true, start, end });
		return `${seasonalEventName(id)} is enabled. ${describeOne(id)}`;
	}

	if (action === 'schedule') {
		if (!input.start && !input.end) {
			return 'Provide a start, an end, or both. Example: start 2026-12-20 end 2026-12-31.';
		}
		const schedule = readSchedule(input.start, input.end);
		if ('error' in schedule) return schedule.error;
		await saveSeasonalEventOverride(id, {
			enabled: true,
			start: schedule.start,
			end: schedule.end
		});
		return `${seasonalEventName(id)} is scheduled and enabled. ${describeOne(id)}`;
	}

	return 'Action must be list, enable, disable, schedule, or reset.';
}

function describeOne(id: SeasonalEventId): string {
	const line = formatSeasonalEventList()
		.split('\n')
		.find(entry => entry.startsWith(`${resolveSeasonalEvent(id).name}`));
	return line ?? formatSeasonalEventList();
}
