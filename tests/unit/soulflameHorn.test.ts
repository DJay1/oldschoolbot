import '../../src/lib/util/clientSettings.js';

import { EItem } from 'oldschooljs';
import { SeedableRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import {
	applySoulflameHornToTfaTeam,
	SOULFLAME_HORN_BOOST_LINE,
	SOULFLAME_HORN_GROUP_SPEED_PERCENT,
	SOULFLAME_HORN_ID,
	soulflameHornSpeedBoost,
	uniqueRaidTeamSize,
	userHasSoulflameHornEquipped
} from '@/lib/bsc/soulflameHorn.js';
import { createTfaRaids, type TfaTeamMember, tfaUserSpeedReduction } from '@/lib/bsc/tfa/tfa.js';

const DISCORD_CONTENT_LIMIT = 2000;

function user(id: string, hasHorn: boolean) {
	return {
		id,
		gear: {
			melee: {
				hasEquipped: (item: string | number) => hasHorn && (item === SOULFLAME_HORN_ID || item === 'Soulflame horn')
			}
		}
	};
}

function member(id: string, horn = false): TfaTeamMember {
	return {
		id,
		kc: 100,
		gear: { melee: 90, range: 90, mage: 90, total: 90 },
		boosts: [],
		deathReduction: 0,
		soulflameHorn: horn
	};
}

describe('Soulflame horn group speed boost', () => {
	test('is the vanilla Soulflame horn and a 5% group-only boost', () => {
		expect(SOULFLAME_HORN_ID).toBe(EItem.SOULFLAME_HORN);
		expect(SOULFLAME_HORN_ID).toBe(30759);
		expect(SOULFLAME_HORN_GROUP_SPEED_PERCENT).toBe(5);
		expect(SOULFLAME_HORN_BOOST_LINE.length).toBeLessThan(DISCORD_CONTENT_LIMIT - 150);
	});

	test('counts distinct players, so ToB trio padding and a team of one do not qualify', () => {
		expect(uniqueRaidTeamSize([{ id: 'a' }])).toBe(1);
		expect(uniqueRaidTeamSize([{ id: 'a' }, { id: 'a' }, { id: 'a' }])).toBe(1);
		expect(uniqueRaidTeamSize([{ id: 'a' }, { id: 'b' }])).toBe(2);
		expect(soulflameHornSpeedBoost([user('a', true)], user('a', true))).toBe(0);
		expect(soulflameHornSpeedBoost([user('a', true), user('a', true), user('a', true)], user('a', true))).toBe(0);
		expect(soulflameHornSpeedBoost([user('a', true), user('b', false)], user('a', true))).toBe(5);
		expect(soulflameHornSpeedBoost([user('a', true), user('b', false)], user('b', false))).toBe(0);
	});

	test('only counts the horn when it is equipped in the melee setup', () => {
		expect(userHasSoulflameHornEquipped(user('a', true))).toBe(true);
		expect(userHasSoulflameHornEquipped(user('a', false))).toBe(false);
	});

	test('TFA: a duo with the horn is 5% faster for that player, and solo never gets it', () => {
		const withHorn = member('a', true);
		const without = member('a', false);
		expect(tfaUserSpeedReduction(withHorn) - tfaUserSpeedReduction(without)).toBe(5);

		const soloUsers = [user('a', true)];
		const soloTeam = [member('a')];
		applySoulflameHornToTfaTeam(soloTeam, soloUsers);
		expect(soloTeam[0].soulflameHorn).toBe(false);

		const duoUsers = [user('a', true), user('b', false)];
		const duoTeam = [member('a'), member('b')];
		applySoulflameHornToTfaTeam(duoTeam, duoUsers);
		expect(duoTeam[0].soulflameHorn).toBe(true);
		expect(duoTeam[1].soulflameHorn).toBe(false);

		const noHorn = createTfaRaids({
			team: [member('a'), member('b')],
			quantity: 3,
			rng: new SeedableRNG(7)
		});
		const horn = createTfaRaids({
			team: [member('a', true), member('b')],
			quantity: 3,
			rng: new SeedableRNG(7)
		});
		expect(horn.raids).toEqual(noHorn.raids);
		expect(horn.fakeDuration).toBeLessThan(noHorn.fakeDuration);
	});
});
