import { Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';
import { resolveAttackStyles } from '@/lib/minions/functions/resolveAttackStyles.js';

function monster(id: number) {
	const found = killableMonsters.find(m => m.id === id);
	if (!found) throw new Error(`Missing killable monster ${id}`);
	return found;
}

describe('resolveAttackStyles monster defaults', () => {
	test('Lizardman Shaman falls back to ranged when the player is on magic', () => {
		const styles = resolveAttackStyles({
			monster: monster(Monsters.LizardmanShaman.id),
			attackStyles: ['magic']
		});
		expect(styles).toEqual(['ranged']);
	});

	test('Lizardman Shaman keeps allowed ranged or defence styles', () => {
		const shaman = monster(Monsters.LizardmanShaman.id);
		expect(resolveAttackStyles({ monster: shaman, attackStyles: ['ranged'] })).toEqual(['ranged']);
		expect(resolveAttackStyles({ monster: shaman, attackStyles: ['ranged', 'defence'] })).toEqual([
			'ranged',
			'defence'
		]);
		expect(resolveAttackStyles({ monster: shaman, attackStyles: ['defence'] })).toEqual(['defence']);
	});

	test('Blood Reaver falls back to ranged when the player is on magic', () => {
		expect(
			resolveAttackStyles({
				monster: monster(Monsters.BloodReaver.id),
				attackStyles: ['magic']
			})
		).toEqual(['ranged']);
	});
});
