import { bold } from '@oldschoolgg/discord';
import { Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { iceBarrageConsumables, iceBurstConsumables } from '@/lib/minions/data/combatConstants.js';
import { chaeldarMonsters } from '@/lib/minions/data/killableMonsters/chaeldarMonsters.js';
import { konarMonsters } from '@/lib/minions/data/killableMonsters/konarMonsters.js';
import { lowKillableMonsters } from '@/lib/minions/data/killableMonsters/low.js';
import { turaelMonsters } from '@/lib/minions/data/killableMonsters/turaelMonsters.js';
import { vannakaMonsters } from '@/lib/minions/data/killableMonsters/vannakaMonsters.js';
import { QuestID, quests } from '@/lib/minions/data/quests.js';
import type { KillableMonster } from '@/lib/minions/types.js';
import { hasMonsterRequirements } from '@/lib/util/hasMonsterRequirements.js';
import { mainBoostEffects } from '@/mahoji/lib/abstracted_commands/minionKill/speedBoosts.js';

const DISCORD_CONTENT_LIMIT = 2000;
const LENGTH_BUFFER = 150;

const maniacal = lowKillableMonsters.find(m => m.id === Monsters.ManiacalMonkey.id);
const allKillables: KillableMonster[] = [
	...lowKillableMonsters,
	...chaeldarMonsters,
	...konarMonsters,
	...turaelMonsters,
	...vannakaMonsters
];
const barrageable = allKillables.filter(m => m.canBarrage || m.id === Monsters.Jelly.id);

function missingQuestMessage(monsterName: string, questName: string) {
	return `You need to have completed the ${bold(questName)} quest to kill ${monsterName}.`;
}

function offTaskBarrageMessage(monsterName: string) {
	return `You can't barrage or burst ${monsterName}, because you're not on a slayer task.`;
}

describe('Maniacal monkey off-task barrage', () => {
	test('only Maniacal monkey may be burst or barraged off-task', () => {
		expect(maniacal).toBeTruthy();
		expect(maniacal!.canBarrage).toBe(true);
		expect(maniacal!.canBarrageOffTask).toBe(true);
		expect(maniacal!.requiredQuests).toEqual([QuestID.MonkeyMadnessII]);

		const others = barrageable.filter(m => m.id !== Monsters.ManiacalMonkey.id);
		expect(others.length).toBeGreaterThan(0);
		for (const monster of others) {
			expect(monster.canBarrageOffTask, monster.name).toBeFalsy();
		}
	});

	test('Monkey Madness II is a completable quest', () => {
		const quest = quests.find(q => q.id === QuestID.MonkeyMadnessII);
		expect(quest?.name).toBe('Monkey Madness II');
		const list = `That's not a valid quest, the quests you can do are: ${quests.map(q => q.name).join(', ')}.`;
		expect(list.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
	});

	test('killing without Monkey Madness II explains the missing quest', async () => {
		expect(maniacal).toBeTruthy();
		const user = {
			QP: 200,
			user: { finished_quest_ids: [] as number[] }
		} as any;
		const result = await hasMonsterRequirements(user, maniacal!);
		expect(Array.isArray(result)).toBe(true);
		expect(result[0]).toBe(false);
		const reason = result[1] as string;
		expect(reason).toBe(missingQuestMessage('Maniacal monkey', 'Monkey Madness II'));
		expect(reason.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
		expect(reason.startsWith('You need to have completed the')).toBe(true);
	});

	test('off-task error for other monsters stays short', () => {
		const msg = offTaskBarrageMessage('Dust devil');
		expect(msg.length).toBeLessThanOrEqual(DISCORD_CONTENT_LIMIT - LENGTH_BUFFER);
	});

	test('off-task Ice Barrage still costs runes and does not use slayer-helm logic', () => {
		const barrageBoost = (mainBoostEffects as { description?: string; run: Function }[]).find(
			b => !Array.isArray(b) && b.description === 'Barrage/Bursting'
		);
		expect(barrageBoost).toBeTruthy();
		const result = barrageBoost!.run({
			monster: maniacal,
			attackStyles: ['magic'],
			combatMethods: ['barrage'],
			isInWilderness: false,
			isOnTask: false
		});
		expect(result).toBeTruthy();
		expect(result.consumables).toEqual([iceBarrageConsumables]);
		expect(result.message).toMatch(/Ice Barrage/);

		const burstResult = barrageBoost!.run({
			monster: maniacal,
			attackStyles: ['magic'],
			combatMethods: ['burst'],
			isInWilderness: false,
			isOnTask: false
		});
		expect(burstResult.consumables).toEqual([iceBurstConsumables]);
		expect(burstResult.message).toMatch(/Ice Burst/);
	});
});
