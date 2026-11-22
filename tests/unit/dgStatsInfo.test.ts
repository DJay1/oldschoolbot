import {
	DG_FLOORS,
	determineDgLevelForFloor,
	isValidFloor,
	MAX_DG_FLOOR,
	requiredLevel,
	requiredSkills
} from '@/lib/bso/skills/dungoneering/dungData.js';
import {
	formatDgFloorRequirements,
	formatDgStatsMessage,
	missingSkillRequirements
} from '@/lib/bso/skills/dungoneering/dungInfo.js';

import { describe, expect, test } from 'vitest';

import type { SkillRequirements } from '@/lib/types/index.js';

const DISCORD_CONTENT_LIMIT = 2000;
const LENGTH_HEADROOM = 150;
const MAX_CUSTOM_EMOJI = `<a:${'W'.repeat(32)}:${'9'.repeat(20)}>`;

const COMBAT_SKILLS = ['attack', 'strength', 'defence', 'hitpoints', 'magic', 'ranged'] as const;
const SKILLING_SKILLS = [
	'herblore',
	'runecraft',
	'prayer',
	'fletching',
	'fishing',
	'cooking',
	'construction',
	'crafting'
] as const;

function emptySkills(): SkillRequirements {
	return {};
}

function skillsMeetingFloor(floor: number): SkillRequirements {
	return { ...requiredSkills(floor) };
}

function worstCaseLength(text: string): number {
	const inflated = text.replace(/<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>/g, MAX_CUSTOM_EMOJI);
	const resolved = text.match(/<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>/g)?.length ?? 0;
	const unresolved = Math.max(0, Object.keys(requiredSkills(MAX_DG_FLOOR)).length - resolved);
	return inflated.length + unresolved * MAX_CUSTOM_EMOJI.length;
}

describe('dungeoneering floors', () => {
	test('floors are 1-7, and floor 7 needs 98 combat, 65 skilling, and 120 Dungeoneering', () => {
		expect(DG_FLOORS).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(MAX_DG_FLOOR).toBe(7);
		expect(isValidFloor(7)).toBe(true);
		expect(isValidFloor(8)).toBe(false);
		expect(isValidFloor(0)).toBe(false);

		expect(requiredLevel(7)).toBe(98);
		expect(Math.floor(requiredLevel(7) / 1.5)).toBe(65);
		expect(determineDgLevelForFloor(7)).toBe(120);
		expect(formatDgFloorRequirements(7)).toBe('98 combat stats, 65 skilling stats, 120 Dungeoneering');

		const reqs = requiredSkills(7);
		for (const skill of COMBAT_SKILLS) {
			expect(reqs[skill]).toBe(98);
		}
		for (const skill of SKILLING_SKILLS) {
			expect(reqs[skill]).toBe(65);
		}
		expect(reqs.dungeoneering).toBe(120);
	});
});

describe('/dg stats next-floor info', () => {
	test('at the highest floor, the message says so and does not invent a next floor', () => {
		const text = formatDgStatsMessage({
			tokens: 12_345,
			maxFloor: 7,
			meetsMaxFloorReqs: true,
			skills: skillsMeetingFloor(7),
			gorajanBoosts: ['2x for Dung. mastery', '5% for Ring of Luck']
		});
		expect(text).toContain('**Max floor:** 7');
		expect(text).toContain("You're already on the highest floor.");
		expect(text).not.toContain('**Next floor:**');
		expect(text).not.toContain('**Missing stats:**');
		expect(text).not.toContain('Floor 8');
	});

	test('shows the next floor and only the stats still missing', () => {
		const skills: SkillRequirements = {
			...skillsMeetingFloor(6),
			attack: 80,
			dungeoneering: 90
		};
		const text = formatDgStatsMessage({
			tokens: 1000,
			maxFloor: 5,
			meetsMaxFloorReqs: true,
			skills,
			gorajanBoosts: []
		});
		expect(text).toContain('**Max floor:** 5');
		expect(text).toContain('**Next floor:** 6');
		expect(text).toContain('**Required stats:** 84 combat stats, 56 skilling stats, 100 Dungeoneering');
		expect(text).toContain('**Missing stats:**');
		expect(text).toContain('**84** Attack');
		expect(text).toContain('**100** Dungeoneering');
		expect(text).not.toContain('**84** Strength');
		expect(text).not.toContain("You're already on the highest floor.");
	});

	test('players who cannot do floor 1 yet see floor 1 missing stats', () => {
		const text = formatDgStatsMessage({
			tokens: 0,
			maxFloor: 1,
			meetsMaxFloorReqs: false,
			skills: emptySkills(),
			gorajanBoosts: []
		});
		expect(text).toContain('**Max floor:** none yet');
		expect(text).toContain('**Floor 1:**');
		expect(text).toContain(formatDgFloorRequirements(1));
		expect(text).toContain('**Missing stats:**');
		expect(text).not.toContain('**Next floor:**');
	});

	test('optional floor option checks that floor, including ones the player cannot do yet', () => {
		const text = formatDgStatsMessage({
			tokens: 50,
			maxFloor: 3,
			meetsMaxFloorReqs: true,
			skills: skillsMeetingFloor(3),
			gorajanBoosts: [],
			requestedFloor: 6
		});
		expect(text).toContain('**Floor 6:**');
		expect(text).toContain(formatDgFloorRequirements(6));
		expect(text).toContain('**Missing stats:**');
		expect(Object.keys(missingSkillRequirements(skillsMeetingFloor(3), requiredSkills(6))).length).toBeGreaterThan(
			0
		);
	});

	test('invalid floor returns a short error', () => {
		expect(
			formatDgStatsMessage({
				tokens: 1,
				maxFloor: 1,
				meetsMaxFloorReqs: true,
				skills: emptySkills(),
				gorajanBoosts: [],
				requestedFloor: 8
			})
		).toBe("That's an invalid floor.");
	});

	test('worst case (all floor 7 stats missing) stays at least 150 under the Discord message limit', () => {
		const text = formatDgStatsMessage({
			tokens: Number.MAX_SAFE_INTEGER,
			maxFloor: 1,
			meetsMaxFloorReqs: false,
			skills: emptySkills(),
			gorajanBoosts: ['2x for Dung. mastery', '30% for 99+ Dungeoneering', '5% for Ring of Luck', 'W'.repeat(80)],
			requestedFloor: 7
		});
		expect(text).toContain('**Floor 7:**');
		expect(text).toContain(formatDgFloorRequirements(7));
		expect(text).toContain('**Missing stats:**');
		expect(text).not.toContain('No stats missing.');
		for (const skill of [...COMBAT_SKILLS, ...SKILLING_SKILLS, 'dungeoneering'] as const) {
			expect(Object.keys(missingSkillRequirements({}, requiredSkills(7)))).toContain(skill);
		}
		expect(worstCaseLength(text)).toBeLessThan(DISCORD_CONTENT_LIMIT - LENGTH_HEADROOM);
	});
});
