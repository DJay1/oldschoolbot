import { Items } from 'oldschooljs';

import type { Gear } from '@/lib/structures/Gear.js';

/**
 * Room boosts that follow the boss rotation, from the OSRS wiki strategy page. A boost only speeds up that boss's room,
 * and only in raids where that boss was rolled. Each group counts its best item once. Room total is capped at
 * TFA_ROOM_BOOST_CAP. TFA uniques (Obligator, Zorya's tome, Ascension crossbows) are left out because they already give a
 * raid-wide boost.
 *
 * "equipped" items must be worn in that style's setup. "owned" items are switches (spec weapons, AoE weapons, tomes,
 * helms) and count if you have them in your bank or any setup, like other BSC raid switch boosts.
 */
export const TFA_ROOM_BOOST_CAP = 8;

export type TfaRoomSetup = 'melee' | 'range' | 'mage';

export interface TfaRoomGroup {
	label: string;
	/** Setup the item must be equipped in, or 'owned' for bank/any setup. */
	where: TfaRoomSetup | 'owned';
	items: [string, number][];
}

const meleeWeapons = (top: number): TfaRoomGroup => ({
	label: 'melee weapon',
	where: 'melee',
	items: [
		['Scythe of vitur', top],
		['Soulreaper axe', top - 1],
		["Inquisitor's mace", top - 1],
		['Abyssal bludgeon', top - 2]
	]
});

export const TFA_ROOM_ITEMS: Record<number, TfaRoomGroup[]> = {
	// Archive Guardian: flying, weak to heavy ranged; Defence can be drained; 80% fire weakness.
	1: [
		{
			label: 'ranged weapon',
			where: 'range',
			items: [
				['Twisted bow', 4],
				['Zaryte crossbow', 3],
				['Toxic blowpipe', 2]
			]
		},
		{
			label: 'Defence drain',
			where: 'owned',
			items: [
				['Tonalztics of ralos', 3],
				['Elder maul', 2],
				['Dragon warhammer', 2]
			]
		},
		{ label: 'fire weakness', where: 'owned', items: [['Tome of fire', 2]] }
	],
	// Ezekiel: very weak to crush, Defence drained by Elder maul / Dragon warhammer specs.
	2: [
		meleeWeapons(4),
		{
			label: 'Defence drain',
			where: 'owned',
			items: [
				['Elder maul', 3],
				['Dragon warhammer', 3]
			]
		}
	],
	// Bork and the Smorks: weak to crush; the Smorks are weakest to heavy ranged.
	3: [meleeWeapons(4), { label: 'heavy ranged', where: 'owned', items: [['Zaryte crossbow', 2]] }],
	// Moia: Venator bow for the undead binders; Serpentine helm stops the cough poison.
	4: [
		{ label: 'binders', where: 'owned', items: [['Venator bow', 4]] },
		{
			label: 'cough poison',
			where: 'owned',
			items: [
				['Serpentine helm', 3],
				['Tanzanite helm', 3],
				['Magma helm', 3]
			]
		}
	],
	// Dreadnoth the Jellied: range him from afar, AoE for the jellies, Scorching bow spec roots him, 85% fire weakness.
	5: [
		{
			label: 'ranged weapon',
			where: 'range',
			items: [
				['Twisted bow', 3],
				['Toxic blowpipe', 2]
			]
		},
		{
			label: 'jellies',
			where: 'owned',
			items: [
				['Venator bow', 4],
				['Black chinchompa', 3],
				['Red chinchompa', 2]
			]
		},
		{ label: 'root', where: 'owned', items: [['Scorching bow', 2]] },
		{ label: 'fire weakness', where: 'owned', items: [['Tome of fire', 2]] }
	],
	// The Dagon'hai: Venator bow on the grouped trio; Twisted bow is the top pick.
	6: [
		{ label: 'grouped trio', where: 'owned', items: [['Venator bow', 4]] },
		{ label: 'ranged weapon', where: 'range', items: [['Twisted bow', 3]] }
	],
	// Xarth: weak to crush, 85% water weakness.
	7: [
		{
			label: 'melee weapon',
			where: 'melee',
			items: [
				['Scythe of vitur', 4],
				['Soulreaper axe', 3],
				["Inquisitor's mace", 3],
				['Emberlight', 2],
				['Abyssal bludgeon', 2]
			]
		},
		{ label: 'water weakness', where: 'owned', items: [['Tome of water', 2]] }
	],
	// Ocellus: crush in phases 1/3/4, Twisted bow for the ranged phases, earth spells for the Void Augmenters.
	8: [
		meleeWeapons(3),
		{ label: 'ranged weapon', where: 'range', items: [['Twisted bow', 3]] },
		{ label: 'Void Augmenters', where: 'owned', items: [['Tome of earth', 2]] }
	]
};

export interface TfaRoomBoost {
	name: string;
	percent: number;
}

export type TfaRoomBoosts = Partial<Record<number, TfaRoomBoost[]>>;

/** The best item per group for each room, for one player. Pure so it can be tested. */
export function tfaRoomBoostsFor(gear: Record<TfaRoomSetup, Gear>, owns: (itemID: number) => boolean): TfaRoomBoosts {
	const out: TfaRoomBoosts = {};
	for (const [bossID, groups] of Object.entries(TFA_ROOM_ITEMS)) {
		const boosts: TfaRoomBoost[] = [];
		for (const group of groups) {
			const hit = group.items
				.filter(([name]) => {
					const id = Items.getOrThrow(name).id;
					return group.where === 'owned' ? owns(id) : gear[group.where].hasEquipped(id);
				})
				.sort((a, b) => b[1] - a[1])[0];
			if (hit) boosts.push({ name: hit[0], percent: hit[1] });
		}
		if (boosts.length > 0) out[Number(bossID)] = boosts;
	}
	return out;
}

/** One player's capped speed boost (percent) for a room. */
export function tfaRoomPercent(boosts: TfaRoomBoosts | undefined, bossID: number): number {
	const list = boosts?.[bossID] ?? [];
	return Math.min(
		TFA_ROOM_BOOST_CAP,
		list.reduce((acc, b) => acc + b.percent, 0)
	);
}

/** Team boost for a room: the average of each player's capped room boost. */
export function tfaTeamRoomPercent(team: { roomBoosts?: TfaRoomBoosts }[], bossID: number): number {
	if (team.length === 0) return 0;
	return team.reduce((acc, m) => acc + tfaRoomPercent(m.roomBoosts, bossID), 0) / team.length;
}

export function tfaRoomBoostsText(boosts: TfaRoomBoosts | undefined, bossIDs: number[], bossName: (id: number) => string) {
	return bossIDs
		.filter(id => (boosts?.[id]?.length ?? 0) > 0)
		.map(id => `${bossName(id)}: ${boosts![id]!.map(b => `${b.name} ${b.percent}%`).join(', ')}`);
}

export function tfaRoomItemsHelpLines(bossName: (id: number) => string): string[] {
	return Object.entries(TFA_ROOM_ITEMS).map(([id, groups]) => {
		const parts = groups.map(g => {
			const where = g.where === 'owned' ? 'bank' : `${g.where} setup`;
			return `${g.items.map(([n, p]) => `${n} ${p}%`).join(' / ')} (${where})`;
		});
		return `${bossName(Number(id))}: ${parts.join('; ')}`;
	});
}