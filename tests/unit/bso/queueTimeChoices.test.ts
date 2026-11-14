import { describe, expect, test } from 'vitest';

import {
	QUEUE_TIME_CHOICES,
	QUEUE_TIMEZONE_CHOICES,
	queueTimeLabel,
	queueTimeOptionChoices,
	queueTimezoneLabel,
	queueTimezoneOptionChoices
} from '@/lib/bsc/queueTimeChoices.js';
import { isValidQueueLocalTime, nextQueueScheduleAt, parseRecurringQueue } from '@/lib/bsc/tripQueueState.js';

describe('queue time and timezone dropdowns', () => {
	test('fit in a Discord choice list and every pair is accepted by the scheduler', () => {
		expect(QUEUE_TIME_CHOICES).toHaveLength(24);
		expect(queueTimeOptionChoices.length).toBeLessThanOrEqual(25);
		expect(queueTimezoneOptionChoices.length).toBeLessThanOrEqual(25);
		expect(QUEUE_TIME_CHOICES[0]).toEqual({ name: '12 AM (midnight)', value: '00:00' });
		expect(QUEUE_TIME_CHOICES[13]).toEqual({ name: '1 PM', value: '13:00' });
		expect(QUEUE_TIME_CHOICES[23]).toEqual({ name: '11 PM', value: '23:00' });
		for (const time of QUEUE_TIME_CHOICES) {
			for (const zone of QUEUE_TIMEZONE_CHOICES) {
				expect(isValidQueueLocalTime(time.value, zone.value), `${time.value} ${zone.value}`).toBe(true);
			}
		}
		for (const choice of [...queueTimeOptionChoices, ...queueTimezoneOptionChoices]) {
			expect(choice.name.length).toBeLessThanOrEqual(100);
		}
	});

	test('converts a picked time and timezone to the right instant, with daylight saving', () => {
		// Sat Nov 14 2026, 7 AM CST.
		const now = Date.parse('2026-11-14T13:00:00.000Z');
		expect(nextQueueScheduleAt('22:00', 'America/Chicago', now)).toBe(Date.parse('2026-11-15T04:00:00.000Z'));
		expect(nextQueueScheduleAt('22:00', 'America/Los_Angeles', now)).toBe(Date.parse('2026-11-15T06:00:00.000Z'));
		expect(nextQueueScheduleAt('22:00', 'America/New_York', now)).toBe(Date.parse('2026-11-15T03:00:00.000Z'));
		expect(nextQueueScheduleAt('22:00', 'UTC', now)).toBe(Date.parse('2026-11-14T22:00:00.000Z'));
		expect(nextQueueScheduleAt('22:00', 'Europe/London', now)).toBe(Date.parse('2026-11-14T22:00:00.000Z'));
		expect(nextQueueScheduleAt('08:00', 'Australia/Sydney', now)).toBe(Date.parse('2026-11-14T21:00:00.000Z'));
		expect(nextQueueScheduleAt('22:00', 'Pacific/Honolulu', now)).toBe(Date.parse('2026-11-15T08:00:00.000Z'));
		// Summer: CDT and PDT are one hour closer to UTC; Arizona stays the same.
		const summer = Date.parse('2027-07-01T12:00:00.000Z');
		expect(nextQueueScheduleAt('22:00', 'America/Chicago', summer)).toBe(Date.parse('2027-07-02T03:00:00.000Z'));
		expect(nextQueueScheduleAt('22:00', 'America/Los_Angeles', summer)).toBe(
			Date.parse('2027-07-02T05:00:00.000Z')
		);
		expect(nextQueueScheduleAt('22:00', 'America/Phoenix', summer)).toBe(Date.parse('2027-07-02T05:00:00.000Z'));
	});

	test('labels and older saved schedules', () => {
		expect(queueTimezoneLabel('America/Chicago')).toBe('CT');
		expect(queueTimezoneLabel('Asia/Tokyo')).toBe('Asia/Tokyo');
		expect(queueTimeLabel('22:00')).toBe('10 PM');
		expect(queueTimeLabel('00:00')).toBe('12 AM');
		expect(queueTimeLabel('22:30')).toBe('22:30');
		// Schedules saved with a free-text time and zone before the dropdowns still load.
		const legacy = parseRecurringQueue({
			trips: [{ activityId: 1, type: 'Woodcutting', count: 2 }],
			daysLeft: 3,
			time: '22:30',
			timezone: 'Asia/Tokyo',
			nextAt: Date.parse('2026-11-15T13:30:00.000Z'),
			channelId: '1',
			lastResult: null,
			lastClaimKey: null
		});
		expect(legacy?.time).toBe('22:30');
		expect(legacy?.timezone).toBe('Asia/Tokyo');
	});
});
