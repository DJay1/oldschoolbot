import '../../src/lib/util/clientSettings.js';

import { describe, expect, test } from 'vitest';

import {
	minTfaStats,
	TFA_MIN_GEAR_PERCENT,
	TFA_PITY_CAP,
	TFA_PITY_PER_WIPE,
	TFA_SUPPLY_KC_STEP,
	tfaHelpBoostsText,
	tfaSuppliesForKc
} from '@/lib/bsc/tfa/tfa.js';
import {
	buildTfaHelpText,
	compactSkillRequirements,
	DISCORD_CONTENT_LIMIT,
	fitDiscordMessage
} from '@/lib/bsc/tfa/tfaText.js';

// Longest Discord display name / mention form.
const NAME = 'W'.repeat(32);
const supplies = tfaSuppliesForKc(0).toString();

// Every "not ready" message checkTfaUser can return, at its longest.
const notReadyMessages = [
	`${NAME} needs to complete While Guthix Sleeps.`,
	`${NAME} needs these stats: ${compactSkillRequirements(minTfaStats)}.`,
	`${NAME}'s range gear is too weak (29.9%, needs ${TFA_MIN_GEAR_PERCENT}%).`,
	`${NAME} needs ${supplies} for 1x raid.`,
	`${NAME}'s Zorya's tome (charged) has 999,999,999 charges but needs 999,999,999 for 1x raid. Charge it with /minion charge or unequip it.`
];

function worstCase(notReady: string | null) {
	return buildTfaHelpText({
		raidName: 'The Fractured Archive',
		kc: 9_999_999,
		attempts: 9_999_999,
		uniques: 999_999,
		uniqueRate: '1 per 9999 raids, 1 per 999 days, 23 hours, 59 minutes, 59 seconds',
		notReady,
		soloWipe: 99.99,
		streak: 999_999,
		pityPercent: TFA_PITY_CAP,
		skillReqs: compactSkillRequirements(minTfaStats),
		minGear: TFA_MIN_GEAR_PERCENT,
		gear: { melee: 100, range: 100, mage: 100 },
		supplies,
		kcStep: TFA_SUPPLY_KC_STEP,
		pityPerWipe: TFA_PITY_PER_WIPE,
		pityCap: TFA_PITY_CAP,
		boostLines: tfaHelpBoostsText(),
		fragmentsUsed: 4,
		roomsBoosted: 8,
		yourBoosts:
			"Obligator (4%), Zorya's tome (3%), Ascension crossbows (3%), Archivist's folio (2%), Zeal (2%), Elemental fragments (2%), Rondache, Soulflame horn (5%, groups of 2+)",
		zeal: true
	});
}

describe('/raid tfa help fits in one Discord message', () => {
	test('worst case (every boost, every warning) stays well under 2,000 characters', () => {
		for (const msg of [null, ...notReadyMessages]) {
			const text = worstCase(msg);
			expect(text.length).toBeLessThan(DISCORD_CONTENT_LIMIT - 150);
			expect(fitDiscordMessage(text, 'x')).toBe(text);
		}
	});

	test('the ready / not ready line is near the top', () => {
		const text = worstCase(notReadyMessages[1]);
		const lines = text.split('\n');
		expect(lines.slice(0, 4).some(l => l.includes('**Not ready:**'))).toBe(true);
		expect(
			worstCase(null)
				.split('\n')
				.slice(0, 4)
				.some(l => l.includes('ready to start'))
		).toBe(true);
	});

	test('skill requirements are compact text', () => {
		expect(compactSkillRequirements(minTfaStats)).toBe(
			'90 Attack/Strength/Defence/Ranged/Magic/Hitpoints, 77 Prayer'
		);
	});
});

describe('fitDiscordMessage never truncates', () => {
	test('over 2,000 goes to an embed with the full text', () => {
		const text = 'a'.repeat(3000);
		const res = fitDiscordMessage(text, 'T') as any;
		expect(res.embeds[0].data.description).toBe(text);
	});

	test('over 4,096 is attached in full', () => {
		const text = 'b'.repeat(5000);
		const res = fitDiscordMessage(text, 'T') as any;
		expect(res.content.length).toBeLessThan(DISCORD_CONTENT_LIMIT);
		expect(res.files[0].buffer.toString()).toBe(text);
	});

	test('preferEmbed keeps short text in an embed', () => {
		const res = fitDiscordMessage('short', 'T', true) as any;
		expect(res.embeds[0].data.description).toBe('short');
	});
});
