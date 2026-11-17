import { describe, expect, test } from 'vitest';

import { masterHPCapeTripBoostPercent } from '@/lib/util/calcMaxTripLength.js';

describe('Hitpoints master cape trip length', () => {
	test('The Fractured Archive gets +20% like CoX, ToB and ToA', () => {
		for (const raid of ['FracturedArchive', 'Raids', 'TheatreOfBlood', 'TombsOfAmascut'] as const) {
			expect(masterHPCapeTripBoostPercent(raid)).toBe(20);
		}
	});

	test('other activities are unchanged', () => {
		for (const a of ['Nex', 'KalphiteKing', 'DepthsOfAtlantis', 'Dungeoneering', 'TuraelsTrials'] as const) {
			expect(masterHPCapeTripBoostPercent(a)).toBe(10);
		}
		for (const a of ['MonsterKilling', 'Nightmare', 'Cyclops'] as const) expect(masterHPCapeTripBoostPercent(a)).toBe(20);
		expect(masterHPCapeTripBoostPercent('Fishing')).toBe(0);
		expect(masterHPCapeTripBoostPercent(undefined)).toBe(0);
	});
});