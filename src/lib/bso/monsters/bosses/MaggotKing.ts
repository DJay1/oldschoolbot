import type { CustomMonster } from '@/lib/bso/monsters/CustomMonster.js';
import { Slayer2026MonsterID } from '@/lib/bso/monsters/slayer2026Ids.js';

import { GearStat } from '@oldschoolgg/gear';
import { Time } from '@oldschoolgg/toolkit';
import { Bank, LootTable, Monsters } from 'oldschooljs';

import { MaggotKingItem } from '@/lib/customItems/bloodMoon.js';
import { Slayer2026Item } from '@/lib/customItems/slayer2026.js';
import { QuestID } from '@/lib/minions/data/quests.js';

const SuppliesTable = new LootTable()
	.every(MaggotKingItem.STYMPHIKE_TARTARE, [2, 4])
	.every(MaggotKingItem.DULL_ANCIENT_MEDAL);

export const MaggotKingTable = new LootTable({ limit: 159 })
	.add(SuppliesTable, 1, 41)
	.add('Uncut ruby', [10, 13], 15)
	.add(Slayer2026Item.STYMPHIKE_FEATHER, [51, 74], 10)
	.add('Mort myre fungus', [50, 76], 10)
	.add(Slayer2026Item.LETVEK, [23, 34], 10)
	.add('Runite ore', [12, 15], 5)
	.add(Slayer2026Item.BLOOD_SAC, [8, 11], 5)
	.add('Gold ore', [24, 32], 5)
	.add('Mithril ore', [36, 41], 5)
	.add('Adamantite ore', [30, 40], 10)
	.add(Slayer2026Item.ORIKALKUM_GRAVEL, [4, 5], 4)
	.add(Slayer2026Item.VENATOR_FANG, [112, 179], 2)
	.add(Slayer2026Item.VENATOR_TOOTH, [178, 219], 2)
	.add(Slayer2026Item.TARNISHED_SPEAR, 1, 12)
	.add(Slayer2026Item.TARNISHED_RING, 1, 6)
	.add(Slayer2026Item.TARNISHED_BRACELET, 1, 3)
	.add(Slayer2026Item.TARNISHED_NECKLACE, 1, 3)
	.add(Slayer2026Item.TARNISHED_AMULET, 1, 3)
	.add(Slayer2026Item.TARNISHED_BATTLEAXE, 1, 2)
	.add(Slayer2026Item.TARNISHED_LONGSWORD, 1, 2)
	.add(Slayer2026Item.TARNISHED_HALBERD, 1, 2)
	.add(Slayer2026Item.TARNISHED_2H_SWORD, 1, 2)
	.tertiary(40, 'Clue scroll (elite)')
	.tertiary(340, MaggotKingItem.ELDER_VENATOR_FANG)
	.tertiary(520, MaggotKingItem.CRIMSON_KISTEN)
	.tertiary(3500, MaggotKingItem.MAGGOT_MARQUESS);

export const MaggotKing: CustomMonster = {
	isCustom: true,
	id: Slayer2026MonsterID.MAGGOT_KING,
	name: 'Maggot King',
	aliases: ['maggot king', 'maggotking', 'mk'],
	timeToFinish: Time.Minute * 3,
	table: MaggotKingTable,
	baseMonster: Monsters.GeneralGraardor,
	hp: 1500,
	customMonsterData: { combatLevel: 741, slayerXP: 3675 },
	requiredQuests: [QuestID.TheBloodMoonRises],
	levelRequirements: {
		attack: 80,
		strength: 85,
		defence: 75,
		prayer: 74
	},
	difficultyRating: 8,
	qpRequired: 0,
	healAmountNeeded: 20 * 25,
	attackStyleToUse: GearStat.AttackCrush,
	attackStylesUsed: [GearStat.AttackRanged, GearStat.AttackMagic, GearStat.AttackCrush],
	itemInBankBoosts: [
		{
			[MaggotKingItem.CRIMSON_KISTEN]: 10
		}
	],
	notifyDrops: [MaggotKingItem.ELDER_VENATOR_FANG, MaggotKingItem.CRIMSON_KISTEN, MaggotKingItem.MAGGOT_MARQUESS],
	groupKillable: false,
	respawnTime: Time.Second * 6
};

export function rollMaggotKingEggs(quantity: number, rng: RNGProvider) {
	const loot = new Bank();
	for (let i = 0; i < quantity; i++) {
		if (rng.randFloat(0, 1502.4) < 1) loot.add(MaggotKingItem.MAGGOT_MARQUESS);
		if (rng.roll(4)) {
			loot.add(MaggotKingItem.STYMPHIKE_TARTARE, rng.randInt(2, 4));
			loot.add(MaggotKingItem.DULL_ANCIENT_MEDAL);
		}
		if (rng.roll(40)) loot.add('Clue scroll (elite)');
	}
	return loot;
}

export const CUSTOM_KONAR_KEY_RATES = new Map<number, number>([
	[Slayer2026MonsterID.MAGGOT_KING, 50],
	[Slayer2026MonsterID.SHELLBANE_GRYPHON, 58]
]);
