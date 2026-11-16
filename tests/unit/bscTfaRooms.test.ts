import '../../src/lib/util/clientSettings.js';
import { Items } from 'oldschooljs';
import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import { createTfaRaids, tfaBossByID, type TfaTeamMember } from '@/lib/bsc/tfa/tfa.js';
import {
	TFA_ROOM_BOOST_CAP,
	TFA_ROOM_ITEMS,
	TFA_ROOM_SETS,
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

const bsoTop = ['Axe of the high sungod', 'Drygore longsword', 'Drygore mace', 'Drygore rapier', 'Dwarven warhammer', 'Hellfire bow', 'Zaryte bow', 'Virtus wand', 'Full Gorajan warrior', 'Full Gorajan archer', 'Full Gorajan occult'];

describe('TFA room boosts', () => {
	test('top BSO gear is at or above the best OSRS item in every group it is in', () => {
		for (const groups of Object.values(TFA_ROOM_ITEMS)) {
			for (const g of groups) {
				const bso = g.items.filter(i => bsoTop.includes(i[0]));
				if (bso.length === 0) continue;
				const bestOther = Math.max(0, ...g.items.filter(i => !bsoTop.includes(i[0])).map(i => i[1]));
				for (const i of bso) expect(i[1], `${g.label} ${i[0]}`).toBeGreaterThanOrEqual(bestOther);
			}
		}
		// Drygore beats Scythe, Zaryte/Hellfire bow beat Twisted bow.
		const ez = TFA_ROOM_ITEMS[2][0].items;
		expect(ez.find(i => i[0] === 'Drygore longsword')![1]).toBeGreaterThan(ez.find(i => i[0] === 'Scythe of vitur')![1]);
		const ag = TFA_ROOM_ITEMS[1][0].items;
		expect(ag.find(i => i[0] === 'Zaryte bow')![1]).toBeGreaterThan(ag.find(i => i[0] === 'Twisted bow')![1]);
	});

	test('a Gorajan set only counts when every piece is worn in the matching setup', () => {
		const full = constructGearSetup({
			head: 'Gorajan warrior helmet',
			body: 'Gorajan warrior top',
			legs: 'Gorajan warrior legs',
			hands: 'Gorajan warrior gloves',
			feet: 'Gorajan warrior boots',
			weapon: 'Drygore longsword',
			ring: 'Ignis ring (i)'
		});
		const boosts = tfaRoomBoostsFor({ ...empty, melee: full }, () => false);
		expect(boosts[2]).toEqual([
			{ name: 'Drygore longsword', percent: 5 },
			{ name: 'Full Gorajan warrior', percent: 2 },
			{ name: 'Ignis ring (i)', percent: 1 }
		]);
		expect(tfaRoomPercent(boosts, 2)).toBe(8);
		const missing = full.clone();
		missing.set('feet', null);
		expect(tfaRoomBoostsFor({ ...empty, melee: missing }, () => false)[2]!.map(b => b.name)).not.toContain('Full Gorajan warrior');
		// Same set in the range setup doesn't count for melee armour, and Ocellus picks the matching style.
		expect(tfaRoomBoostsFor({ ...empty, range: full }, () => false)[2]).toBeUndefined();
		expect(tfaRoomBoostsFor({ ...empty, melee: full }, () => false)[8]!.map(b => b.name)).toContain('Full Gorajan warrior');
		// Owning the set in the bank gives nothing.
		expect(tfaRoomBoostsFor(empty, () => true)[2]!.map(b => b.name)).toEqual(['Elder maul']);
	});

	test('every room item is a real item', () => {
		for (const groups of Object.values(TFA_ROOM_ITEMS)) {
			for (const g of groups) for (const [name, pct] of g.items) {
				for (const n of TFA_ROOM_SETS[name] ?? [name]) expect(Items.getItem(n), n).toBeTruthy();
				expect(pct).toBeGreaterThan(0);
				expect(pct).toBeLessThanOrEqual(5);
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