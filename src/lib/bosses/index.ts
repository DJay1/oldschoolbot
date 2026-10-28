/**
 * EDIT HERE — bosses and loot.
 *
 * Changing a drop or an item ID on a boss is one edit in the loot file below.
 * Prefer item names on the LootTable (they resolve through the item hub,
 * `@/lib/items/index.js`). If a drop uses a raw custom item ID, update that
 * number in the loot file and in `src/lib/bso/BSOItem.ts`.
 *
 * Stock OSRS boss drop tables:
 *   packages/oldschooljs/src/simulation/monsters/bosses/<Boss>.ts
 *   aggregated by packages/oldschooljs/src/simulation/monsters/bosses/index.ts
 *   runtime object: `Monsters.<Name>` from `oldschooljs`
 *   kill requirements (time, gear, boosts), not the drop table:
 *   src/lib/minions/data/killableMonsters/bosses/
 *   A few more (Barrows, Dagannoth Kings, and similar) are inline in
 *   src/lib/minions/data/killableMonsters/index.ts and still use `Monsters.<Name>` as `table`.
 *
 * Custom boss drop tables (table and kill data in the same file):
 *   src/lib/bso/monsters/bosses/
 *   src/lib/bso/monsters/demi-bosses/
 *   src/lib/bso/monsters/misc.ts
 *   src/lib/bso/monsters/nex.ts
 *   src/lib/bso/monsters/resourceDungeons.ts
 *   src/lib/bso/monsters/SunMoon.ts
 *   Register a generic custom monster in src/lib/bso/monsters/customMonsters.ts (`BSOMonsters`).
 *   Bosses with their own command stay out of `BSOMonsters` (that list is copied onto
 *   the generic kill list). Wire those in `standaloneCustomBossLoot` below.
 *   `customBossLootFiles` is the file map. Named loot tables are re-exported below.
 */
import { EBSOMonster } from '@/lib/bso/EBSOMonster.js';
import { IgnecarusLootTable } from '@/lib/bso/monsters/bosses/Ignecarus.js';
import { KalphiteKingMonster, kalphiteKingLootTable } from '@/lib/bso/monsters/bosses/KalphiteKing.js';
import { KingGoldemarLootTable } from '@/lib/bso/monsters/bosses/KingGoldemar.js';
import { KoscheiLootTable } from '@/lib/bso/monsters/bosses/Koschei.js';
import { MoktangLootTable } from '@/lib/bso/monsters/bosses/Moktang.js';
import { Naxxus, NaxxusLootTableFinishable } from '@/lib/bso/monsters/bosses/Naxxus.js';
import { VasaMagusLootTable } from '@/lib/bso/monsters/bosses/VasaMagus.js';
import { BSOMonsters } from '@/lib/bso/monsters/customMonsters.js';
import { NexMonster, nexLootTable } from '@/lib/bso/monsters/nex.js';

import type { LootTable } from 'oldschooljs';

import { bossKillables } from '@/lib/minions/data/killableMonsters/bosses/index.js';
import type { KillableMonster } from '@/lib/minions/types.js';

export { bossKillables };
export { BSOMonsters };

export { AkumuLootTable } from '@/lib/bso/monsters/bosses/Akumu.js';
export { IgnecarusLootTable } from '@/lib/bso/monsters/bosses/Ignecarus.js';
export { kalphiteKingLootTable } from '@/lib/bso/monsters/bosses/KalphiteKing.js';
export { KingGoldemarLootTable } from '@/lib/bso/monsters/bosses/KingGoldemar.js';
export { KoscheiLootTable } from '@/lib/bso/monsters/bosses/Koschei.js';
export { MoktangLootTable } from '@/lib/bso/monsters/bosses/Moktang.js';
export { NaxxusLootTable, NaxxusLootTableFinishable } from '@/lib/bso/monsters/bosses/Naxxus.js';
export { VasaMagusLootTable } from '@/lib/bso/monsters/bosses/VasaMagus.js';
export { VenatrixLootTable } from '@/lib/bso/monsters/bosses/Venatrix.js';
export { NihilizLootTable } from '@/lib/bso/monsters/demi-bosses/Nihiliz.js';
export { YetiLootTable } from '@/lib/bso/monsters/demi-bosses/Yeti.js';
export { nexLootTable } from '@/lib/bso/monsters/nex.js';

export interface BossLootEntry {
	name: string;
	id: number;
	kind: 'stock' | 'custom';
	/** File or directory to edit when changing this boss's drops. */
	lootFile: string;
	table?: KillableMonster['table'] | LootTable;
}

const STOCK_LOOT_DIR = 'packages/oldschooljs/src/simulation/monsters/bosses/';
const STOCK_KILLABLE_DIR = 'src/lib/minions/data/killableMonsters/bosses/';

/** Custom bosses: one row per loot file. Edit that file to change drops. */
export const customBossLootFiles = [
	{ name: 'Akumu', lootFile: 'src/lib/bso/monsters/bosses/Akumu.ts' },
	{ name: 'Ignecarus', lootFile: 'src/lib/bso/monsters/bosses/Ignecarus.ts' },
	{ name: 'Kalphite King', lootFile: 'src/lib/bso/monsters/bosses/KalphiteKing.ts' },
	{ name: 'King Goldemar', lootFile: 'src/lib/bso/monsters/bosses/KingGoldemar.ts' },
	{ name: 'Koschei the deathless', lootFile: 'src/lib/bso/monsters/bosses/Koschei.ts' },
	{ name: 'Moktang', lootFile: 'src/lib/bso/monsters/bosses/Moktang.ts' },
	{ name: 'Naxxus', lootFile: 'src/lib/bso/monsters/bosses/Naxxus.ts' },
	{ name: 'Vasa Magus', lootFile: 'src/lib/bso/monsters/bosses/VasaMagus.ts' },
	{ name: 'Venatrix', lootFile: 'src/lib/bso/monsters/bosses/Venatrix.ts' },
	{ name: 'Malygos', lootFile: 'src/lib/bso/monsters/demi-bosses/Malygos.ts' },
	{ name: 'Nihiliz', lootFile: 'src/lib/bso/monsters/demi-bosses/Nihiliz.ts' },
	{ name: 'Queen Black Dragon', lootFile: 'src/lib/bso/monsters/demi-bosses/QueenBlackDragon.ts' },
	{ name: 'Queen Goldemar', lootFile: 'src/lib/bso/monsters/demi-bosses/QueenGoldemar.ts' },
	{ name: 'Sea Kraken', lootFile: 'src/lib/bso/monsters/demi-bosses/SeaKraken.ts' },
	{ name: 'Superior Tormented Demon', lootFile: 'src/lib/bso/monsters/demi-bosses/TormentedDemon.ts' },
	{ name: 'Treebeard', lootFile: 'src/lib/bso/monsters/demi-bosses/Treebeard.ts' },
	{ name: 'Vladimir Drakan', lootFile: 'src/lib/bso/monsters/demi-bosses/VladimirDrakan.ts' },
	{ name: 'Yeti', lootFile: 'src/lib/bso/monsters/demi-bosses/Yeti.ts' },
	{ name: 'Cockroach soldier', lootFile: 'src/lib/bso/monsters/misc.ts' },
	{ name: 'Elite Black Knight', lootFile: 'src/lib/bso/monsters/misc.ts' },
	{ name: 'Nex', lootFile: 'src/lib/bso/monsters/nex.ts' },
	{ name: 'Frost Dragon', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Rum-pumped crab', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Fungal Rodent', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Infested axe', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Fungal mage', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Grifolaroo', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Grifolapine', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Ganodermic Runt', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Ganodermic Beast', lootFile: 'src/lib/bso/monsters/resourceDungeons.ts' },
	{ name: 'Solis', lootFile: 'src/lib/bso/monsters/SunMoon.ts' },
	{ name: 'Celestara', lootFile: 'src/lib/bso/monsters/SunMoon.ts' }
] as const;

export const stockBossLootIndex: BossLootEntry[] = bossKillables.map(boss => ({
	name: boss.name,
	id: boss.id,
	kind: 'stock',
	lootFile: `${STOCK_LOOT_DIR} (match "${boss.name}"); kill requirements: ${STOCK_KILLABLE_DIR}`,
	table: boss.table
}));

const registeredCustomMonsters = new Map(
	Object.values(BSOMonsters).map(monster => [monster.name.toLowerCase(), monster])
);

/**
 * Dedicated-command bosses. They are not on `BSOMonsters` because that object is
 * copied into the generic killable list (`bsoKillableMonsters`). These bosses are
 * fought through their own commands (`/vasa`, Ignecarus mass/solo, Nex, and similar).
 * `id` on the index is -1 only when a row is missing from both maps.
 */
const standaloneCustomBossLoot = new Map<string, { id: number; table: LootTable }>([
	['ignecarus', { id: EBSOMonster.IGNECARUS, table: IgnecarusLootTable }],
	['kalphite king', { id: KalphiteKingMonster.id, table: kalphiteKingLootTable }],
	['king goldemar', { id: EBSOMonster.KING_GOLDEMAR, table: KingGoldemarLootTable }],
	['koschei the deathless', { id: EBSOMonster.KOSCHEI, table: KoscheiLootTable }],
	['moktang', { id: EBSOMonster.MOKTANG, table: MoktangLootTable }],
	['naxxus', { id: Naxxus.id, table: NaxxusLootTableFinishable }],
	['vasa magus', { id: EBSOMonster.VASA_MAGUS, table: VasaMagusLootTable }],
	['nex', { id: NexMonster.id, table: nexLootTable }]
]);

export const customBossLootIndex: BossLootEntry[] = customBossLootFiles.map(boss => {
	const key = boss.name.toLowerCase();
	const registered = registeredCustomMonsters.get(key);
	const standalone = standaloneCustomBossLoot.get(key);
	return {
		name: boss.name,
		id: registered?.id ?? standalone?.id ?? -1,
		kind: 'custom' as const,
		lootFile: boss.lootFile,
		table: registered?.table ?? standalone?.table
	};
});

/** Stock killables in bosses/ plus the custom file map. */
export const bossLootIndex: BossLootEntry[] = [...stockBossLootIndex, ...customBossLootIndex];

export function findBossLoot(name: string): BossLootEntry | undefined {
	const needle = name.trim().toLowerCase();
	return bossLootIndex.find(boss => boss.name.toLowerCase() === needle);
}
