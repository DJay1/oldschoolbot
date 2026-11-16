import '../../src/lib/util/clientSettings.js';
import { describe, expect, test } from 'vitest';

import { calculateTfaGearPercents, TFA_UNIQUE_WEAPON_BELOW_BIS } from '@/lib/bsc/tfa/tfa.js';
import { TfaItem } from '@/lib/bsc/tfa/tfaItems.js';
import { calculateTOBUserGearPercents } from '@/lib/data/tob.js';
import { Gear } from '@/lib/structures/Gear.js';

// Krypt's test-bot melee/mage setups (Obligator and Zorya's tome equipped).
const kryptMelee = { '2h': 74618, ammo: 11212, body: 41101, cape: 70463, feet: 41104, hands: 41103, head: 41100, legs: 41102, neck: 19553, ring: 48206 };
const kryptMage = { '2h': 74617, ammo: 11212, body: 40106, cape: 70249, feet: 40109, hands: 40108, head: 40105, legs: 40107, neck: 12002, ring: 25486 };
const toGear = (o: Record<string, number>) =>
	new Gear(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { item: v, quantity: 1 }])) as any);
const withMain = (o: Record<string, number>, weapon: number | null, shield: number | null, h2: number | null) => {
	const g = { ...o } as Record<string, number | null>;
	g['2h'] = h2;
	g.weapon = weapon;
	g.shield = shield;
	return toGear(Object.fromEntries(Object.entries(g).filter(([, v]) => v !== null)) as Record<string, number>);
};
const fake = (melee: Gear, mage: Gear) => ({ gear: { melee, mage, range: new Gear() } }) as unknown as MUser;
const DRYGORE = 'Drygore longsword';

describe('TFA middle score for Obligator and Zorya\'s tome', () => {
	test("Krypt: Obligator and the tome don't lower his score vs a strong non-BiS weapon", () => {
		const melee = toGear(kryptMelee);
		const mage = toGear(kryptMage);
		const raw = calculateTOBUserGearPercents(fake(melee, mage));
		const tfa = calculateTfaGearPercents(fake(melee, mage));
		const bisMelee = calculateTOBUserGearPercents(fake(withMain(kryptMelee, 0, 0, null), mage));
		console.log('krypt raw', raw.melee.toFixed(2), raw.mage.toFixed(2), 'tfa', tfa.melee.toFixed(2), tfa.mage.toFixed(2), bisMelee.melee);
		expect(tfa.melee).toBeGreaterThan(raw.melee);
		expect(tfa.mage).toBeGreaterThan(raw.mage);
	});

	test('capped 2 points under the same setup with Drygore / Virtus, and never above it', async () => {
		const { Items } = await import('oldschooljs');
		const id = (n: string) => Items.getOrThrow(n).id;
		const melee = toGear(kryptMelee);
		const mage = toGear(kryptMage);
		const dry = withMain(kryptMelee, id(DRYGORE), id('Offhand drygore longsword'), null);
		const vir = withMain(kryptMage, id('Virtus wand'), id('Virtus book'), null);
		const tfa = calculateTfaGearPercents(fake(melee, mage));
		const bis = calculateTfaGearPercents(fake(dry, vir));
		expect(tfa.melee).toBeCloseTo(Math.max(calculateTOBUserGearPercents(fake(melee, mage)).melee, bis.melee - TFA_UNIQUE_WEAPON_BELOW_BIS), 5);
		expect(tfa.mage).toBeCloseTo(bis.mage - TFA_UNIQUE_WEAPON_BELOW_BIS, 5);
		expect(tfa.melee).toBeLessThan(bis.melee);
		expect(tfa.mage).toBeLessThan(bis.mage);
	});

	test('uncharged versions and other weapons are scored normally', () => {
		const unchargedMelee = toGear({ ...kryptMelee, '2h': TfaItem.OBLIGATOR });
		const unchargedMage = toGear({ ...kryptMage, '2h': TfaItem.ZORYAS_TOME });
		const raw = calculateTOBUserGearPercents(fake(unchargedMelee, unchargedMage));
		const tfa = calculateTfaGearPercents(fake(unchargedMelee, unchargedMage));
		expect(tfa.melee).toBe(raw.melee);
		expect(tfa.mage).toBe(raw.mage);
	});
});