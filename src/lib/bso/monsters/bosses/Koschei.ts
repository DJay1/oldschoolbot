import { EBSOMonster } from '@/lib/bso/EBSOMonster.js';
import { setCustomMonster } from '@/lib/bso/monsters/setCustomMonster.js';

import { LootTable, Monsters } from 'oldschooljs';

export const KoscheiLootTable = new LootTable().add('Fremennik blade');

setCustomMonster(EBSOMonster.KOSCHEI, 'Koschei the deathless', KoscheiLootTable, Monsters.GeneralGraardor, {
	id: EBSOMonster.KOSCHEI,
	name: 'Koschei the deathless',
	aliases: ['koschei the deathless', 'koschei', 'ko']
});

export const Koschei = Monsters.find(mon => mon.name === 'Koschei the deathless')!;
