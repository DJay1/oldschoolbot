import { PerkTier, Time } from '@oldschoolgg/toolkit';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MAX_QUANTITY } from '@/lib/util/validateQuantity.js';
import { fishingTrawlerCommand } from '@/mahoji/lib/abstracted_commands/fishingTrawler.js';
import { pyramidPlunderCommand } from '@/mahoji/lib/abstracted_commands/pyramidPlunderCommand.js';

const DISCORD_CONTENT_LIMIT = 2000;
const CHANNEL_ID = '123';
const TWO_HOURS = Time.Hour * 2;

function makeTrawlerUser(overrides: Record<string, unknown> = {}) {
	return {
		id: '1',
		minionName: 'DJ',
		perkTier: 0,
		bitfield: [] as number[],
		skillLevel: vi.fn(() => 99),
		fetchMinigameScore: vi.fn(async () => 0),
		calcMaxTripLength: vi.fn(async () => TWO_HOURS),
		...overrides
	};
}

function makePlunderUser(overrides: Record<string, unknown> = {}) {
	return {
		id: '1',
		minionName: 'DJ',
		perkTier: 0,
		bitfield: [] as number[],
		minionIsBusy: vi.fn(async () => false),
		skillsAsLevels: { thieving: 99 },
		hasGracefulEquipped: vi.fn(() => true),
		hasEquippedOrInBank: vi.fn(() => false),
		fetchMinigameScore: vi.fn(async () => 0),
		calcMaxTripLength: vi.fn(async () => TWO_HOURS),
		...overrides
	};
}

describe('Fishing Trawler and Pyramid Plunder quantity', () => {
	let startTrip: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		startTrip = vi.spyOn(globalThis.ActivityManager, 'startTrip').mockResolvedValue(undefined as never);
	});

	afterEach(() => {
		startTrip.mockRestore();
	});

	function startedTrip() {
		expect(startTrip).toHaveBeenCalledTimes(1);
		return startTrip.mock.calls[0]![0] as { quantity: number; duration: number };
	}

	test('omitting quantity fills the max Fishing Trawler trip', async () => {
		const result = await fishingTrawlerCommand(makeTrawlerUser() as never, CHANNEL_ID);
		expect(typeof result).toBe('string');
		const trip = startedTrip();
		expect(trip.quantity).toBe(Math.floor(TWO_HOURS / (Time.Minute * 13)));
		expect(trip.duration).toBe(trip.quantity * Time.Minute * 13);
		expect(result).toContain(`${trip.quantity}x Fishing Trawler`);
	});

	test('an explicit Fishing Trawler quantity is used when it fits', async () => {
		const result = await fishingTrawlerCommand(makeTrawlerUser() as never, CHANNEL_ID, 3);
		const trip = startedTrip();
		expect(trip.quantity).toBe(3);
		expect(trip.duration).toBe(3 * Time.Minute * 13);
		expect(result).toContain('3x Fishing Trawler');
	});

	test('a Fishing Trawler quantity over the max trip is capped', async () => {
		await fishingTrawlerCommand(makeTrawlerUser() as never, CHANNEL_ID, 100_000);
		const trip = startedTrip();
		expect(trip.quantity).toBe(Math.floor(TWO_HOURS / (Time.Minute * 13)));
		expect(trip.duration).toBe(trip.quantity * Time.Minute * 13);
	});

	test('zero, negative and invalid Fishing Trawler quantities are refused', async () => {
		for (const quantity of [0, -1, 1.5, Number.NaN, MAX_QUANTITY + 1]) {
			startTrip.mockClear();
			const result = await fishingTrawlerCommand(makeTrawlerUser() as never, CHANNEL_ID, quantity);
			expect(startTrip).not.toHaveBeenCalled();
			expect(result).toMatch(/Quantity must be|Quantity cannot be more than/);
		}
	});

	test('Fishing Trawler duration and rewards stay in proportion', async () => {
		await fishingTrawlerCommand(makeTrawlerUser() as never, CHANNEL_ID, 1);
		const one = startedTrip();
		startTrip.mockClear();
		await fishingTrawlerCommand(makeTrawlerUser() as never, CHANNEL_ID, 4);
		const four = startedTrip();
		expect(four.quantity).toBe(4);
		expect(four.duration).toBe(one.duration * 4);
		expect(four.duration / four.quantity).toBe(one.duration / one.quantity);
	});

	test('omitting quantity fills the max Pyramid Plunder trip', async () => {
		const result = await pyramidPlunderCommand(makePlunderUser() as never, CHANNEL_ID);
		const trip = startedTrip();
		expect(trip.quantity).toBe(Math.floor(TWO_HOURS / (Time.Minute * 5.75)));
		expect(trip.duration).toBe(trip.quantity * Time.Minute * 5.75);
		expect(result).toContain(`Pyramid Plunder ${trip.quantity} times`);
	});

	test('an explicit Pyramid Plunder quantity is used when it fits', async () => {
		const result = await pyramidPlunderCommand(makePlunderUser() as never, CHANNEL_ID, 5);
		const trip = startedTrip();
		expect(trip.quantity).toBe(5);
		expect(trip.duration).toBe(5 * Time.Minute * 5.75);
		expect(result).toContain('Pyramid Plunder 5 times');
	});

	test('a Pyramid Plunder quantity over the max trip is capped', async () => {
		await pyramidPlunderCommand(makePlunderUser() as never, CHANNEL_ID, 100_000);
		const trip = startedTrip();
		expect(trip.quantity).toBe(Math.floor(TWO_HOURS / (Time.Minute * 5.75)));
		expect(trip.duration).toBe(trip.quantity * Time.Minute * 5.75);
	});

	test('zero, negative and invalid Pyramid Plunder quantities are refused', async () => {
		for (const quantity of [0, -1, 1.5, Number.NaN, MAX_QUANTITY + 1]) {
			startTrip.mockClear();
			const result = await pyramidPlunderCommand(makePlunderUser() as never, CHANNEL_ID, quantity);
			expect(startTrip).not.toHaveBeenCalled();
			expect(result).toMatch(/Quantity must be|Quantity cannot be more than/);
		}
	});

	test('Pyramid Plunder duration and rewards stay in proportion', async () => {
		await pyramidPlunderCommand(makePlunderUser() as never, CHANNEL_ID, 1);
		const one = startedTrip();
		startTrip.mockClear();
		await pyramidPlunderCommand(makePlunderUser() as never, CHANNEL_ID, 4);
		const four = startedTrip();
		expect(four.quantity).toBe(4);
		expect(four.duration).toBe(one.duration * 4);
		expect(four.duration / four.quantity).toBe(one.duration / one.quantity);
	});

	test('worst-case start messages stay at least 150 under the Discord limit', async () => {
		const longName = 'D'.repeat(32);
		const trawler = await fishingTrawlerCommand(
			makeTrawlerUser({
				minionName: longName,
				perkTier: PerkTier.Four,
				calcMaxTripLength: vi.fn(async () => Time.Hour * 24)
			}) as never,
			CHANNEL_ID,
			MAX_QUANTITY
		);
		const plunder = await pyramidPlunderCommand(
			makePlunderUser({
				minionName: longName,
				perkTier: PerkTier.Four,
				hasGracefulEquipped: vi.fn(() => false),
				hasEquippedOrInBank: vi.fn(() => true),
				fetchMinigameScore: vi.fn(async () => 100_000),
				calcMaxTripLength: vi.fn(async () => Time.Hour * 24)
			}) as never,
			CHANNEL_ID,
			MAX_QUANTITY
		);
		expect(typeof trawler).toBe('string');
		expect(typeof plunder).toBe('string');
		expect((trawler as string).length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - 150);
		expect((plunder as string).length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - 150);
	});
});
