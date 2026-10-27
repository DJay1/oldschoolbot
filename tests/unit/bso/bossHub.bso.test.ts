import { EBSOMonster } from '@/lib/bso/EBSOMonster.js';
import { Ignecarus } from '@/lib/bso/monsters/bosses/Ignecarus.js';
import { KalphiteKingMonster } from '@/lib/bso/monsters/bosses/KalphiteKing.js';
import { KingGoldemar } from '@/lib/bso/monsters/bosses/KingGoldemar.js';
import { Koschei } from '@/lib/bso/monsters/bosses/Koschei.js';
import { Naxxus } from '@/lib/bso/monsters/bosses/Naxxus.js';
import { VasaMagus } from '@/lib/bso/monsters/bosses/VasaMagus.js';
import { NexMonster } from '@/lib/bso/monsters/nex.js';

import { stringMatches } from '@oldschoolgg/toolkit';
import { Items, LootTable, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { customBossLootIndex, findBossLoot } from '@/lib/bosses/index.js';
import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';

const dedicatedCommandBosses = [
	'Vasa Magus',
	'Ignecarus',
	'Kalphite King',
	'King Goldemar',
	'Koschei the deathless',
	'Moktang',
	'Naxxus',
	'Nex'
] as const;

describe('custom boss loot hub', () => {
	test('every custom boss file resolves to an id and a named loot table', () => {
		const unresolved = customBossLootIndex.filter(boss => boss.id < 1 || !(boss.table instanceof LootTable));
		expect(unresolved.map(boss => boss.name)).toEqual([]);

		for (const boss of customBossLootIndex) {
			const table = boss.table as LootTable;
			for (const id of table.allItems) {
				expect(Items.itemNameFromId(id), `${boss.name} item ${id}`).toBeTruthy();
			}
			expect(table.allItems.length, boss.name).toBeGreaterThan(0);
			expect(() => table.roll(3)).not.toThrow();
		}
	});

	test('Vasa Magus resolves through the hub and the monster registry', () => {
		const vasa = findBossLoot('vasa magus');
		expect(vasa).toMatchObject({
			name: 'Vasa Magus',
			id: EBSOMonster.VASA_MAGUS,
			kind: 'custom',
			lootFile: 'src/lib/bso/monsters/bosses/VasaMagus.ts'
		});
		expect(vasa?.id).toBe(VasaMagus.id);
		expect(vasa?.table).toBeInstanceOf(LootTable);

		const names = (vasa?.table as LootTable).allItems.map(id => Items.itemNameFromId(id));
		expect(names).toEqual(
			expect.arrayContaining([
				'Elder rune',
				'Magus scroll',
				'Jar of magic',
				'Tattered robes of Vasa',
				'Magical artifact'
			])
		);

		const registered = Monsters.find(mon => mon.aliases.some(alias => stringMatches(alias, 'Vasa Magus')));
		expect(registered?.id).toBe(VasaMagus.id);
		expect(registered?.name).toBe('Vasa Magus');
	});

	test('dedicated-command bosses resolve and stay off the generic kill list', () => {
		expect(findBossLoot('Ignecarus')?.id).toBe(Ignecarus.id);
		expect(findBossLoot('Kalphite King')?.id).toBe(KalphiteKingMonster.id);
		expect(findBossLoot('Kalphite King')?.id).toBe(EBSOMonster.KALPHITE_KING);
		expect(findBossLoot('King Goldemar')?.id).toBe(KingGoldemar.id);
		expect(findBossLoot('Koschei the deathless')?.id).toBe(Koschei.id);
		expect(findBossLoot('Moktang')?.id).toBe(EBSOMonster.MOKTANG);
		expect(findBossLoot('Naxxus')?.id).toBe(Naxxus.id);
		expect(findBossLoot('Nex')?.id).toBe(NexMonster.id);

		for (const name of dedicatedCommandBosses) {
			const boss = findBossLoot(name);
			expect(boss?.table, name).toBeInstanceOf(LootTable);
			expect(
				killableMonsters.some(monster => monster.id === boss?.id),
				name
			).toBe(false);
		}
	});
});
