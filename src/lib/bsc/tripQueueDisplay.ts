import { type RecurringQueue, recurringTripSummary } from '@/lib/bsc/tripQueueState.js';
import { autocompleteMonsters } from '@/lib/minions/data/killableMonsters/index.js';

const MONSTER_ACTIVITY_TYPES = new Set(['MonsterKilling', 'GroupMonsterKilling']);

export function formatActivityTypeName(type: string): string {
	return type.replaceAll(/([a-z])([A-Z])/g, '$1 $2');
}

function asRecord(data: unknown): Record<string, unknown> | null {
	if (!data) return null;
	if (typeof data === 'string') {
		try {
			const parsed = JSON.parse(data) as unknown;
			return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
		} catch {
			return null;
		}
	}
	if (typeof data === 'object') return data as Record<string, unknown>;
	return null;
}

function monsterNameFromData(data: unknown): string | null {
	const record = asRecord(data);
	const raw = record?.mi;
	const monsterId = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
	if (!Number.isFinite(monsterId)) return null;
	return autocompleteMonsters.find(monster => monster.id === monsterId)?.name ?? null;
}

/** Human label for a queued/recent trip, e.g. 'General Graardor' instead of 'Monster Killing'. */
export function formatQueuedTripLabel(type: string, data?: unknown): string {
	if (MONSTER_ACTIVITY_TYPES.has(type)) {
		const monsterName = monsterNameFromData(data);
		if (monsterName) return monsterName;
	}
	return formatActivityTypeName(type);
}

export interface QueuedTripCooldownItem {
	label: string;
	remaining: number;
}

function formatEmptyQueueLine(options: {
	allowanceLeft?: number;
	allowanceMax?: number;
	refillsAtFormatted?: string | null;
}): string | null {
	if (options.allowanceLeft == null || options.allowanceMax == null) return null;
	const qty = `${Math.max(0, options.allowanceLeft)}/${options.allowanceMax} left`;
	if (options.refillsAtFormatted) {
		return `Queue: No trips queued (${qty}, refills ${options.refillsAtFormatted})`;
	}
	return `Queue: No trips queued (${qty})`;
}

/**
 * One cd-list section for the user's trip queue. Returns null only when the
 * queue is empty and no allowance info was provided, so the command can omit it.
 */
export function formatQueuedTripsForCooldownList(options: {
	trips: QueuedTripCooldownItem[];
	startsAtFormatted: string | null;
	allowanceLeft?: number;
	allowanceMax?: number;
	refillsAtFormatted?: string | null;
}): string | null {
	const trips = options.trips.filter(trip => trip.remaining > 0 && trip.label.length > 0);
	if (trips.length === 0) return formatEmptyQueueLine(options);

	const listed = trips
		.map(trip => `${trip.remaining} ${trip.label} trip${trip.remaining === 1 ? '' : 's'}`)
		.join(', ');
	if (options.startsAtFormatted) {
		return `Queue: ${listed}, starts ${options.startsAtFormatted}`;
	}
	return `Queue: ${listed}, Ready`;
}

/** One cd-list / queue-view line for a recurring scheduled queue. */
export function formatRecurringQueueLine(
	recurring: RecurringQueue,
	opts?: { discordTimestamps?: boolean; startsAtFormatted?: string | null }
): string {
	const trips = recurringTripSummary(recurring.trips);
	const runs =
		recurring.daysLeft <= 0
			? 'no runs left'
			: `${recurring.daysLeft} run${recurring.daysLeft === 1 ? '' : 's'} left`;
	let next: string;
	if (recurring.daysLeft <= 0) {
		next = 'done';
	} else if (opts?.discordTimestamps) {
		next = `next <t:${Math.floor(recurring.nextAt / 1000)}:F>`;
	} else if (opts?.startsAtFormatted) {
		next = `next ${opts.startsAtFormatted}`;
	} else {
		next = `next <t:${Math.floor(recurring.nextAt / 1000)}:R>`;
	}
	const last = recurring.lastResult ? `, last ${recurring.lastResult}` : '';
	return `Recurring: ${trips}, ${runs}, ${next}${last}`;
}
