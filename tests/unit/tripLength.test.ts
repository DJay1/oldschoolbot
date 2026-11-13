import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import {
	applyTripLengthMultiplier,
	finalizeTripLength,
	QUEUED_TRIP_MAX_DURATION_MS,
	QUEUED_TRIP_SHORTENED_MESSAGE,
	runInQueuedTripContext,
	scaleCommandQuantities,
	TRIP_LENGTH_MULTIPLIER_PATRON_CAP_MS,
	trimQueuedTripArgs,
	wasQueuedTripTrimmed
} from '@/lib/util/tripLength.js';

const topPatron = Time.Minute * 20;
const midPatron = Time.Minute * 10;
const baseWithTop = Time.Minute * 30 + topPatron;
const baseWithMid = Time.Minute * 30 + midPatron;

describe('applyTripLengthMultiplier', () => {
	test('top patron (+20) only multiplies the first 10 minutes of the bonus', () => {
		expect(applyTripLengthMultiplier(baseWithTop, 2, topPatron)).toBe(Time.Minute * 90);
		expect(applyTripLengthMultiplier(baseWithTop, 3, topPatron)).toBe(Time.Minute * 130);
		expect(applyTripLengthMultiplier(baseWithTop, 1.5, topPatron)).toBe(Time.Minute * 70);
	});

	test('+10 patron tiers are unchanged by the excess split', () => {
		expect(applyTripLengthMultiplier(baseWithMid, 2, midPatron)).toBe(Time.Minute * 80);
		expect(applyTripLengthMultiplier(baseWithMid, 3, midPatron)).toBe(Time.Minute * 120);
		expect(applyTripLengthMultiplier(baseWithMid, 1.5, midPatron)).toBe(Time.Minute * 60);
	});

	test('other boosts already in the length keep being multiplied', () => {
		const withBasket = baseWithTop + Time.Minute * 5;
		// (55 - 10) * 2 + 10 = 100
		expect(applyTripLengthMultiplier(withBasket, 2, topPatron)).toBe(Time.Minute * 100);
	});

	test('no patron bonus still uses a plain multiplier', () => {
		expect(applyTripLengthMultiplier(Time.Minute * 30, 2, 0)).toBe(Time.Minute * 60);
	});

	test('the patron cap is 10 minutes', () => {
		expect(TRIP_LENGTH_MULTIPLIER_PATRON_CAP_MS).toBe(Time.Minute * 10);
	});
});

describe('queued trip trim', () => {
	test('the queue cap is 1 hour', () => {
		expect(QUEUED_TRIP_MAX_DURATION_MS).toBe(Time.Hour);
		expect(QUEUED_TRIP_SHORTENED_MESSAGE).toBe('Queued trip shortened to 1 hour.');
	});

	test('trips already at or under 1 hour are left alone', () => {
		const args = { quantity: 100 };
		const result = trimQueuedTripArgs({ durationMs: Time.Minute * 50, args });
		expect(result).toEqual({ args, trimmed: false, singleUnitExceedsCap: false });
	});

	test('trips over 1 hour have quantity reduced so duration fits the cap', () => {
		const result = trimQueuedTripArgs({
			durationMs: Time.Minute * 90,
			args: { quantity: 900 },
			storedQuantity: 900
		});
		expect(result.trimmed).toBe(true);
		expect(result.singleUnitExceedsCap).toBe(false);
		expect(result.args).toEqual({ quantity: 600 });
	});

	test('nested command quantities are scaled too', () => {
		const result = trimQueuedTripArgs({
			durationMs: Time.Minute * 90,
			args: { alch: { quantity: 900, item: 'Nature rune' } }
		});
		expect(result.trimmed).toBe(true);
		expect(result.args).toEqual({ alch: { quantity: 600, item: 'Nature rune' } });
	});

	test('a single unit over 1 hour is left at quantity 1 and not force-capped', () => {
		const args = { quantity: 1 };
		const result = trimQueuedTripArgs({
			durationMs: Time.Minute * 70,
			args,
			storedQuantity: 1
		});
		expect(result).toEqual({ args, trimmed: false, singleUnitExceedsCap: true });
	});

	test('two long units are reduced to one and still flagged as over the cap', () => {
		const result = trimQueuedTripArgs({
			durationMs: Time.Minute * 140,
			args: { quantity: 2 },
			storedQuantity: 2
		});
		expect(result.trimmed).toBe(false);
		expect(result.singleUnitExceedsCap).toBe(true);
		expect(result.args).toEqual({ quantity: 1 });
	});

	test('scaleCommandQuantities never drops a quantity below 1', () => {
		expect(scaleCommandQuantities({ quantity: 2 }, 0.1)).toEqual({ quantity: 1 });
	});
});

/** Same order as determineWoodcuttingTime / determineMiningTime: multiply in ms, then finalize. */
function afterActivityMultiplier(lengthMs: number, multiplier: number, patronBonusMs: number): number {
	return finalizeTripLength(applyTripLengthMultiplier(lengthMs, multiplier, patronBonusMs));
}

async function queuedLength(fn: () => number): Promise<{ duration: number; trimmed: boolean }> {
	return runInQueuedTripContext(async () => {
		const duration = fn();
		return { duration, trimmed: wasQueuedTripTrimmed() };
	});
}

describe('queued trip cap after activity multipliers', () => {
	test('manual redwood stays at 90 minutes for top patrons', () => {
		expect(afterActivityMultiplier(baseWithTop, 2, topPatron)).toBe(Time.Minute * 90);
	});

	test('queued redwood at top patron is capped at 1 hour', async () => {
		const { duration, trimmed } = await queuedLength(() => afterActivityMultiplier(baseWithTop, 2, topPatron));
		expect(trimmed).toBe(true);
		expect(duration).toBe(Time.Hour);
	});

	test('queued redwood is still capped when calcMaxTripLength already returned 1 hour', async () => {
		const { duration, trimmed } = await queuedLength(() => afterActivityMultiplier(Time.Hour, 2, topPatron));
		expect(trimmed).toBe(true);
		expect(duration).toBe(Time.Hour);
	});

	test('queued Daeyalt essence is capped at 1 hour', async () => {
		const { duration, trimmed } = await queuedLength(() => afterActivityMultiplier(baseWithTop, 2, topPatron));
		expect(trimmed).toBe(true);
		expect(duration).toBe(Time.Hour);
	});

	test('queued cannonball and Wealthy Citizen lengths are capped at 1 hour', async () => {
		expect(applyTripLengthMultiplier(baseWithTop, 2, topPatron)).toBe(Time.Minute * 90);
		const { duration, trimmed } = await queuedLength(() =>
			finalizeTripLength(applyTripLengthMultiplier(baseWithTop, 2, topPatron))
		);
		expect(trimmed).toBe(true);
		expect(duration).toBe(Time.Hour);
	});

	test('the shortened message is only flagged when the final length was reduced', async () => {
		const under = await queuedLength(() => finalizeTripLength(Time.Minute * 50));
		expect(under).toEqual({ duration: Time.Minute * 50, trimmed: false });
		const over = await queuedLength(() => finalizeTripLength(Time.Minute * 90));
		expect(over).toEqual({ duration: Time.Hour, trimmed: true });
	});
});
