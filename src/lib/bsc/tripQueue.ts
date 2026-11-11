import { dateFm } from '@oldschoolgg/discord';
import { UserError } from '@oldschoolgg/toolkit';

import { formatQueuedTripLabel, formatQueuedTripsForCooldownList } from '@/lib/bsc/tripQueueDisplay.js';
import {
	applyQueueDailyReset,
	dailyQueueAllowance,
	maxQueuedTripsForPerkTier,
	queueResetAtMs,
	refundUnstartedTrips,
	utcDayStartMs
} from '@/lib/bsc/tripQueueLimits.js';
import { fetchRepeatTrips, startRepeatTripFromActivity } from '@/lib/util/repeatStoredTrip.js';

export interface QueuedTrip {
	activityId: number;
	type: string;
}

interface TripQueueRow {
	user_id: string;
	trip: QueuedTrip | string | null;
	remaining: number;
	daily_used: number;
	daily_reset: bigint | number;
	updated_at?: Date;
}

export interface TripQueueState {
	userId: string;
	trip: QueuedTrip | null;
	remaining: number;
	dailyUsed: number;
	dailyReset: number;
}

const ready = { done: false };

function parseTrip(value: TripQueueRow['trip']): QueuedTrip | null {
	if (!value) return null;
	const parsed = typeof value === 'string' ? (JSON.parse(value) as QueuedTrip) : value;
	if (typeof parsed.activityId !== 'number' || typeof parsed.type !== 'string') return null;
	return { activityId: parsed.activityId, type: parsed.type };
}

function emptyState(userId: string, now: number): TripQueueState {
	return {
		userId,
		trip: null,
		remaining: 0,
		dailyUsed: 0,
		dailyReset: utcDayStartMs(now)
	};
}

function fromRow(row: TripQueueRow, now: number): TripQueueState {
	return applyQueueDailyReset(
		{
			userId: row.user_id,
			trip: parseTrip(row.trip),
			remaining: row.remaining,
			dailyUsed: row.daily_used,
			dailyReset: Number(row.daily_reset)
		},
		now
	);
}

export async function ensureTripQueueStore() {
	if (ready.done) return;
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS bsc_trip_queue (
			user_id text PRIMARY KEY,
			trip jsonb,
			remaining int NOT NULL DEFAULT 0,
			daily_used int NOT NULL DEFAULT 0,
			daily_reset bigint NOT NULL DEFAULT 0,
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`);
	ready.done = true;
}

async function saveState(state: TripQueueState): Promise<void> {
	await ensureTripQueueStore();
	const tripJson = state.trip ? JSON.stringify(state.trip) : null;
	await prisma.$executeRawUnsafe(
		`INSERT INTO bsc_trip_queue (user_id, trip, remaining, daily_used, daily_reset, updated_at)
		 VALUES ($1, $2::jsonb, $3, $4, $5, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
			trip = EXCLUDED.trip,
			remaining = EXCLUDED.remaining,
			daily_used = EXCLUDED.daily_used,
			daily_reset = EXCLUDED.daily_reset,
			updated_at = NOW()`,
		state.userId,
		tripJson,
		state.remaining,
		state.dailyUsed,
		state.dailyReset
	);
}

export async function getTripQueueState(userId: string, now = Date.now()): Promise<TripQueueState> {
	await ensureTripQueueStore();
	const rows = await prisma.$queryRaw<TripQueueRow[]>`
		SELECT user_id, trip, remaining, daily_used, daily_reset
		FROM bsc_trip_queue
		WHERE user_id = ${userId}
		LIMIT 1
	`;
	const row = rows[0];
	if (!row) return emptyState(userId, now);
	const state = fromRow(row, now);
	if (state.dailyUsed !== row.daily_used || state.dailyReset !== Number(row.daily_reset)) {
		await saveState(state);
	}
	return state;
}

export async function clearTripQueue(userId: string): Promise<{ cleared: boolean; refunded: number }> {
	const state = await getTripQueueState(userId);
	if (!state.trip || state.remaining <= 0) {
		return { cleared: false, refunded: 0 };
	}
	const { refunded, state: cleared } = refundUnstartedTrips(state);
	cleared.trip = null;
	await saveState(cleared);
	return { cleared: true, refunded };
}

function prettyTrip(type: string, data?: unknown): string {
	return formatQueuedTripLabel(type, data);
}

async function refundAndClear(state: TripQueueState): Promise<number> {
	const { refunded, state: cleared } = refundUnstartedTrips(state);
	cleared.trip = null;
	await saveState(cleared);
	return refunded;
}

export async function addTripsToQueue(
	user: MUser,
	activityType: string,
	times: number,
	channelId: string
): Promise<string> {
	if (!Number.isInteger(times) || times < 1) {
		return 'How many trips to queue must be a whole number of at least 1.';
	}

	const perkTier = await user.fetchPerkTier();
	const maxAtOnce = maxQueuedTripsForPerkTier(perkTier);
	const dailyCap = dailyQueueAllowance(perkTier);
	const now = Date.now();
	const state = await getTripQueueState(user.id, now);

	const resetAt = `<t:${Math.floor(queueResetAtMs(now) / 1000)}:R>`;
	const dailyLeft = dailyCap - state.dailyUsed;
	if (dailyLeft <= 0) {
		return `You've used all ${dailyCap} of your queued trips. They refill ${resetAt}.`;
	}
	if (times > dailyLeft) {
		return `You can queue ${dailyLeft} more trip${dailyLeft === 1 ? '' : 's'} right now (you get ${dailyCap} every 2 days, refilling ${resetAt}).`;
	}

	if (times > maxAtOnce) {
		return `You can queue up to ${maxAtOnce} trips at once.`;
	}

	const trips = await fetchRepeatTrips(user);
	const activity = trips.find(trip => trip.type === activityType);
	if (!activity) {
		return "Couldn't find that recent trip. Finish a trip first, then pick it from the list.";
	}

	const sameType = state.trip?.type === activity.type && state.remaining > 0;
	const newRemaining = sameType ? state.remaining + times : times;
	if (newRemaining > maxAtOnce) {
		const room = maxAtOnce - (sameType ? state.remaining : 0);
		if (room <= 0) {
			return `Your queue is already full (${maxAtOnce} trips).`;
		}
		return `You can only add ${room} more trip${room === 1 ? '' : 's'} (max ${maxAtOnce} at once).`;
	}

	state.trip = { activityId: activity.id, type: activity.type };
	state.remaining = newRemaining;
	state.dailyUsed += times;
	await saveState(state);

	const pretty = prettyTrip(activity.type, activity.data);
	const dailyLeftAfter = dailyCap - state.dailyUsed;
	const dailyNote = ` You have ${dailyLeftAfter} left until they refill ${resetAt}.`;

	if (await user.minionIsBusy()) {
		return `Queued ${times} ${pretty} trip${times === 1 ? '' : 's'}. They will start automatically when your current trip finishes. ${state.remaining} in the queue.${dailyNote}`;
	}

	const startNote = await tryStartQueuedTrip(user, channelId);
	if (startNote) {
		return `${startNote}${dailyNote}`;
	}
	return `Queued ${times} ${pretty} trip${times === 1 ? '' : 's'}. ${state.remaining} in the queue.${dailyNote}`;
}

export async function describeTripQueue(user: MUser): Promise<string> {
	const perkTier = await user.fetchPerkTier();
	const maxAtOnce = maxQueuedTripsForPerkTier(perkTier);
	const dailyCap = dailyQueueAllowance(perkTier);
	const state = await getTripQueueState(user.id);

	const lines: string[] = [];
	if (state.trip && state.remaining > 0) {
		const activity = await loadQueuedActivity(state, user);
		const pretty = prettyTrip(state.trip.type, activity?.data);
		lines.push(
			`Queued: ${state.remaining} ${pretty} trip${state.remaining === 1 ? '' : 's'}. They start when your current trip finishes, or immediately if you are idle.`
		);
	} else {
		lines.push(
			'Your trip queue is empty. Finish a trip, then use /queue add and pick it from the list. If you are idle, the first queued trip starts right away; otherwise they start when your current trip finishes.'
		);
	}
	lines.push(`You can have up to ${maxAtOnce} trips queued at once.`);
	lines.push(
		`You get ${dailyCap} queued trips every 2 days and have used ${state.dailyUsed} (refills <t:${Math.floor(queueResetAtMs(Date.now()) / 1000)}:R>). Clearing unused trips refunds those points.`
	);
	return lines.join(' ');
}

export async function describeQueuedTripsForCooldown(user: MUser, now = Date.now()): Promise<string | null> {
	const state = await getTripQueueState(user.id, now);
	if (!state.trip || state.remaining <= 0) return null;

	const activity = await loadQueuedActivity(state, user);
	const current = await ActivityManager.getActivityOfUser(user.id);
	const startsAtFormatted = current && current.finishDate > now ? dateFm(new Date(current.finishDate)) : null;

	return formatQueuedTripsForCooldownList({
		trips: [{ label: prettyTrip(state.trip.type, activity?.data), remaining: state.remaining }],
		startsAtFormatted
	});
}

function makeSilentQueueInteraction(user: MUser, channelId: string): OSInteraction {
	const now = Date.now();
	const messageId = String(BigInt(now - 1_420_070_400_000) << 22n);
	return {
		user,
		userId: user.id,
		channelId,
		guildId: null,
		member: null,
		createdTimestamp: now,
		messageId,
		async defer() {},
		async deferReply() {},
		async reply() {},
		async editReply() {},
		async followUp() {},
		async confirmation() {},
		async makePaginatedMessage() {},
		async returnStringOrFile() {}
	} as unknown as OSInteraction;
}

async function loadQueuedActivity(state: TripQueueState, user: MUser) {
	if (!state.trip || state.remaining <= 0) return null;
	const byId = await prisma.activity.findFirst({
		where: { id: state.trip.activityId, user_id: BigInt(user.id) }
	});
	if (byId) return byId;
	const recent = await fetchRepeatTrips(user);
	return recent.find(trip => trip.type === state.trip?.type) ?? null;
}

/**
 * Called from trip finish. Starts the next queued trip the same way Repeat does.
 * Never throws to the caller.
 */
export async function tryStartQueuedTrip(user: MUser, channelId: string): Promise<string | null> {
	try {
		const state = await getTripQueueState(user.id);
		if (!state.trip || state.remaining <= 0) return null;

		if (await user.minionIsBusy()) {
			return null;
		}

		const activity = await loadQueuedActivity(state, user);
		if (!activity) {
			const refunded = await refundAndClear(state);
			return refunded > 0
				? `Your trip queue was cleared and ${refunded} unused queue point${refunded === 1 ? '' : 's'} were refunded because that trip could no longer be repeated.`
				: 'Your trip queue was cleared because that trip could no longer be repeated.';
		}

		const interaction = makeSilentQueueInteraction(user, channelId);
		const result = await startRepeatTripFromActivity(user, activity, interaction);
		if (!result.ok) {
			const refunded = await refundAndClear(state);
			const refundNote =
				refunded > 0 ? ` ${refunded} unused queue point${refunded === 1 ? '' : 's'} were refunded.` : '';
			return `Your trip queue was cleared: ${result.message}.${refundNote}`;
		}

		state.remaining -= 1;
		const remaining = state.remaining;
		if (state.remaining <= 0) {
			state.trip = null;
			state.remaining = 0;
		}
		await saveState(state);

		const pretty = prettyTrip(activity.type, activity.data);
		if (remaining <= 0) {
			return `Started your last queued ${pretty} trip.`;
		}
		return `Started your next queued ${pretty} trip. ${remaining} left in the queue.`;
	} catch (err) {
		let refunded = 0;
		try {
			const latest = await getTripQueueState(user.id);
			if (latest.trip && latest.remaining > 0) {
				refunded = await refundAndClear(latest);
			}
		} catch {}
		const refundNote =
			refunded > 0 ? ` ${refunded} unused queue point${refunded === 1 ? '' : 's'} were refunded.` : '';
		if (err instanceof UserError) {
			return `Your trip queue was cleared: ${err.message}.${refundNote}`;
		}
		Logging.logError(err as Error);
		return `Your trip queue was cleared because the next trip could not be started.${refundNote}`;
	}
}
