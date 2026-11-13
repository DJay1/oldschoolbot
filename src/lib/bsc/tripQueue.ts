import { ButtonBuilder, ButtonStyle, dateFm } from '@oldschoolgg/discord';
import { UserError } from '@oldschoolgg/toolkit';
import { DateTime } from 'luxon';

import {
	formatQueuedTripLabel,
	formatQueuedTripsForCooldownList,
	formatRecurringQueueLine
} from '@/lib/bsc/tripQueueDisplay.js';
import {
	applyQueueDailyReset,
	dailyQueueAllowance,
	maxQueuedTripsForPerkTier,
	queueResetAtMs,
	refundUnstartedTrips,
	startQueueWindowIfNeeded
} from '@/lib/bsc/tripQueueLimits.js';
import {
	appendQueuedTrips,
	claimRecurringRun,
	dequeueQueuedTrip,
	isValidQueueLocalTime,
	MAX_RECURRING_QUEUE_DAYS,
	nextQueueScheduleAt,
	parseQueuedTrips,
	parseRecurringDays,
	parseRecurringQueue,
	type QueuedTrip,
	type QueuedTripGroup,
	type RecurringQueue,
	recurringTripSummary
} from '@/lib/bsc/tripQueueState.js';
import { globalConfig, PerkTier } from '@/lib/constants.js';
import { fetchRepeatTrips, startRepeatTripFromActivity } from '@/lib/util/repeatStoredTrip.js';
import { QUEUED_TRIP_SHORTENED_MESSAGE } from '@/lib/util/tripLength.js';

interface TripQueueRow {
	user_id: string;
	trip: unknown;
	remaining: number;
	daily_used: number;
	daily_reset: bigint | number;
	reminders_enabled: boolean;
	reminder_time: string | null;
	reminder_timezone: string | null;
	last_refill_reminder_reset: bigint | number;
	last_local_reminder_date: string | null;
	scheduled_start_at: bigint | number | null;
	scheduled_channel_id: string | null;
	recurring: unknown;
	updated_at?: Date;
}

export interface TripQueueState {
	userId: string;
	trips: QueuedTripGroup[];
	remaining: number;
	dailyUsed: number;
	dailyReset: number;
	remindersEnabled: boolean;
	reminderTime: string | null;
	reminderTimezone: string | null;
	lastRefillReminderReset: number;
	lastLocalReminderDate: string | null;
	scheduledStartAt: number | null;
	scheduledChannelId: string | null;
	recurring: RecurringQueue | null;
}

const ready = { done: false };

function emptyState(userId: string, now: number): TripQueueState {
	return {
		userId,
		trips: [],
		remaining: 0,
		dailyUsed: 0,
		dailyReset: 0,
		remindersEnabled: false,
		reminderTime: null,
		reminderTimezone: null,
		lastRefillReminderReset: 0,
		lastLocalReminderDate: null,
		scheduledStartAt: null,
		scheduledChannelId: null,
		recurring: null
	};
}

function fromRow(row: TripQueueRow, now: number): TripQueueState {
	const trips = parseQueuedTrips(row.trip, row.remaining);
	return applyQueueDailyReset(
		{
			userId: row.user_id,
			trips,
			remaining: trips.reduce((total, trip) => total + trip.count, 0),
			dailyUsed: row.daily_used,
			dailyReset: Number(row.daily_reset),
			remindersEnabled: row.reminders_enabled ?? false,
			reminderTime: row.reminder_time ?? null,
			reminderTimezone: row.reminder_timezone ?? null,
			lastRefillReminderReset: Number(row.last_refill_reminder_reset ?? 0),
			lastLocalReminderDate: row.last_local_reminder_date ?? null,
			scheduledStartAt: row.scheduled_start_at == null ? null : Number(row.scheduled_start_at),
			scheduledChannelId: row.scheduled_channel_id ?? null,
			recurring: parseRecurringQueue(row.recurring)
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
			reminders_enabled boolean NOT NULL DEFAULT false,
			reminder_time text,
			reminder_timezone text,
			last_refill_reminder_reset bigint NOT NULL DEFAULT 0,
			last_local_reminder_date text,
			scheduled_start_at bigint,
			scheduled_channel_id text,
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`);
	await prisma.$executeRawUnsafe(`
		ALTER TABLE bsc_trip_queue
			ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT false,
			ADD COLUMN IF NOT EXISTS reminder_time text,
			ADD COLUMN IF NOT EXISTS reminder_timezone text,
			ADD COLUMN IF NOT EXISTS last_refill_reminder_reset bigint NOT NULL DEFAULT 0,
			ADD COLUMN IF NOT EXISTS last_local_reminder_date text,
			ADD COLUMN IF NOT EXISTS scheduled_start_at bigint,
			ADD COLUMN IF NOT EXISTS scheduled_channel_id text,
			ADD COLUMN IF NOT EXISTS recurring jsonb
	`);
	ready.done = true;
}

async function saveState(state: TripQueueState): Promise<void> {
	await ensureTripQueueStore();
	const tripJson = state.trips.length > 0 ? JSON.stringify(state.trips) : null;
	await prisma.$executeRawUnsafe(
		`INSERT INTO bsc_trip_queue (
			user_id, trip, remaining, daily_used, daily_reset, reminders_enabled,
			reminder_time, reminder_timezone, last_refill_reminder_reset,
			last_local_reminder_date, scheduled_start_at, scheduled_channel_id,
			recurring, updated_at
		) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
			trip = EXCLUDED.trip,
			remaining = EXCLUDED.remaining,
			daily_used = EXCLUDED.daily_used,
			daily_reset = EXCLUDED.daily_reset,
			reminders_enabled = EXCLUDED.reminders_enabled,
			reminder_time = EXCLUDED.reminder_time,
			reminder_timezone = EXCLUDED.reminder_timezone,
			last_refill_reminder_reset = EXCLUDED.last_refill_reminder_reset,
			last_local_reminder_date = EXCLUDED.last_local_reminder_date,
			scheduled_start_at = EXCLUDED.scheduled_start_at,
			scheduled_channel_id = EXCLUDED.scheduled_channel_id,
			recurring = EXCLUDED.recurring,
			updated_at = NOW()`,
		state.userId,
		tripJson,
		state.remaining,
		state.dailyUsed,
		state.dailyReset,
		state.remindersEnabled,
		state.reminderTime,
		state.reminderTimezone,
		state.lastRefillReminderReset,
		state.lastLocalReminderDate,
		state.scheduledStartAt,
		state.scheduledChannelId,
		state.recurring ? JSON.stringify(state.recurring) : null
	);
}

export async function getTripQueueState(userId: string, now = Date.now()): Promise<TripQueueState> {
	await ensureTripQueueStore();
	const rows = await prisma.$queryRaw<TripQueueRow[]>`
		SELECT *
		FROM bsc_trip_queue
		WHERE user_id = ${userId}
		LIMIT 1
	`;
	const row = rows[0];
	if (!row) return emptyState(userId, now);
	const state = fromRow(row, now);
	if (
		state.dailyUsed !== row.daily_used ||
		state.dailyReset !== Number(row.daily_reset) ||
		state.remaining !== row.remaining
	) {
		await saveState(state);
	}
	return state;
}

export async function clearTripQueue(userId: string): Promise<{ cleared: boolean; refunded: number }> {
	const state = await getTripQueueState(userId);
	if (state.trips.length === 0 || state.remaining <= 0) {
		return { cleared: false, refunded: 0 };
	}
	const { refunded, state: cleared } = refundUnstartedTrips(state);
	cleared.trips = [];
	cleared.scheduledStartAt = null;
	cleared.scheduledChannelId = null;
	await saveState(cleared);
	return { cleared: true, refunded };
}

function prettyTrip(type: string, data?: unknown): string {
	return formatQueuedTripLabel(type, data);
}

async function refundAndClear(state: TripQueueState): Promise<number> {
	const { refunded, state: cleared } = refundUnstartedTrips(state);
	cleared.trips = [];
	cleared.scheduledStartAt = null;
	cleared.scheduledChannelId = null;
	await saveState(cleared);
	return refunded;
}

export async function setQueueReminders(
	user: MUser,
	enabled: boolean,
	time?: string,
	timezone?: string,
	clearTime = false
): Promise<string> {
	if (enabled && (await user.fetchPerkTier()) < PerkTier.Two) {
		return 'Queue reminders are available to all Patreon tiers.';
	}
	const state = await getTripQueueState(user.id);
	if (!enabled) {
		state.remindersEnabled = false;
		await saveState(state);
		return 'Queue reminders are off.';
	}
	if ((time && !timezone) || (!time && timezone)) {
		return 'Set both a reminder time and timezone, for example 22:00 and America/Chicago.';
	}
	if (clearTime && (time || timezone)) {
		return 'Choose either a new reminder time or clear the existing one, not both.';
	}
	if (time && timezone && !isValidQueueLocalTime(time, timezone)) {
		return 'Use a valid 24-hour time (HH:mm) and IANA timezone, for example 22:00 and America/Chicago.';
	}
	if (!state.remindersEnabled) state.lastRefillReminderReset = state.dailyReset;
	state.remindersEnabled = true;
	if (clearTime) {
		state.reminderTime = null;
		state.reminderTimezone = null;
		state.lastLocalReminderDate = null;
	}
	if (time && timezone) {
		state.reminderTime = time;
		state.reminderTimezone = timezone;
		state.lastLocalReminderDate = null;
	}
	await saveState(state);
	return state.reminderTime && state.reminderTimezone
		? `Queue reminders are on. You'll be reminded when your queue refills and at ${state.reminderTime} (${state.reminderTimezone}).`
		: 'Queue refill reminders are on. You can also set a local reminder time with /queue reminders time:HH:mm timezone:Area/Location.';
}

export async function disableQueueRemindersFromButton(user: MUser, customId: string): Promise<CommandResponse> {
	const [, ownerId] = customId.split(':');
	if (ownerId !== user.id) return { content: 'This reminder button is not for your account.', ephemeral: true };
	const state = await getTripQueueState(user.id);
	state.remindersEnabled = false;
	await saveState(state);
	return { content: 'Queue reminders are off.', ephemeral: true };
}

export async function scheduleQueuedTrips(
	user: MUser,
	time: string,
	timezone: string,
	channelId: string,
	options?: { trip?: string; times?: number; days?: number }
): Promise<string> {
	if ((await user.fetchPerkTier()) < PerkTier.Two) return 'Queue scheduling is available to all Patreon tiers.';
	const now = Date.now();
	const scheduledAt = nextQueueScheduleAt(time, timezone, now);
	if (scheduledAt === null) {
		return 'Use a valid 24-hour time (HH:mm) and IANA timezone, for example 22:00 and America/Chicago.';
	}

	const days = options?.days !== undefined ? parseRecurringDays(options.days) : undefined;
	if (options?.days !== undefined && days === null) {
		return `Recurring trips can repeat daily for 1 to ${MAX_RECURRING_QUEUE_DAYS} days.`;
	}
	if ((options?.trip && options.times === undefined) || (!options?.trip && options?.times !== undefined)) {
		return 'Set both a trip and how many times to queue it.';
	}

	if (days) {
		const state = await getTripQueueState(user.id, now);
		let snapshot = [...state.trips];
		if (options?.trip && options.times !== undefined) {
			const recent = await fetchRepeatTrips(user);
			const activity = recent.find(trip => trip.type === options.trip);
			if (!activity) {
				return "Couldn't find that recent trip. Finish a trip first, then pick it from the list.";
			}
			snapshot = appendQueuedTrips(snapshot, { activityId: activity.id, type: activity.type }, options.times);
		}
		if (snapshot.length === 0) {
			return 'Queue at least one trip before scheduling it, or pick a trip in this command.';
		}
		const trips = await Promise.all(
			snapshot.map(async trip => {
				const activity = await loadQueuedActivity(trip, user);
				return {
					activityId: trip.activityId,
					type: trip.type,
					count: trip.count,
					label: prettyTrip(trip.type, activity?.data)
				};
			})
		);
		// Keep the template on the recurring schedule only, so the first run is not queued twice.
		const replacedRecurring = state.recurring !== null;
		let refunded = 0;
		if (state.remaining > 0) {
			const cleared = refundUnstartedTrips(state);
			refunded = cleared.refunded;
			state.trips = [];
			state.remaining = cleared.state.remaining;
			state.dailyUsed = cleared.state.dailyUsed;
		}
		state.recurring = {
			trips,
			daysLeft: days,
			time,
			timezone,
			nextAt: scheduledAt,
			channelId,
			lastResult: null,
			lastClaimKey: null
		};
		state.scheduledStartAt = null;
		state.scheduledChannelId = null;
		await saveState(state);
		const extras: string[] = [];
		if (refunded > 0) {
			extras.push('Your current queue was refunded so those trips are not started twice.');
		}
		if (replacedRecurring) {
			extras.push('This replaces your previous recurring schedule.');
		}
		return `Scheduled ${recurringTripSummary(trips)} to start daily at <t:${Math.floor(scheduledAt / 1000)}:F> (${timezone}) for ${days} day${days === 1 ? '' : 's'}. Use /queue unschedule to cancel.${extras.length ? ` ${extras.join(' ')}` : ''}`;
	}

	const existing = await getTripQueueState(user.id, now);
	if (existing.recurring) {
		return 'You already have a recurring schedule. Use /queue unschedule first if you want a one-time start instead.';
	}

	if (options?.trip && options.times !== undefined) {
		const added = await addTripsToQueue(user, options.trip, options.times, channelId, { deferStart: true });
		if (!added.startsWith('Queued ') && !added.startsWith('Started your')) {
			return added;
		}
	}

	const state = await getTripQueueState(user.id, now);
	if (state.remaining <= 0 || state.trips.length === 0) {
		return 'Queue at least one trip before scheduling it, or pick a trip in this command.';
	}
	state.scheduledStartAt = scheduledAt;
	state.scheduledChannelId = channelId;
	await saveState(state);
	return `Your queued trips will start automatically at <t:${Math.floor(scheduledAt / 1000)}:F> (${timezone}). If you're on a trip then, they'll start when it finishes.`;
}

export async function unscheduleQueuedTrips(userId: string): Promise<string> {
	const state = await getTripQueueState(userId);
	const hadSchedule = state.scheduledStartAt !== null;
	const hadRecurring = state.recurring !== null;
	if (!hadSchedule && !hadRecurring) return 'Your queue has no scheduled or recurring start.';
	state.scheduledStartAt = null;
	state.scheduledChannelId = null;
	state.recurring = null;
	await saveState(state);
	if (hadRecurring && hadSchedule) {
		return 'The scheduled start and recurring trips were cancelled. Your queued trips are still saved.';
	}
	if (hadRecurring) {
		return 'The recurring scheduled trips were cancelled. Your queued trips are still saved.';
	}
	return 'The scheduled queue start was cancelled. Your queued trips are still saved.';
}

export async function addTripsToQueue(
	user: MUser,
	activityType: string,
	times: number,
	channelId: string,
	options?: { deferStart?: boolean; scheduleTime?: string; scheduleTimezone?: string }
): Promise<string> {
	if (!Number.isInteger(times) || times < 1) {
		return 'How many trips to queue must be a whole number of at least 1.';
	}

	const scheduleTime = options?.scheduleTime;
	const scheduleTimezone = options?.scheduleTimezone;
	let scheduledAt: number | null = null;
	if (scheduleTime || scheduleTimezone) {
		if (!scheduleTime || !scheduleTimezone) {
			return 'Set both a start time and timezone, for example 22:00 and America/Chicago.';
		}
		scheduledAt = nextQueueScheduleAt(scheduleTime, scheduleTimezone, Date.now());
		if (scheduledAt === null) {
			return 'Use a valid 24-hour time (HH:mm) and IANA timezone, for example 22:00 and America/Chicago.';
		}
	}
	const deferStart = Boolean(options?.deferStart || scheduledAt);

	const perkTier = await user.fetchPerkTier();
	const maxAtOnce = maxQueuedTripsForPerkTier(perkTier);
	const dailyCap = dailyQueueAllowance(perkTier);
	const now = Date.now();
	let state = await getTripQueueState(user.id, now);
	const previousReset = state.dailyReset;
	state = startQueueWindowIfNeeded(state, now);
	if (state.dailyReset !== previousReset) {
		state.lastRefillReminderReset = state.dailyReset;
	}

	if (scheduledAt !== null) {
		if (perkTier < PerkTier.Two) {
			return 'Queue scheduling is available to all Patreon tiers.';
		}
		if (state.recurring) {
			return 'You already have a recurring schedule. Use /queue unschedule first if you want a one-time start instead.';
		}
	}

	const resetAt = `<t:${Math.floor(queueResetAtMs(state.dailyReset) / 1000)}:R>`;
	const dailyLeft = dailyCap - state.dailyUsed;
	if (dailyLeft <= 0) {
		return `You've used all ${dailyCap} of your queued trips. They refill ${resetAt}.`;
	}
	if (times > dailyLeft) {
		return `You can queue ${dailyLeft} more trip${dailyLeft === 1 ? '' : 's'} right now (you get ${dailyCap} everyday, refilling ${resetAt}).`;
	}

	if (times > maxAtOnce) {
		return `You can queue up to ${maxAtOnce} trips at once.`;
	}

	const trips = await fetchRepeatTrips(user);
	const activity = trips.find(trip => trip.type === activityType);
	if (!activity) {
		return "Couldn't find that recent trip. Finish a trip first, then pick it from the list.";
	}

	const newRemaining = state.remaining + times;
	if (newRemaining > maxAtOnce) {
		const room = maxAtOnce - state.remaining;
		if (room <= 0) {
			return `Your queue is already full (${maxAtOnce} trips).`;
		}
		return `You can only add ${room} more trip${room === 1 ? '' : 's'} (max ${maxAtOnce} at once).`;
	}

	state.trips = appendQueuedTrips(state.trips, { activityId: activity.id, type: activity.type }, times);
	state.remaining = newRemaining;
	state.dailyUsed += times;
	if (scheduledAt !== null) {
		state.scheduledStartAt = scheduledAt;
		state.scheduledChannelId = channelId;
	}
	await saveState(state);

	const pretty = prettyTrip(activity.type, activity.data);
	const dailyLeftAfter = dailyCap - state.dailyUsed;
	const dailyNote = ` You have ${dailyLeftAfter} left until they refill ${resetAt}.`;
	const queuedLine = `Queued ${times} ${pretty} trip${times === 1 ? '' : 's'}. ${state.remaining} in the queue.${dailyNote}`;

	if (scheduledAt !== null && scheduleTimezone) {
		return `${queuedLine} They will start automatically at <t:${Math.floor(scheduledAt / 1000)}:F> (${scheduleTimezone}).`;
	}

	if (deferStart) {
		return queuedLine;
	}

	if (await user.minionIsBusy()) {
		return `Queued ${times} ${pretty} trip${times === 1 ? '' : 's'}. They will start automatically when your current trip finishes. ${state.remaining} in the queue.${dailyNote}`;
	}

	const startNote = await tryStartQueuedTrip(user, channelId);
	if (startNote) {
		return `${startNote}${dailyNote}`;
	}
	return queuedLine;
}

export async function describeTripQueue(user: MUser): Promise<string> {
	const perkTier = await user.fetchPerkTier();
	const maxAtOnce = maxQueuedTripsForPerkTier(perkTier);
	const dailyCap = dailyQueueAllowance(perkTier);
	const state = await getTripQueueState(user.id);

	const lines: string[] = [];
	if (state.trips.length > 0 && state.remaining > 0) {
		const queued = await Promise.all(
			state.trips.map(async trip => {
				const activity = await loadQueuedActivity(trip, user);
				const pretty = prettyTrip(trip.type, activity?.data);
				return `${trip.count} ${pretty} trip${trip.count === 1 ? '' : 's'}`;
			})
		);
		lines.push(
			`Queued: ${queued.join(', ')}. They start in order when your current trip finishes, or immediately if you are idle.`
		);
	} else {
		lines.push(
			'Your trip queue is empty. Finish a trip, then use /queue add and pick it from the list. If you are idle, the first queued trip starts right away; otherwise they start when your current trip finishes.'
		);
	}
	lines.push(`You can have up to ${maxAtOnce} trips queued at once.`);
	const resetAt = queueResetAtMs(state.dailyReset);
	const refillNote = resetAt > 0 ? ` (refills <t:${Math.floor(resetAt / 1000)}:R>)` : '';
	lines.push(
		`You get ${dailyCap} queued trips everyday and have used ${state.dailyUsed}${refillNote}. Clearing unused trips refunds those points.`
	);
	if (state.scheduledStartAt !== null) {
		lines.push(`Scheduled to start <t:${Math.floor(state.scheduledStartAt / 1000)}:F>.`);
	}
	if (state.recurring) {
		lines.push(
			`${formatRecurringQueueLine(state.recurring, { discordTimestamps: true })}. Use /queue unschedule to cancel.`
		);
	}
	if (state.remindersEnabled) {
		lines.push(
			state.reminderTime && state.reminderTimezone
				? `Queue reminders are on, including ${state.reminderTime} (${state.reminderTimezone}).`
				: 'Queue refill reminders are on.'
		);
	}
	return lines.join(' ');
}

export async function describeQueuedTripsForCooldown(user: MUser, now = Date.now()): Promise<string | null> {
	const perkTier = await user.fetchPerkTier();
	const allowanceMax = dailyQueueAllowance(perkTier);
	const state = await getTripQueueState(user.id, now);
	const allowanceLeft = Math.max(0, allowanceMax - state.dailyUsed);
	const resetAt = queueResetAtMs(state.dailyReset);
	const refillsAtFormatted = resetAt > 0 ? dateFm(new Date(resetAt)) : null;

	const withRecurring = (line: string | null) => {
		if (!state.recurring) return line;
		const recurringLine = formatRecurringQueueLine(state.recurring, {
			startsAtFormatted: dateFm(new Date(state.recurring.nextAt))
		});
		return line ? `${line}\n${recurringLine}` : recurringLine;
	};

	if (state.trips.length === 0 || state.remaining <= 0) {
		return withRecurring(
			formatQueuedTripsForCooldownList({
				trips: [],
				startsAtFormatted: null,
				allowanceLeft,
				allowanceMax,
				refillsAtFormatted
			})
		);
	}

	const current = await ActivityManager.getActivityOfUser(user.id);
	const startsAtFormatted = current && current.finishDate > now ? dateFm(new Date(current.finishDate)) : null;
	const trips = await Promise.all(
		state.trips.map(async trip => {
			const activity = await loadQueuedActivity(trip, user);
			return { label: prettyTrip(trip.type, activity?.data), remaining: trip.count };
		})
	);

	return withRecurring(
		formatQueuedTripsForCooldownList({
			trips,
			startsAtFormatted
		})
	);
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

async function loadQueuedActivity(trip: QueuedTrip, user: MUser) {
	const byId = await prisma.activity.findFirst({
		where: { id: trip.activityId, user_id: BigInt(user.id) }
	});
	if (byId) return byId;
	const recent = await fetchRepeatTrips(user);
	return recent.find(activity => activity.type === trip.type) ?? null;
}

interface QueueReminderRow {
	user_id: string;
	daily_used: number;
	daily_reset: bigint | number;
	reminder_time: string | null;
	reminder_timezone: string | null;
	last_refill_reminder_reset: bigint | number;
	last_local_reminder_date: string | null;
}

export async function processQueueReminders(now = Date.now()): Promise<void> {
	if (!globalConfig.isProduction) return;
	await ensureTripQueueStore();
	const rows = await prisma.$queryRaw<QueueReminderRow[]>`
		SELECT user_id, daily_used, daily_reset, reminder_time, reminder_timezone,
			last_refill_reminder_reset, last_local_reminder_date
		FROM bsc_trip_queue
		WHERE reminders_enabled = true
	`;
	for (const row of rows) {
		try {
			const user = await mUserFetch(row.user_id);
			const perkTier = await user.fetchPerkTier();
			if (perkTier < PerkTier.Two) continue;
			const state = await getTripQueueState(row.user_id, now);
			if (!state.remindersEnabled) continue;
			const dailyCap = dailyQueueAllowance(perkTier);
			let sentRefillReminder = false;
			const buttons = [
				new ButtonBuilder()
					.setLabel('Turn Off Reminders')
					.setStyle(ButtonStyle.Secondary)
					.setCustomId(`QUEUE_REMINDERS_OFF:${user.id}`)
			];

			const needsRefillReminder = state.dailyReset === 0 && state.lastRefillReminderReset > 0;
			if (needsRefillReminder) {
				await globalClient.sendDm(user.id, {
					content: `Your daily queue allowance has refreshed. You currently have ${Math.max(0, dailyCap - state.dailyUsed)} of ${dailyCap} queue trips available. Use /queue add to queue them.`,
					components: buttons
				});
				state.lastRefillReminderReset = 0;
				await saveState(state);
				sentRefillReminder = true;
			}

			if (!state.reminderTime || !state.reminderTimezone) continue;
			const localNow = DateTime.fromMillis(now, { zone: state.reminderTimezone });
			if (!localNow.isValid) continue;
			const localDate = localNow.toISODate();
			if (!localDate || state.lastLocalReminderDate === localDate) continue;
			const target = DateTime.fromFormat(`${localDate} ${state.reminderTime}`, 'yyyy-LL-dd HH:mm', {
				zone: state.reminderTimezone
			});
			const minutesSinceTarget = localNow.diff(target, 'minutes').minutes;
			if (!target.isValid || minutesSinceTarget < 0 || minutesSinceTarget >= 7) continue;
			if (sentRefillReminder) {
				state.lastLocalReminderDate = localDate;
				await saveState(state);
				continue;
			}

			const allowanceLeft = Math.max(0, dailyCap - state.dailyUsed);
			if (allowanceLeft <= 0) continue;
			await globalClient.sendDm(user.id, {
				content: `Queue reminder: you have ${allowanceLeft} of ${dailyCap} queue trips left today. Use /queue add to use the rest.`,
				components: buttons
			});
			state.lastLocalReminderDate = localDate;
			await saveState(state);
		} catch (err) {
			Logging.logError(err as Error);
		}
	}
}

export async function processScheduledQueueStarts(now = Date.now()): Promise<void> {
	if (!globalConfig.isProduction) return;
	await ensureTripQueueStore();
	const rows = await prisma.$queryRaw<{ user_id: string; scheduled_channel_id: string | null }[]>`
		SELECT user_id, scheduled_channel_id
		FROM bsc_trip_queue
		WHERE scheduled_start_at <= ${now}
			AND remaining > 0
	`;
	for (const row of rows) {
		try {
			const user = await mUserFetch(row.user_id);
			if ((await user.fetchPerkTier()) < PerkTier.Two) {
				const state = await getTripQueueState(user.id);
				state.scheduledStartAt = null;
				state.scheduledChannelId = null;
				await saveState(state);
				await globalClient.sendDm(
					user.id,
					'Your scheduled queue start was cancelled because patron access is no longer active. Your queued trips are still saved.'
				);
				continue;
			}
			if (await user.minionIsBusy()) continue;
			const message = await tryStartQueuedTrip(user, row.scheduled_channel_id ?? '');
			if (message) await globalClient.sendDm(user.id, message);
		} catch (err) {
			Logging.logError(err as Error);
		}
	}
	await processRecurringQueueStarts(now);
}

async function claimRecurringRunAtomically(
	userId: string,
	recurring: RecurringQueue,
	now: number
): Promise<RecurringQueue | null> {
	const claimed = claimRecurringRun(recurring, now);
	if (!claimed.ok) return null;
	const updated = await prisma.$executeRawUnsafe(
		`UPDATE bsc_trip_queue
			SET recurring = $1::jsonb, updated_at = NOW()
			WHERE user_id = $2
				AND recurring IS NOT NULL
				AND COALESCE(recurring->>'lastClaimKey', '') <> $3
				AND (recurring->>'nextAt')::bigint <= $4
				AND (recurring->>'daysLeft')::int > 0`,
		JSON.stringify(claimed.recurring),
		userId,
		claimed.runKey,
		now
	);
	if (Number(updated) !== 1) return null;
	return claimed.recurring;
}

async function enqueueRecurringTrips(user: MUser, recurring: RecurringQueue, now: number): Promise<string> {
	const perkTier = await user.fetchPerkTier();
	if (perkTier < PerkTier.Two) {
		return 'Skipped: patron access is no longer active';
	}

	let state = await getTripQueueState(user.id, now);
	const previousReset = state.dailyReset;
	state = startQueueWindowIfNeeded(state, now);
	if (state.dailyReset !== previousReset) {
		state.lastRefillReminderReset = state.dailyReset;
	}

	const maxAtOnce = maxQueuedTripsForPerkTier(perkTier);
	const dailyCap = dailyQueueAllowance(perkTier);
	const dailyLeft = dailyCap - state.dailyUsed;
	const room = maxAtOnce - state.remaining;
	if (dailyLeft <= 0) {
		return 'Skipped: no queued trips left today';
	}
	if (room <= 0) {
		return 'Skipped: the queue is already full';
	}

	let added = 0;
	let missing = false;
	for (const trip of recurring.trips) {
		const activity = await loadQueuedActivity(trip, user);
		if (!activity) {
			missing = true;
			continue;
		}
		const remainingCap = Math.min(dailyLeft - added, room - added, trip.count);
		if (remainingCap <= 0) break;
		state.trips = appendQueuedTrips(state.trips, { activityId: trip.activityId, type: trip.type }, remainingCap);
		state.remaining += remainingCap;
		state.dailyUsed += remainingCap;
		added += remainingCap;
	}

	if (added <= 0) {
		return missing ? 'Skipped: that trip could no longer be repeated' : 'Skipped: no queued trips left today';
	}

	await saveState(state);

	if (await user.minionIsBusy()) {
		const extra = missing ? ' Some trips could no longer be repeated.' : '';
		return `Queued ${added} trip${added === 1 ? '' : 's'} to start when the current trip finishes.${extra}`.trim();
	}

	const startNote = await tryStartQueuedTrip(user, recurring.channelId);
	if (startNote) {
		return startNote;
	}
	return `Queued ${added} trip${added === 1 ? '' : 's'}`;
}

async function processRecurringQueueStarts(now: number): Promise<void> {
	const rows = await prisma.$queryRaw<{ user_id: string; recurring: unknown }[]>`
		SELECT user_id, recurring
		FROM bsc_trip_queue
		WHERE recurring IS NOT NULL
			AND (recurring->>'daysLeft')::int > 0
			AND (recurring->>'nextAt')::bigint <= ${now}
	`;
	for (const row of rows) {
		try {
			const current = parseRecurringQueue(row.recurring);
			if (!current) continue;
			const claimed = await claimRecurringRunAtomically(row.user_id, current, now);
			if (!claimed) continue;

			const user = await mUserFetch(row.user_id);
			let lastResult: string;
			try {
				lastResult = await enqueueRecurringTrips(user, claimed, now);
			} catch (err) {
				Logging.logError(err as Error);
				lastResult = 'Skipped: the trip could not be started';
			}

			const latest = await getTripQueueState(row.user_id, now);
			if (latest.recurring && latest.recurring.lastClaimKey === claimed.lastClaimKey) {
				latest.recurring = { ...latest.recurring, lastResult };
				await saveState(latest);
			}
			await globalClient.sendDm(
				user.id,
				`Recurring queue: ${lastResult}. ${
					claimed.daysLeft > 0
						? `${claimed.daysLeft} run${claimed.daysLeft === 1 ? '' : 's'} left, next <t:${Math.floor(claimed.nextAt / 1000)}:F>.`
						: 'That was the last run.'
				}`
			);
		} catch (err) {
			Logging.logError(err as Error);
		}
	}
}

/**
 * Called from trip finish. Starts the next queued trip the same way Repeat does.
 * Never throws to the caller.
 */
export async function tryStartQueuedTrip(user: MUser, channelId: string): Promise<string | null> {
	try {
		const state = await getTripQueueState(user.id);
		const trip = state.trips[0];
		if (!trip || state.remaining <= 0) return null;
		if (state.scheduledStartAt !== null && state.scheduledStartAt > Date.now()) return null;

		if (await user.minionIsBusy()) {
			return null;
		}

		const activity = await loadQueuedActivity(trip, user);
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

		state.trips = dequeueQueuedTrip(state.trips);
		state.remaining = Math.max(0, state.remaining - 1);
		state.scheduledStartAt = null;
		state.scheduledChannelId = null;
		const remaining = state.remaining;
		await saveState(state);

		const pretty = prettyTrip(activity.type, activity.data);
		const shortened = result.trimmed ? ` ${QUEUED_TRIP_SHORTENED_MESSAGE}` : '';
		if (remaining <= 0) {
			return `Started your last queued ${pretty} trip.${shortened}`;
		}
		return `Started your next queued ${pretty} trip. ${remaining} left in the queue.${shortened}`;
	} catch (err) {
		let refunded = 0;
		try {
			const latest = await getTripQueueState(user.id);
			if (latest.trips.length > 0 && latest.remaining > 0) {
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
