import { Time } from '@oldschoolgg/toolkit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { clearSeasonalEventOverride, setSeasonalEventOverride } from '@/lib/events/registry.js';
import {
	_setHarvestFeastForTests,
	feastOverlapFraction,
	HARVEST_FEAST_MAX_MINUTES,
	HARVEST_FEAST_MAX_TOTAL_MS,
	HARVEST_FEAST_MIN_MINUTES,
	HARVEST_FEAST_SUCCESS_ONE_IN,
	harvestFeastAnnouncement,
	harvestFeastFraction,
	harvestFeastIsFull,
	rollTurkeyOffer,
	runWithTripWindow
} from '@/lib/events/thanksgiving/feast.js';

const minRng = { randInt: (min: number) => min };
/** First call (the 1 in 3 roll) returns min = success, the rest return max. */
function successThen(value: 'min' | 'max') {
	let first = true;
	return {
		randInt: (min: number, max: number) => {
			if (first) {
				first = false;
				return min;
			}
			return value === 'min' ? min : max;
		}
	};
}
const NOW = 10 * Time.Hour;

describe('Straw Hat Harvest round 4: turkey feasts', () => {
	test('1 in 3 chance; a failed roll gives no feast', () => {
		expect(HARVEST_FEAST_SUCCESS_ONE_IN).toBe(3);
		expect(HARVEST_FEAST_MIN_MINUTES).toBe(10);
		expect(HARVEST_FEAST_MAX_MINUTES).toBe(30);
		const fail = { randInt: (_min: number, max: number) => max };
		expect(rollTurkeyOffer(fail, null, NOW)).toEqual({ outcome: 'none' });
		const active = { kind: 'xp' as const, startMs: NOW - Time.Minute, endMs: NOW + 5 * Time.Minute };
		expect(rollTurkeyOffer(fail, active, NOW)).toEqual({ outcome: 'none' });
	});

	test('exact odds: 1 of 3 roll values succeeds', () => {
		let wins = 0;
		for (let v = 1; v <= 3; v++) {
			let first = true;
			const rng = {
				randInt: (min: number) => {
					if (first) {
						first = false;
						return v;
					}
					return min;
				}
			};
			if (rollTurkeyOffer(rng, null, NOW).outcome !== 'none') wins++;
		}
		expect(wins).toBe(1);
	});

	test('a success during a feast adds time and keeps the kind and start', () => {
		const active = { kind: 'xp' as const, startMs: NOW - 20 * Time.Minute, endMs: NOW + 5 * Time.Minute };
		const r = rollTurkeyOffer(successThen('max'), active, NOW);
		if (r.outcome !== 'extended') throw new Error('expected extended');
		expect(r.feast.kind).toBe('xp');
		expect(r.feast.startMs).toBe(active.startMs);
		expect(r.feast.endMs).toBe(active.endMs + 30 * Time.Minute);
		expect(r.addedMs).toBe(30 * Time.Minute);
	});

	test('an expired feast is not extended; a new one starts', () => {
		const old = { kind: 'xp' as const, startMs: NOW - Time.Hour, endMs: NOW - Time.Minute };
		const r = rollTurkeyOffer(minRng, old, NOW);
		expect(r.outcome).toBe('new');
	});

	test('feast time is capped at 3 hours left', () => {
		const active = {
			kind: 'loot' as const,
			startMs: NOW - Time.Hour,
			endMs: NOW + 2 * Time.Hour + 50 * Time.Minute
		};
		const r = rollTurkeyOffer(successThen('max'), active, NOW);
		if (r.outcome !== 'extended') throw new Error('expected extended');
		expect(r.feast.endMs - NOW).toBe(HARVEST_FEAST_MAX_TOTAL_MS);
		expect(r.addedMs).toBe(10 * Time.Minute);
		expect(harvestFeastIsFull(r.feast, NOW)).toBe(true);
		expect(harvestFeastIsFull(active, NOW)).toBe(false);
		expect(harvestFeastIsFull(null, NOW)).toBe(false);
	});

	test('announcement text: new feast and added time, no minion wording', () => {
		const n = rollTurkeyOffer(successThen('min'), null, NOW);
		expect(harvestFeastAnnouncement('.krypt.1', n)).toBe(
			'🦃 .krypt.1 offered a Harvest turkey and started a 2x loot Harvest feast (10 min)!'
		);
		const active = { kind: 'xp' as const, startMs: NOW - Time.Minute, endMs: NOW + Time.Minute };
		const x = rollTurkeyOffer(successThen('max'), active, NOW);
		expect(harvestFeastAnnouncement('.krypt.1', x)).toBe(
			'🦃 .krypt.1 offered a Harvest turkey and added 30 min to their 2x XP feast!'
		);
		expect(harvestFeastAnnouncement('.krypt.1', { outcome: 'none' })).toBeNull();
	});
});

describe('Straw Hat Harvest round 4: feast overlap uses the trip window', () => {
	// The event is test-bot only and off in unit tests; turn it on just for these tests.
	let savedProduction: string | undefined;
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
		savedProduction = process.env.PRODUCTION;
		process.env.PRODUCTION = 'false';
		setSeasonalEventOverride('thanksgiving', { enabled: true, start: null, end: null });
	});
	afterEach(() => {
		_setHarvestFeastForTests('u1', null);
		clearSeasonalEventOverride('thanksgiving');
		if (savedProduction === undefined) delete process.env.PRODUCTION;
		else process.env.PRODUCTION = savedProduction;
		vi.useRealTimers();
	});

	test('instant test-bot trip: finishDate is in the future, the feast at trip start counts', () => {
		// Feast started 1 minute ago, 39 minutes long. Trip started now, 49 minutes, finishes instantly.
		const feast = { kind: 'xp' as const, startMs: NOW - Time.Minute, endMs: NOW + 38 * Time.Minute };
		const duration = 49 * Time.Minute;
		const finishDate = NOW + duration;
		// Old wall-clock behaviour would treat the trip as [now - 49m, now]: only 1 of 49 minutes.
		expect(feastOverlapFraction(feast, NOW, duration)).toBeCloseTo(1 / 49);
		expect(feastOverlapFraction(feast, finishDate, duration)).toBeCloseTo(38 / 49);
	});

	test('real-time trip: finishDate is about now, same result as before', () => {
		const feast = { kind: 'loot' as const, startMs: NOW - 30 * Time.Minute, endMs: NOW + 10 * Time.Minute };
		const duration = 60 * Time.Minute;
		expect(feastOverlapFraction(feast, NOW, duration)).toBeCloseTo(30 / 60);
	});

	test('harvestFeastFraction uses the passed finishDate, then the trip window, then now', () => {
		const feast = { kind: 'xp' as const, startMs: NOW, endMs: NOW + 20 * Time.Minute };
		_setHarvestFeastForTests('u1', feast);
		const duration = 40 * Time.Minute;
		const fraction = (finish?: number) => harvestFeastFraction('u1', 'xp', duration, finish, NOW);
		expect(fraction(NOW + duration)).toBeCloseTo(0.5);
		expect(fraction()).toBe(0);
		expect(runWithTripWindow(NOW + duration, () => fraction())).toBeCloseTo(0.5);
		expect(harvestFeastFraction('u1', 'loot', duration, NOW + duration, NOW)).toBe(0);
	});

	test('the trip window is async-local: concurrent trips do not see each other', async () => {
		const seen: (number | undefined)[] = [];
		const feast = { kind: 'xp' as const, startMs: NOW, endMs: NOW + 20 * Time.Minute };
		_setHarvestFeastForTests('u1', feast);
		const a = runWithTripWindow(NOW + 40 * Time.Minute, async () => {
			await Promise.resolve();
			seen.push(harvestFeastFraction('u1', 'xp', 40 * Time.Minute, undefined, NOW));
		});
		const b = runWithTripWindow(NOW, async () => {
			await Promise.resolve();
			seen.push(harvestFeastFraction('u1', 'xp', 40 * Time.Minute, undefined, NOW));
		});
		await Promise.all([a, b]);
		expect(seen).toHaveLength(2);
		expect(seen[0]).toBeCloseTo(0.5);
		expect(seen[1]).toBe(0);
	});
});
