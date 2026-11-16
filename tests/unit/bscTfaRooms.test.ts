import '../../src/lib/util/clientSettings.js';
import { Items } from 'oldschooljs';
import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import { createTfaRaids, tfaBossByID, type TfaTeamMember } from '@/lib/bsc/tfa/tfa.js';
import {
	TFA_ROOM_BOOST_CAP,
	TFA_ROOM_ITEMS,
	tfaRoomBoostsFor,
	tfaRoomItemsHelpLines,
	tfaRoomPercent,
	tfaTeamRoomPercent
} from '@/lib/bsc/tfa/tfaRooms.js';
import { constructGearSetup, Gear } from '@/lib/structures/Gear.js';

class ForcedRNG extends SeedableRNG {
	constructor(private pickFirst: boolean) {
		super(7);
	}
	override roll(_max: number): boolean {
		return this.pickFirst;
	}
	override percentChance(_p: number): boolean {
		return false;
	}
}

const member = (roomBoosts?: TfaTeamMember['roomBoosts']): TfaTeamMember => ({
	id: '1',
	kc: 50,
	gear: { melee: 80, range: 80, mage: 80, total: 80 },
	boosts: [],
	deathReduction: 0,
	roomBoosts
});

const empty = { melee: new Gear(), range: new Gear(), mage: new Gear() };

describe('TFA room boosts', () => {
	test('every room item is a real item', () => {
		for (const groups of Object.values(TFA_ROOM_ITEMS)) {
			for (const g of groups) for (const [name, pct] of g.items) {
				expect(Items.getItem(name), name).toBeTruthy();
				expect(pct).toBeGreaterThan(0);
				expect(pct).toBeLessThanOrEqual(4);
			}
		}
		expect(tfaRoomItemsHelpLines(id => tfaBossByID(id).name).length).toBe(8);
	});

	test('equipped items need the right setup, switches count from the bank, best per group', () => {
		const range = constructGearSetup({ '2h': 'Twisted bow' });
		const ownsSet = new Set(Items.resolveItems(['Venator bow', 'Black chinchompa', 'Red chinchompa', 'Serpentine helm']));
		const boosts = tfaRoomBoostsFor({ ...empty, range }, id => ownsSet.has(id));
		expect(boosts[4]).toEqual([
			{ name: 'Venator bow', percent: 4 },
			{ name: 'Serpentine helm', percent: 3 }
		]);
		// Dreadnoth: Tbow 3 (range setup) + jellies best = Venator 4 (not chins too).
		expect(boosts[5]).toEqual([
			{ name: 'Twisted bow', percent: 3 },
			{ name: 'Venator bow', percent: 4 }
		]);
		// A Twisted bow in the melee setup doesn't count for a range-setup group.
		const wrong = tfaRoomBoostsFor({ ...empty, melee: constructGearSetup({ '2h': 'Twisted bow' }) }, () => false);
		expect(wrong[1]).toBeUndefined();
		expect(tfaRoomBoostsFor(empty, () => false)).toEqual({});
	});

	test('room total is capped and the team boost is the average', () => {
		const big = { 5: [{ name: 'a', percent: 4 }, { name: 'b', percent: 4 }, { name: 'c', percent: 4 }] };
		expect(tfaRoomPercent(big, 5)).toBe(TFA_ROOM_BOOST_CAP);
		expect(tfaTeamRoomPercent([{ roomBoosts: big }, {}], 5)).toBe(TFA_ROOM_BOOST_CAP / 2);
		expect(tfaTeamRoomPercent([], 5)).toBe(0);
	});

	test("only speeds up a rolled boss's room, and duration still flows to the trip", () => {
		const moiaBoost = { 4: [{ name: 'Venator bow', percent: 4 }] };
		// pickFirst=true rolls Ezekiel, Moia, Dagon'hai; false rolls Bork, Dreadnoth, Xarth.
		const withMoia = createTfaRaids({ team: [member(moiaBoost)], quantity: 1, rng: new ForcedRNG(true) });
		const withoutMoia = createTfaRaids({ team: [member()], quantity: 1, rng: new ForcedRNG(true) });
		expect(withMoia.raids[0].b).toContain(4);
		const saved = withoutMoia.realDuration - withMoia.realDuration;
		expect(saved).toBeGreaterThan(0);
		// 4% of Moia's room only (6 min base, scaled by the team's speed factor), not 4% of the raid.
		expect(saved).toBeLessThan(6 * 60_000 * 0.04 + 1);
		expect(withoutMoia.fakeDuration - withMoia.fakeDuration).toBe(saved);

		const dread = createTfaRaids({ team: [member(moiaBoost)], quantity: 1, rng: new ForcedRNG(false) });
		const dreadNone = createTfaRaids({ team: [member()], quantity: 1, rng: new ForcedRNG(false) });
		expect(dread.raids[0].b).toContain(5);
		expect(dread.realDuration).toBe(dreadNone.realDuration);
	});
});