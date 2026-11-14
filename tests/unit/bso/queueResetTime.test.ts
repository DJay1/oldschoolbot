import { describe, expect, test } from 'vitest';

import {
	applyQueueDailyReset,
	defaultQueueResetState,
	parseQueueResetState,
	type QueueResetSchedule,
	type QueueResetState,
	queueRefillDisplayMs,
	queueResetAtMs,
	requestQueueResetChange,
	startQueueWindowIfNeeded
} from '@/lib/bsc/tripQueueLimits.js';

const at = (iso: string) => Date.parse(iso);
const HOUR = 60 * 60 * 1000;
const UK_9AM: QueueResetSchedule = { time: '09:00', timezone: 'Europe/London' };
const PT_1AM: QueueResetSchedule = { time: '01:00', timezone: 'America/Los_Angeles' };

function row(dailyUsed: number, dailyReset: number, reset: Partial<QueueResetState> = {}) {
	return { dailyUsed, dailyReset, reset: { ...defaultQueueResetState(), ...reset } };
}

describe('personal queue reset time', () => {
	test('defaults to 8 PM Central, including on the spring-forward day', () => {
		const started = startQueueWindowIfNeeded(row(0, 0), at('2026-11-14T13:00:00.000Z'));
		expect(started.reset.time).toBe('20:00');
		expect(started.reset.timezone).toBe('America/Chicago');
		expect(started.dailyReset).toBe(at('2026-11-14T02:00:00.000Z'));
		expect(started.reset.refillAt).toBe(at('2026-11-15T02:00:00.000Z'));

		const spring = startQueueWindowIfNeeded(row(0, 0), at('2027-03-14T12:00:00.000Z'));
		expect(spring.reset.refillAt).toBe(at('2027-03-15T01:00:00.000Z'));
		const fall = startQueueWindowIfNeeded(row(0, 0), at('2027-11-07T12:00:00.000Z'));
		expect(fall.reset.refillAt).toBe(at('2027-11-08T02:00:00.000Z'));
	});

	test('a change waits for the refill at the current time, and the next day is never short', () => {
		let r = row(2, at('2026-11-14T02:00:00.000Z'), {
			refillAt: at('2026-11-15T02:00:00.000Z'),
			lastRefillAt: at('2026-11-14T02:00:00.000Z')
		});
		const change = requestQueueResetChange(r, UK_9AM, at('2026-11-14T13:00:00.000Z'));
		expect(change.kind).toBe('pending');
		if (change.kind !== 'pending') return;
		expect(change.from).toBe(at('2026-11-15T02:00:00.000Z'));
		r = { ...r, reset: change.reset };
		expect(r.reset.time).toBe('20:00');

		// Still used up until the old refill.
		expect(applyQueueDailyReset(r, at('2026-11-15T01:59:59.999Z'))).toEqual(r);

		// At the old refill the usage clears once and the new time becomes active.
		const refilled = applyQueueDailyReset(r, at('2026-11-15T02:00:00.000Z'));
		expect(refilled.dailyUsed).toBe(0);
		expect(refilled.reset).toMatchObject({
			...UK_9AM,
			pending: null,
			lastRefillAt: at('2026-11-15T02:00:00.000Z')
		});

		// 9 AM London the next morning would be only 7 hours later, so the first day runs to the 9 AM after a full day.
		const started = startQueueWindowIfNeeded(refilled, at('2026-11-15T03:00:00.000Z'));
		expect(started.reset.refillAt).toBe(at('2026-11-16T09:00:00.000Z'));
		// After that it is a normal London 9 AM day.
		const next = startQueueWindowIfNeeded(
			applyQueueDailyReset({ ...started, dailyUsed: 2 }, at('2026-11-16T09:00:00.000Z')),
			at('2026-11-16T10:00:00.000Z')
		);
		expect(next.reset.refillAt).toBe(at('2026-11-17T09:00:00.000Z'));
	});

	test('picking your current time cancels a pending change; repeating it changes nothing', () => {
		const r = row(1, at('2026-11-14T02:00:00.000Z'), { refillAt: at('2026-11-15T02:00:00.000Z') });
		const now = at('2026-11-14T13:00:00.000Z');
		expect(requestQueueResetChange(r, { time: '20:00', timezone: 'America/Chicago' }, now).kind).toBe('unchanged');
		const pending = requestQueueResetChange(r, PT_1AM, now);
		const cancelled = requestQueueResetChange(
			{ ...r, reset: pending.reset },
			{ time: '20:00', timezone: 'America/Chicago' },
			now
		);
		expect(cancelled.kind).toBe('cancelled');
		expect(cancelled.reset.pending).toBeNull();
		// Switching again keeps the same effective refill.
		const again = requestQueueResetChange({ ...r, reset: pending.reset }, UK_9AM, now);
		expect(again.kind === 'pending' && again.from).toBe(at('2026-11-15T02:00:00.000Z'));
	});

	test('an idle player switches after the refill they would get now', () => {
		const now = at('2026-11-14T13:00:00.000Z');
		const change = requestQueueResetChange(row(0, 0), PT_1AM, now);
		expect(change.kind === 'pending' && change.from).toBe(at('2026-11-15T02:00:00.000Z'));
		expect(queueRefillDisplayMs(0, now, change.reset)).toBe(at('2026-11-15T02:00:00.000Z'));
		const active = applyQueueDailyReset(
			{ dailyUsed: 0, dailyReset: 0, reset: change.reset },
			at('2026-11-15T02:00:00.000Z')
		);
		expect(active.reset).toMatchObject({ ...PT_1AM, pending: null });
		const started = startQueueWindowIfNeeded(active, at('2026-11-15T10:00:00.000Z'));
		expect(started.reset.refillAt).toBe(at('2026-11-16T09:00:00.000Z'));
	});

	test('rapid back-and-forth switching never refills sooner than a day, across DST', () => {
		const schedules: QueueResetSchedule[] = [
			{ time: '20:00', timezone: 'America/Chicago' },
			UK_9AM,
			PT_1AM,
			{ time: '06:00', timezone: 'Australia/Sydney' },
			{ time: '19:00', timezone: 'America/Chicago' },
			{ time: '02:00', timezone: 'America/New_York' },
			{ time: '00:00', timezone: 'UTC' }
		];
		const ranges: [string, string][] = [
			['2026-11-10T00:00:00.000Z', '2026-11-30T00:00:00.000Z'],
			['2027-03-05T00:00:00.000Z', '2027-04-10T00:00:00.000Z'],
			['2027-10-20T00:00:00.000Z', '2027-11-15T00:00:00.000Z']
		];
		const cap = 3;
		for (const [from, to] of ranges) {
			let seed = 12345;
			const rand = () => {
				seed = (seed * 1103515245 + 12345) % 2147483648;
				return seed / 2147483648;
			};
			let r = row(0, 0);
			const refills: number[] = [];
			let granted = 0;
			for (let now = at(from); now < at(to); now += 20 * 60 * 1000) {
				const before = r;
				r = applyQueueDailyReset(r, now);
				if (before.dailyReset > 0 && r.dailyReset === 0)
					refills.push(queueResetAtMs(before.dailyReset, before.reset));
				const roll = rand();
				if (roll < 0.3) {
					const pick = schedules[Math.floor(rand() * schedules.length)];
					r = { ...r, reset: requestQueueResetChange(r, pick, now).reset };
				} else if (roll < 0.6) {
					r = startQueueWindowIfNeeded(r, now);
					expect(now).toBeLessThan(queueResetAtMs(r.dailyReset, r.reset));
					if (r.dailyUsed < cap) {
						granted += cap - r.dailyUsed;
						r = { ...r, dailyUsed: cap };
					}
				}
			}
			expect(refills.length).toBeGreaterThan(8);
			for (let i = 1; i < refills.length; i++) {
				expect(refills[i] - refills[i - 1]).toBeGreaterThanOrEqual(23 * HOUR);
			}
			expect(granted).toBeLessThanOrEqual(cap * (refills.length + 1));
			const days = (at(to) - at(from)) / (24 * HOUR);
			expect(granted).toBeLessThanOrEqual(cap * (days + 1));
		}
	});

	test('stored reset settings load safely', () => {
		expect(parseQueueResetState(null)).toEqual(defaultQueueResetState());
		expect(parseQueueResetState('not json')).toEqual(defaultQueueResetState());
		expect(parseQueueResetState({ time: '25:00', timezone: 'Mars/Base' })).toEqual(defaultQueueResetState());
		const stored = {
			time: '09:00',
			timezone: 'Europe/London',
			pending: { time: '01:00', timezone: 'America/Los_Angeles', from: 1_800_000_000_000 },
			refillAt: 1_800_000_000_000,
			lastRefillAt: 1_799_900_000_000
		};
		expect(parseQueueResetState(JSON.stringify(stored))).toEqual(stored);
		expect(parseQueueResetState({ ...stored, pending: { time: '01:00', timezone: 'Nope' } }).pending).toBeNull();
	});
});
