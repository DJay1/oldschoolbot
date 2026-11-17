import { Bank } from 'oldschooljs';

import { calculateTfaGearPercents, minTfaStats, TFA_MIN_GEAR_PERCENT, tfaSuppliesPerRaid } from '@/lib/bsc/tfa/tfa.js';
import { constructGearSetup, Gear } from '@/lib/structures/Gear.js';

/**
 * Test bot only (/testpotato tfa_min_reqs): the smallest gear that still passes the TFA start check.
 * Starts from a normal mid-level set per style and greedily strips slots while the TFA gear score stays at or above
 * TFA_MIN_GEAR_PERCENT (weapon and ammo kept), always removing the piece that leaves the score lowest. No charged items, so no charges needed.
 */
const startingSets = {
	melee: {
		head: 'Helm of neitiznot',
		neck: 'Amulet of fury',
		body: 'Bandos chestplate',
		cape: 'Fire cape',
		hands: 'Barrows gloves',
		legs: 'Bandos tassets',
		feet: 'Dragon boots',
		weapon: 'Abyssal whip',
		shield: 'Dragon defender',
		ring: 'Berserker ring (i)'
	},
	range: {
		head: 'Armadyl helmet',
		neck: 'Necklace of anguish',
		body: 'Armadyl chestplate',
		cape: "Ava's assembler",
		hands: 'Barrows gloves',
		legs: 'Armadyl chainskirt',
		feet: 'Pegasian boots',
		weapon: 'Armadyl crossbow',
		shield: 'Twisted buckler',
		ring: 'Archers ring (i)',
		ammo: 'Dragon bolts'
	},
	mage: {
		head: 'Ancestral hat',
		neck: 'Occult necklace',
		body: 'Ancestral robe top',
		cape: 'Imbued saradomin cape',
		hands: 'Tormented bracelet',
		legs: 'Ancestral robe bottom',
		feet: 'Eternal boots',
		weapon: 'Kodai wand',
		shield: 'Arcane spirit shield',
		ring: 'Seers ring (i)'
	}
} as const;

type Style = keyof typeof startingSets;
const keptSlots = ['weapon', '2h', 'ammo'];

function scoreOf(style: Style, gear: Gear) {
	const empty = new Gear();
	const fake = { gear: { melee: empty, range: empty, mage: empty, [style]: gear } } as unknown as MUser;
	return calculateTfaGearPercents(fake)[style];
}

export function buildTfaMinGear(style: Style): { gear: Gear; percent: number } {
	let gear = constructGearSetup(startingSets[style]);
	if (gear.get('ammo')) gear.set('ammo', { item: gear.get('ammo')!.item, quantity: 1000 });
	let percent = scoreOf(style, gear);
	for (;;) {
		let best: { gear: Gear; percent: number } | null = null;
		for (const [slot, value] of Object.entries(gear.raw())) {
			// Always keep a weapon (and bolts for the crossbow) so the setup can actually fight.
			if (!value || keptSlots.includes(slot)) continue;
			const trial = new Gear({ ...gear.raw(), [slot]: null });
			const p = scoreOf(style, trial);
			if (p >= TFA_MIN_GEAR_PERCENT && (!best || p < best.percent)) best = { gear: trial, percent: p };
		}
		if (!best) break;
		gear = best.gear;
		percent = best.percent;
	}
	return { gear, percent };
}

export function tfaMinReqsPlan(currentBank: Bank) {
	const gear = {
		melee: buildTfaMinGear('melee'),
		range: buildTfaMinGear('range'),
		mage: buildTfaMinGear('mage')
	};
	const missingSupplies = new Bank();
	for (const [item, qty] of tfaSuppliesPerRaid.items()) {
		const have = currentBank.amount(item.id);
		if (have < qty) missingSupplies.add(item.id, qty - have);
	}
	return { stats: minTfaStats, gear, missingSupplies };
}
