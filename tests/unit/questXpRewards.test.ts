import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { QuestID, quests } from '@/lib/minions/data/quests.js';

const questActivitySrc = readFileSync('src/tasks/minions/specificQuestActivity.ts', 'utf8');

describe('Quest XP rewards', () => {
	test('Monkey Madness II grants the OSRS fixed skill XP', () => {
		const quest = quests.find(q => q.id === QuestID.MonkeyMadnessII);
		expect(quest?.name).toBe('Monkey Madness II');
		expect(quest?.qp).toBe(4);
		expect(quest?.skillsRewards).toEqual({
			slayer: 80_000,
			agility: 60_000,
			thieving: 50_000,
			hunter: 50_000
		});
	});

	test('Lunar Diplomacy grants the OSRS Magic and Runecraft XP', () => {
		const quest = quests.find(q => q.id === QuestID.LunarDiplomacy);
		expect(quest?.name).toBe('Lunar Diplomacy');
		expect(quest?.qp).toBe(2);
		expect(quest?.skillsRewards).toEqual({
			magic: 5000,
			runecraft: 5000
		});
	});

	test('quest skill XP is granted once through addXP with the trip duration', () => {
		expect(questActivitySrc).toMatch(/if \(quest\.skillsRewards\)/);
		expect(questActivitySrc).toMatch(
			/await user\.addXP\(\{\s*skillName: skillName as SkillNameType,\s*amount,\s*duration: data\.duration\s*\}\)/
		);
		const addXPCalls = questActivitySrc.match(/addXP\(/g) ?? [];
		expect(addXPCalls).toHaveLength(1);
	});

	test('already completed quests have no retro XP grant path', () => {
		expect(questActivitySrc).toMatch(/finished_quest_ids:\s*\{\s*push: quest\.id/);
		expect(questActivitySrc).not.toMatch(/already completed/i);
	});

	test('MM2 and Lunar Diplomacy completion messages stay under Discord limits', () => {
		for (const id of [QuestID.MonkeyMadnessII, QuestID.LunarDiplomacy]) {
			const quest = quests.find(q => q.id === id)!;
			const message = `${'x'.repeat(40)}, ${'Minion'.repeat(5)} finished **${quest.name}**. You gained the following skills rewards: ${Object.entries(
				quest.skillsRewards!
			)
				.map(([skill, xp]) => `${xp} XP in ${skill}`)
				.join(', ')}.`;
			expect(message.length).toBeLessThan(2000 - 150);
		}
	});
});
